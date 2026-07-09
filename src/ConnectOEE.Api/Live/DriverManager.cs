using ConnectOEE.Core;
using ConnectOEE.Core.Abstractions;
using ConnectOEE.Drivers;
using ConnectOEE.Infrastructure;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace ConnectOEE.Api.Live;

/// <summary>
/// Supervises all active driver instances: builds them from configured connections
/// (Mock + Rockwell, multi-PLC per line), then polls each on an interval, feeding the
/// ingestion pipeline and broadcasting live snapshots over SignalR. Per-driver connection
/// state is published to the <see cref="DriverRegistry"/> for the admin UI.
/// </summary>
public class DriverManager : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IHubContext<LiveHub> _hub;
    private readonly SnapshotCache _cache;
    private readonly DriverRegistry _registry;
    private readonly ILogger<DriverManager> _logger;
    private readonly TimeSpan _pollInterval = TimeSpan.FromSeconds(1);

    private IReadOnlyList<DriverRegistry.ActiveDriver> _drivers = Array.Empty<DriverRegistry.ActiveDriver>();
    private Dictionary<Guid, string> _machineNames = new();
    private Dictionary<Guid, LineKpiConfig> _lineConfig = new();
    private int _lastMachineCount;
    private int _lastEnabledPlcCount;
    private int _lastTagMappingCount;
    private DateTime _lastConfigCheck = DateTime.MinValue;
    private readonly Dictionary<Guid, DateTime> _lastReconnectAttempt = new();
    private static readonly TimeSpan ReconnectInterval = TimeSpan.FromSeconds(10);

    public DriverManager(
        IServiceScopeFactory scopeFactory,
        IHubContext<LiveHub> hub,
        SnapshotCache cache,
        DriverRegistry registry,
        ILogger<DriverManager> logger)
    {
        _scopeFactory = scopeFactory;
        _hub = hub;
        _cache = cache;
        _registry = registry;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Give startup migrations/seeding a moment to complete.
        await Task.Delay(TimeSpan.FromSeconds(3), stoppingToken);

        try
        {
            await InitializeAsync(stoppingToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "DriverManager failed to initialize; will retry in poll loop");
        }

        while (!stoppingToken.IsCancellationRequested)
        {
            if (_drivers.Count == 0)
            {
                try
                {
                    await InitializeAsync(stoppingToken);
                    if (_drivers.Count > 0)
                    {
                        _logger.LogInformation(
                            "DriverManager started: {Drivers} driver(s) / {Machines} machine(s)",
                            _drivers.Count, _machineNames.Count);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "DriverManager re-initialize failed");
                }

                if (_drivers.Count == 0)
                {
                    await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);
                    continue;
                }
            }

            try
            {
                if (DateTime.UtcNow - _lastConfigCheck > TimeSpan.FromSeconds(5))
                {
                    _lastConfigCheck = DateTime.UtcNow;
                    if (await HierarchyOrPlcConfigChangedAsync(stoppingToken))
                        await ReinitializeAsync(stoppingToken);
                }

                using var scope = _scopeFactory.CreateScope();
                var ingestion = scope.ServiceProvider.GetRequiredService<IngestionService>();

                foreach (var active in _drivers)
                {
                    if (active.Driver.State is ConnectionState.Faulted or ConnectionState.Disconnected)
                        await TryReconnectAsync(active, stoppingToken);

                    var readings = await active.Driver.PollAsync(stoppingToken);
                    if (readings.Count == 0) continue;

                    var result = await ingestion.IngestAsync(
                        readings, _machineNames, _lineConfig, active.Driver.State.ToString(), stoppingToken);

                    foreach (var snap in result.Snapshots)
                        await _hub.Clients.Group(LiveHub.LineGroup(snap.LineId))
                            .SendAsync("liveUpdate", snap, stoppingToken);

                    foreach (var lineId in result.RecipeChangedLineIds)
                        await _hub.Clients.Group(LiveHub.LineGroup(lineId))
                            .SendAsync("recipeChanged", lineId, stoppingToken);
                }

                // Republish current per-driver states so the admin UI sees Stale/Faulted shifts.
                _registry.Replace(_drivers);
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Driver poll/ingest failed");
            }

            await Task.Delay(_pollInterval, stoppingToken);
        }

        foreach (var active in _drivers)
            await active.Driver.DisconnectAsync(CancellationToken.None);
    }

    private async Task InitializeAsync(CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ConnectOeeDbContext>();
        var loggerFactory = scope.ServiceProvider.GetRequiredService<ILoggerFactory>();

        var factory = new DriverFactory(db, loggerFactory);
        var build = await factory.BuildAsync(ct);
        if (build.MachineNames.Count == 0) return;

        _machineNames = build.MachineNames;
        _lineConfig = build.LineConfig;
        _drivers = build.Drivers;
        _lastMachineCount = build.MachineNames.Count;
        _lastEnabledPlcCount = await db.PlcConnections.CountAsync(c => c.Enabled, ct);
        _lastTagMappingCount = await db.TagMappings.CountAsync(ct);

        foreach (var active in _drivers)
            await active.Driver.ConnectAsync(ct);

        _registry.Replace(_drivers);
    }

    private async Task<bool> HierarchyOrPlcConfigChangedAsync(CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ConnectOeeDbContext>();
        var machineCount = await db.Machines.CountAsync(ct);
        var plcCount = await db.PlcConnections.CountAsync(c => c.Enabled, ct);
        var mappingCount = await db.TagMappings.CountAsync(ct);
        return machineCount != _lastMachineCount
            || plcCount != _lastEnabledPlcCount
            || mappingCount != _lastTagMappingCount;
    }

    private async Task ReinitializeAsync(CancellationToken ct)
    {
        _logger.LogInformation(
            "DriverManager re-initializing: machine count {OldMachines}→new or PLC count {OldPlc}→new",
            _lastMachineCount, _lastEnabledPlcCount);

        foreach (var active in _drivers)
        {
            try { await active.Driver.DisconnectAsync(ct); }
            catch (Exception ex) { _logger.LogWarning(ex, "Driver disconnect during re-init failed"); }
        }

        _drivers = Array.Empty<DriverRegistry.ActiveDriver>();
        _lastReconnectAttempt.Clear();
        await InitializeAsync(ct);
    }

    private async Task TryReconnectAsync(DriverRegistry.ActiveDriver active, CancellationToken ct)
    {
        if (active.ConnectionId is not { } connectionId) return;

        var last = _lastReconnectAttempt.GetValueOrDefault(connectionId, DateTime.MinValue);
        if (DateTime.UtcNow - last < ReconnectInterval) return;

        _lastReconnectAttempt[connectionId] = DateTime.UtcNow;
        try
        {
            await active.Driver.DisconnectAsync(ct);
            await active.Driver.ConnectAsync(ct);
            if (active.Driver.State == ConnectionState.Connected)
                _logger.LogInformation("Reconnected driver {Name}", active.Name);
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Driver reconnect failed for {Name}", active.Name);
        }
    }
}

using ConnectOEE.Core;
using ConnectOEE.Core.Abstractions;
using ConnectOEE.Drivers;
using ConnectOEE.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ConnectOEE.Api.Live;

/// <summary>
/// Resolves the right <see cref="ITagBrowsingDriver"/> for a configured PLC connection
/// so the tag browser stays driver-agnostic. The Mock driver supports browsing today;
/// the Rockwell driver (Phase 11) will plug in here. Connections whose driver cannot
/// browse return null and the UI falls back to manual tag entry.
/// </summary>
public class TagBrowseService
{
    private readonly ConnectOeeDbContext _db;
    private readonly ILoggerFactory _loggerFactory;

    public TagBrowseService(ConnectOeeDbContext db, ILoggerFactory loggerFactory)
    {
        _db = db;
        _loggerFactory = loggerFactory;
    }

    public async Task<(DriverType DriverType, ITagBrowsingDriver? Driver)> ResolveAsync(Guid connectionId, CancellationToken ct = default)
    {
        var conn = await _db.PlcConnections.AsNoTracking().FirstOrDefaultAsync(c => c.Id == connectionId, ct);
        if (conn is null) return (DriverType.Mock, null);

        ITagBrowsingDriver? driver = conn.DriverType switch
        {
            DriverType.Mock => new MockDriver(Array.Empty<DriverMachine>()),
            DriverType.RockwellEthernetIp or DriverType.RockwellMicroLogix or DriverType.RockwellMicro800
                when !string.IsNullOrWhiteSpace(conn.Endpoint) =>
                new RockwellDriver(
                    new RockwellConnectionOptions(
                        conn.Endpoint!.Trim(),
                        conn.Path,
                        PlcKind: RockwellDriver.PlcKindFor(conn.DriverType)),
                    Array.Empty<RockwellTagBinding>(),
                    logger: _loggerFactory.CreateLogger<RockwellDriver>(),
                    driverType: conn.DriverType),
            DriverType.ModbusTcp when !string.IsNullOrWhiteSpace(conn.Endpoint) =>
                new ModbusTcpDriver(
                    ModbusTcpDriver.ParseEndpoint(conn.Endpoint!.Trim(), conn.Path),
                    Array.Empty<ModbusTagBinding>(),
                    _loggerFactory.CreateLogger<ModbusTcpDriver>()),
            DriverType.OpcUa when !string.IsNullOrWhiteSpace(conn.Endpoint) =>
                new OpcUaDriver(
                    new OpcUaConnectionOptions(OpcUaDriver.NormalizeEndpoint(conn.Endpoint!), TimeoutMs: 8000),
                    Array.Empty<OpcUaTagBinding>(),
                    _loggerFactory.CreateLogger<OpcUaDriver>()),
            _ => null,
        };
        return (conn.DriverType, driver);
    }

    public record ConnectionTestResult(bool Ok, string Message, int? TagCount = null);

    /// <summary>
    /// Probes a not-yet-saved (or edited) connection using the form fields.
    /// Does not persist anything or touch the live DriverRegistry.
    /// </summary>
    public async Task<ConnectionTestResult> TestAsync(
        string driverType,
        string? endpoint,
        string? path,
        CancellationToken ct = default)
    {
        if (!Enum.TryParse<DriverType>(driverType, ignoreCase: true, out var dt))
            return new ConnectionTestResult(false, $"Unknown driver type '{driverType}'.");

        switch (dt)
        {
            case DriverType.Mock:
                return new ConnectionTestResult(true, "Mock / Simulator is ready — no network required.");

            case DriverType.RockwellEthernetIp:
            case DriverType.RockwellMicroLogix:
            case DriverType.RockwellMicro800:
            {
                if (string.IsNullOrWhiteSpace(endpoint))
                    return new ConnectionTestResult(false, "IP address is required.");
                if (dt == DriverType.RockwellEthernetIp && string.IsNullOrWhiteSpace(path))
                    return new ConnectionTestResult(false, "CPU path / slot is required (e.g. 1,0).");

                var driver = new RockwellDriver(
                    new RockwellConnectionOptions(
                        endpoint.Trim(),
                        path?.Trim(),
                        PlcKind: RockwellDriver.PlcKindFor(dt),
                        TimeoutMs: 8000),
                    Array.Empty<RockwellTagBinding>(),
                    logger: _loggerFactory.CreateLogger<RockwellDriver>(),
                    driverType: dt);
                try
                {
                    var (ok, message, tagCount) = await driver.ProbeAsync(ct);
                    return new ConnectionTestResult(ok, message, tagCount);
                }
                finally
                {
                    driver.Dispose();
                }
            }

            case DriverType.ModbusTcp:
            {
                if (string.IsNullOrWhiteSpace(endpoint))
                    return new ConnectionTestResult(false, "IP address is required.");

                var driver = new ModbusTcpDriver(
                    ModbusTcpDriver.ParseEndpoint(endpoint.Trim(), path, timeoutMs: 8000),
                    Array.Empty<ModbusTagBinding>(),
                    _loggerFactory.CreateLogger<ModbusTcpDriver>());
                try
                {
                    var (ok, message, tagCount) = await driver.ProbeAsync(ct);
                    return new ConnectionTestResult(ok, message, tagCount);
                }
                finally
                {
                    driver.Dispose();
                }
            }

            case DriverType.OpcUa:
            {
                if (string.IsNullOrWhiteSpace(endpoint))
                    return new ConnectionTestResult(false, "OPC UA endpoint URL is required (e.g. opc.tcp://host:50000).");

                var driver = new OpcUaDriver(
                    new OpcUaConnectionOptions(OpcUaDriver.NormalizeEndpoint(endpoint), TimeoutMs: 12000),
                    Array.Empty<OpcUaTagBinding>(),
                    _loggerFactory.CreateLogger<OpcUaDriver>());
                try
                {
                    var (ok, message, tagCount) = await driver.ProbeAsync(ct);
                    return new ConnectionTestResult(ok, message, tagCount);
                }
                finally
                {
                    driver.Dispose();
                }
            }

            default:
                return new ConnectionTestResult(false, $"{dt} is not implemented yet — cannot test this driver.");
        }
    }

    public static TagDataType ParseDataType(string? value)
        => Enum.TryParse<TagDataType>(value, true, out var dt) ? dt : TagDataType.Unknown;

    public async Task<IReadOnlyList<TagValueSample>> ReadValuesAsync(
        Guid connectionId,
        IReadOnlyList<TagReadRequest> requests,
        CancellationToken ct = default)
    {
        var (_, driver) = await ResolveAsync(connectionId, ct);
        if (driver is null || requests.Count == 0) return Array.Empty<TagValueSample>();
        return await driver.ReadValuesAsync(requests, ct);
    }
}

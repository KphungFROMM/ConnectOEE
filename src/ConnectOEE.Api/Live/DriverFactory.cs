using ConnectOEE.Core;
using ConnectOEE.Core.Abstractions;
using ConnectOEE.Drivers;
using ConnectOEE.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ConnectOEE.Api.Live;

/// <summary>Everything the DriverManager needs to start polling, built from the DB.</summary>
public record DriverBuildResult(
    IReadOnlyList<DriverRegistry.ActiveDriver> Drivers,
    Dictionary<Guid, string> MachineNames,
    Dictionary<Guid, LineKpiConfig> LineConfig);

/// <summary>
/// Builds the set of live driver instances from configured PLC connections + tag mappings,
/// enabling multi-PLC-per-line. Rockwell connections become <see cref="RockwellDriver"/>s
/// fed by their mapped signals; machines not covered by any enabled real connection fall
/// back to the Mock simulator so the platform always has live data for the demo/offline use.
/// </summary>
public class DriverFactory
{
    private readonly ConnectOeeDbContext _db;
    private readonly ILoggerFactory _loggerFactory;

    public DriverFactory(ConnectOeeDbContext db, ILoggerFactory loggerFactory)
    {
        _db = db;
        _loggerFactory = loggerFactory;
    }

    public async Task<DriverBuildResult> BuildAsync(CancellationToken ct)
    {
        var machines = await _db.Machines
            .Select(m => new
            {
                m.Id,
                m.Name,
                m.LineId,
                IdealRate = m.Line!.OeeConfig != null ? m.Line.OeeConfig.IdealRatePerHour : 1800.0,
            })
            .ToListAsync(ct);

        var machineNames = machines.ToDictionary(m => m.Id, m => m.Name);
        var lineConfig = await _db.OeeConfigs.ToDictionaryAsync(
            o => o.LineId,
            o => new LineKpiConfig(
                o.IdealCycleTimeSec <= 0 ? 2.0 : o.IdealCycleTimeSec,
                o.MicroStopThresholdSec <= 0 ? 120 : o.MicroStopThresholdSec,
                o.ChangeoverMode,
                o.TargetOeePct,
                o.TargetAvailabilityPct,
                o.TargetPerformancePct,
                o.TargetQualityPct,
                o.ReworkTracking),
            ct);

        var drivers = new List<DriverRegistry.ActiveDriver>();
        var covered = new HashSet<Guid>();

        var connections = await _db.PlcConnections.Where(c => c.Enabled).AsNoTracking().ToListAsync(ct);

        // Resolve a machine for each mapped logical signal (machine-scoped, or the only
        // machine on a line for line-scoped signals).
        var lineMachines = machines.GroupBy(m => m.LineId).ToDictionary(g => g.Key, g => g.Select(m => m.Id).ToList());
        var rawBindings = await _db.LogicalSignals
            .Where(s => s.Mapping != null && s.Mapping.TagDefinition != null)
            .Select(s => new
            {
                s.MachineId,
                s.LineId,
                s.Role,
                ConnId = s.Mapping!.TagDefinition!.PlcConnectionId,
                Path = s.Mapping.MemberPath ?? s.Mapping.TagDefinition.FullPath,
                s.Mapping.TagDefinition.DataType,
            })
            .ToListAsync(ct);

        var bindingsByConn = new Dictionary<Guid, List<RockwellTagBinding>>();
        foreach (var b in rawBindings)
        {
            var machineId = b.MachineId
                ?? (b.LineId is { } lid && lineMachines.TryGetValue(lid, out var ms) && ms.Count == 1 ? ms[0] : (Guid?)null);
            if (machineId is null) continue;
            var lineId = b.LineId ?? machines.FirstOrDefault(m => m.Id == machineId)?.LineId ?? Guid.Empty;
            if (!bindingsByConn.TryGetValue(b.ConnId, out var list)) bindingsByConn[b.ConnId] = list = new();
            list.Add(new RockwellTagBinding(machineId.Value, lineId, b.Role, b.Path, b.DataType));
        }

        var controlsByConn = (await _db.MachineControlMaps.AsNoTracking().ToListAsync(ct))
            .GroupBy(c => c.PlcConnectionId)
            .ToDictionary(g => g.Key, g => g.Select(c => new RockwellControlBinding(c.MachineId, c.Command, c.TagPath, c.DataType)).ToList());

        var partIdMachines = await _db.LogicalSignals
            .Where(s => s.Role == SignalRole.PartId && s.Mapping != null && s.MachineId != null)
            .Select(s => s.MachineId!.Value)
            .Distinct()
            .ToListAsync(ct);

        foreach (var conn in connections)
        {
            if (conn.DriverType.IsRockwell() && !string.IsNullOrWhiteSpace(conn.Endpoint))
            {
                var sigs = bindingsByConn.TryGetValue(conn.Id, out var s) ? s : new List<RockwellTagBinding>();
                var ctrls = controlsByConn.TryGetValue(conn.Id, out var c) ? c : new List<RockwellControlBinding>();
                var opts = new RockwellConnectionOptions(
                    conn.Endpoint!.Trim(),
                    conn.Path,
                    PlcKind: RockwellDriver.PlcKindFor(conn.DriverType),
                    TimeoutMs: 5000,
                    ReadCacheMs: Math.Max(0, conn.PollIntervalMs / 4));
                var driver = new RockwellDriver(
                    opts, sigs, ctrls, _loggerFactory.CreateLogger<RockwellDriver>(), conn.DriverType);
                var machineIds = sigs.Select(x => x.MachineId).Concat(ctrls.Select(x => x.MachineId)).Distinct().ToList();
                drivers.Add(new DriverRegistry.ActiveDriver(conn.Id, conn.Name, driver, machineIds));
                foreach (var id in machineIds) covered.Add(id);
            }
            else if (conn.DriverType == DriverType.ModbusTcp && !string.IsNullOrWhiteSpace(conn.Endpoint))
            {
                var rockwellSigs = bindingsByConn.TryGetValue(conn.Id, out var s) ? s : new List<RockwellTagBinding>();
                var sigs = rockwellSigs
                    .Select(x => new ModbusTagBinding(x.MachineId, x.LineId, x.Role, x.TagPath, x.DataType))
                    .ToList();
                var opts = ModbusTcpDriver.ParseEndpoint(conn.Endpoint!.Trim(), conn.Path, timeoutMs: 5000);
                var driver = new ModbusTcpDriver(opts, sigs, _loggerFactory.CreateLogger<ModbusTcpDriver>());
                var machineIds = sigs.Select(x => x.MachineId).Distinct().ToList();
                drivers.Add(new DriverRegistry.ActiveDriver(conn.Id, conn.Name, driver, machineIds));
                foreach (var id in machineIds) covered.Add(id);
            }
            else if (conn.DriverType == DriverType.OpcUa && !string.IsNullOrWhiteSpace(conn.Endpoint))
            {
                var rockwellSigs = bindingsByConn.TryGetValue(conn.Id, out var s) ? s : new List<RockwellTagBinding>();
                var sigs = rockwellSigs
                    .Select(x => new OpcUaTagBinding(x.MachineId, x.LineId, x.Role, x.TagPath, x.DataType))
                    .ToList();
                var opts = new OpcUaConnectionOptions(OpcUaDriver.NormalizeEndpoint(conn.Endpoint!), TimeoutMs: 8000);
                var driver = new OpcUaDriver(opts, sigs, _loggerFactory.CreateLogger<OpcUaDriver>());
                var machineIds = sigs.Select(x => x.MachineId).Distinct().ToList();
                drivers.Add(new DriverRegistry.ActiveDriver(conn.Id, conn.Name, driver, machineIds));
                foreach (var id in machineIds) covered.Add(id);
            }
            else if (conn.DriverType == DriverType.Mock)
            {
                var lineFiltered = conn.LineId is { } lid
                    ? machines.Where(m => m.LineId == lid).ToList()
                    : machines;
                if (lineFiltered.Count == 0) continue;
                var dm = lineFiltered.Select(m => new DriverMachine(m.Id, m.LineId, m.Name, m.IdealRate <= 0 ? 1800.0 : m.IdealRate)).ToList();
                var driver = new MockDriver(dm, partIdMachines.Where(id => dm.Any(x => x.MachineId == id)));
                drivers.Add(new DriverRegistry.ActiveDriver(conn.Id, conn.Name, driver, dm.Select(x => x.MachineId).ToList()));
                foreach (var m in dm) covered.Add(m.MachineId);
            }
        }

        // Fallback Mock for any machine not yet driven (no connections, or partial Rockwell mapping),
        // so live dashboards always have data.
        var uncovered = machines.Where(m => !covered.Contains(m.Id)).ToList();
        if (uncovered.Count > 0)
        {
            var dm = uncovered.Select(m => new DriverMachine(m.Id, m.LineId, m.Name, m.IdealRate <= 0 ? 1800.0 : m.IdealRate)).ToList();
            drivers.Add(new DriverRegistry.ActiveDriver(null, "Mock (auto)", new MockDriver(dm, partIdMachines.Where(id => dm.Any(x => x.MachineId == id))), dm.Select(x => x.MachineId).ToList()));
        }

        return new DriverBuildResult(drivers, machineNames, lineConfig);
    }
}

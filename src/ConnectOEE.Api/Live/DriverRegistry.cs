using System.Collections.Concurrent;
using ConnectOEE.Core;
using ConnectOEE.Core.Abstractions;

namespace ConnectOEE.Api.Live;

/// <summary>Live status of one active driver instance, surfaced to the admin UI.</summary>
public record DriverStatus(
    Guid? ConnectionId,
    string Name,
    string DriverType,
    string State,
    int MachineCount,
    string? StatusDetail = null,
    int MappedTagCount = 0);

/// <summary>
/// Singleton registry of the driver instances the <see cref="DriverManager"/> is currently
/// running. Lets request-scoped controllers route control commands to the right live driver
/// and surface per-connection connection health (Connected/Stale/Faulted) per the AGENTS.md
/// UX rule that connection state is always visible.
/// </summary>
public class DriverRegistry
{
    private readonly ConcurrentDictionary<Guid, IPlcDriver> _machineToDriver = new();
    private volatile IReadOnlyList<ActiveDriver> _drivers = Array.Empty<ActiveDriver>();

    public sealed record ActiveDriver(Guid? ConnectionId, string Name, IPlcDriver Driver, IReadOnlyList<Guid> MachineIds);

    public void Replace(IReadOnlyList<ActiveDriver> drivers)
    {
        _drivers = drivers;
        _machineToDriver.Clear();
        foreach (var d in drivers)
            foreach (var m in d.MachineIds)
                _machineToDriver[m] = d.Driver;
    }

    public IControllableDriver? ControllableFor(Guid machineId)
        => _machineToDriver.TryGetValue(machineId, out var d) && d is IControllableDriver c && c.SupportsControl ? c : null;

    public IReadOnlyList<DriverStatus> Statuses() => _drivers
        .Select(d => new DriverStatus(
            d.ConnectionId,
            d.Name,
            d.Driver.Type.ToString(),
            d.Driver.State.ToString(),
            d.MachineIds.Count,
            d.Driver is IDriverDiagnostics diag ? diag.StatusDetail : null))
        .ToList();

    /// <summary>True when every machine on the line is driven by a Connected/Connecting driver.</summary>
    public bool AreLineMachinesHealthy(IEnumerable<Guid> machineIds)
    {
        var ids = machineIds.ToList();
        if (ids.Count == 0) return false;
        return ids.All(m => _machineToDriver.TryGetValue(m, out var d)
            && d.State is ConnectionState.Connected or ConnectionState.Connecting);
    }
}

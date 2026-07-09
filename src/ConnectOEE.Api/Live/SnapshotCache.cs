using System.Collections.Concurrent;

namespace ConnectOEE.Api.Live;

/// <summary>
/// In-memory latest-value cache for REST reads and SignalR broadcasts.
/// </summary>
public class SnapshotCache
{
    private readonly ConcurrentDictionary<Guid, MachineSnapshot> _snapshots = new();

    public void Set(MachineSnapshot snapshot) => _snapshots[snapshot.MachineId] = snapshot;

    public MachineSnapshot? Get(Guid machineId) =>
        _snapshots.TryGetValue(machineId, out var snap) ? snap : null;

    public bool TryUpdateReasonText(Guid machineId, string? reasonText, out MachineSnapshot? updated)
    {
        if (_snapshots.TryGetValue(machineId, out var snap))
        {
            updated = snap with { DowntimeReasonText = reasonText };
            _snapshots[machineId] = updated;
            return true;
        }
        updated = null;
        return false;
    }

    public IReadOnlyCollection<MachineSnapshot> All() => _snapshots.Values.ToList();

    public IReadOnlyCollection<MachineSnapshot> ForLine(Guid lineId)
        => _snapshots.Values.Where(s => s.LineId == lineId).ToList();
}

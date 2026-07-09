using System.Collections.Concurrent;
using ConnectOEE.Core;
using ConnectOEE.Core.Entities;

namespace ConnectOEE.Api.Live;

/// <summary>
/// Tracks auto changeover planned downtime when the running product changes.
/// Opens on recipe change; closes when the line returns to Running.
/// </summary>
public class ChangeoverService
{
    private sealed record OpenChangeover(Guid DowntimeId, DateTimeOffset StartUtc, Guid? MachineId);

    private readonly ConcurrentDictionary<Guid, OpenChangeover> _openByLine = new();

    public DowntimeEvent? StartChangeover(
        Guid lineId,
        Guid? machineId,
        Guid? shiftInstanceId,
        string? oldCode,
        string? newCode,
        DateTimeOffset ts)
    {
        if (string.IsNullOrWhiteSpace(oldCode) || string.IsNullOrWhiteSpace(newCode)
            || string.Equals(oldCode, newCode, StringComparison.OrdinalIgnoreCase))
            return null;

        var ev = new DowntimeEvent
        {
            LineId = lineId,
            MachineId = machineId,
            ShiftInstanceId = shiftInstanceId,
            StartUtc = ts,
            Kind = DowntimeKind.Planned,
            Category = LossCategory.SetupAndAdjustment,
            Reason = $"Changeover: {oldCode} → {newCode}",
        };
        _openByLine[lineId] = new OpenChangeover(ev.Id, ts, machineId);
        return ev;
    }

    public MachineRuntimeTracker.DowntimeClose? TryCloseOnRunningTransition(
        Guid lineId,
        RunState fromState,
        RunState toState,
        DateTimeOffset ts,
        int microStopThresholdSec)
    {
        if (toState != RunState.Running || fromState == RunState.Running) return null;
        if (!_openByLine.TryRemove(lineId, out var open)) return null;

        var dur = Math.Max(0, (ts - open.StartUtc).TotalSeconds);
        return new MachineRuntimeTracker.DowntimeClose(
            open.DowntimeId, ts, dur, dur <= microStopThresholdSec,
            LossCategory.SetupAndAdjustment, null);
    }

    public bool HasOpenChangeover(Guid lineId) => _openByLine.ContainsKey(lineId);

    public Guid? GetOpenChangeoverId(Guid lineId)
        => _openByLine.TryGetValue(lineId, out var o) ? o.DowntimeId : null;
}

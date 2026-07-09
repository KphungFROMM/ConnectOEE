using ConnectOEE.Api.Live;
using ConnectOEE.Core;
using ConnectOEE.Core.Entities;
using ConnectOEE.Core.Oee;

namespace ConnectOEE.Tests;

public class MachineRuntimeTrackerTests
{
    private static ShiftInstance Shift(DateTimeOffset start) => new()
    {
        ShiftName = "Day",
        StartUtc = start,
        EndUtc = start.AddHours(8),
    };

    private static ShiftTimeBalance ElapsedBalance(DateTimeOffset shiftStart, DateTimeOffset now)
    {
        var all = Math.Max(0, (now - shiftStart).TotalSeconds);
        return new ShiftTimeBalance(false, all, 0, Array.Empty<ShiftWindowCalculator.TimeInterval>());
    }

    [Fact]
    public void Opens_and_closes_a_breakdown_with_fault_category()
    {
        var tracker = new MachineRuntimeTracker();
        var line = Guid.NewGuid();
        var machine = Guid.NewGuid();
        var t0 = new DateTimeOffset(2026, 1, 1, 8, 0, 0, TimeSpan.Zero);
        var shift = Shift(t0);

        // Steady running with shift good = 0.
        tracker.Process(machine, line, shift, RunState.Running, 0, 0, 0, null, t0, 2.0, 30, ElapsedBalance(t0, t0));
        // Shift good now 5.
        tracker.Process(machine, line, shift, RunState.Running, 5, 0, 0, null, t0.AddSeconds(10), 2.0, 30, ElapsedBalance(t0, t0.AddSeconds(10)));

        // Breakdown begins (fault present); counts unchanged.
        var down = tracker.Process(machine, line, shift, RunState.Down, 5, 0, 0, 101, t0.AddSeconds(20), 2.0, 30, ElapsedBalance(t0, t0.AddSeconds(20)));
        Assert.NotNull(down.Transition);
        Assert.NotNull(down.DowntimeToAdd);
        Assert.Equal(DowntimeKind.Unplanned, down.DowntimeToAdd!.Kind);
        Assert.NotNull(down.FaultToAdd);

        // Still down (no new event).
        var still = tracker.Process(machine, line, shift, RunState.Down, 5, 0, 0, 101, t0.AddSeconds(50), 2.0, 30, ElapsedBalance(t0, t0.AddSeconds(50)));
        Assert.Null(still.DowntimeToAdd);
        Assert.Null(still.DowntimeToClose);

        // Recovers -> closes the breakdown (60s > 30s threshold => major, fault => Breakdown).
        var up = tracker.Process(machine, line, shift, RunState.Running, 5, 0, 0, null, t0.AddSeconds(80), 2.0, 30, ElapsedBalance(t0, t0.AddSeconds(80)));
        Assert.NotNull(up.DowntimeToClose);
        Assert.False(up.DowntimeToClose!.IsMicro);
        Assert.Equal(LossCategory.Breakdown, up.DowntimeToClose.Category);
        Assert.NotNull(up.FaultToClose);
        Assert.Equal(1, up.Reliability.DowntimeCount);

        // Availability should now be below 100% (60s lost out of ~80s loading time).
        Assert.True(up.Oee.AvailabilityPct < 100);
    }

    [Fact]
    public void Short_idle_stop_is_classified_as_micro_small_stop()
    {
        var tracker = new MachineRuntimeTracker();
        var line = Guid.NewGuid();
        var machine = Guid.NewGuid();
        var t0 = new DateTimeOffset(2026, 1, 1, 8, 0, 0, TimeSpan.Zero);
        var shift = Shift(t0);

        tracker.Process(machine, line, shift, RunState.Running, 0, 0, 0, null, t0, 2.0, 60, ElapsedBalance(t0, t0));
        tracker.Process(machine, line, shift, RunState.Idle, 10, 0, 0, null, t0.AddSeconds(10), 2.0, 60, ElapsedBalance(t0, t0.AddSeconds(10)));
        var up = tracker.Process(machine, line, shift, RunState.Running, 10, 0, 0, null, t0.AddSeconds(20), 2.0, 60, ElapsedBalance(t0, t0.AddSeconds(20)));

        Assert.NotNull(up.DowntimeToClose);
        Assert.True(up.DowntimeToClose!.IsMicro); // 10s <= 60s
        Assert.Equal(LossCategory.SmallStop, up.DowntimeToClose.Category);
    }

    [Fact]
    public void RestoreShiftHistory_rebuilds_uptime_and_downtime_from_state_samples()
    {
        var tracker = new MachineRuntimeTracker();
        var line = Guid.NewGuid();
        var machine = Guid.NewGuid();
        var t0 = new DateTimeOffset(2026, 1, 1, 14, 0, 0, TimeSpan.Zero);
        var shift = Shift(t0);
        var breaks = Array.Empty<ShiftWindowCalculator.TimeInterval>();

        var samples = new List<(DateTimeOffset TimestampUtc, RunState State)>
        {
            (t0.AddMinutes(30), RunState.Running),
            (t0.AddHours(2), RunState.Idle),
            (t0.AddHours(3), RunState.Running),
        };

        tracker.RestoreShiftHistory(
            machine, shift.Id, shift.StartUtc, shift.EndUtc, shift.ShiftName,
            samples, Array.Empty<DowntimeStat>(), 0, null, RunState.Running, t0, breaks);

        var now = t0.AddHours(4);
        var update = tracker.Process(
            machine, line, shift, RunState.Running, 100, 0, 0, null, now, 2.0, 30,
            ElapsedBalance(t0, now));

        // 30m + 90m running + 60m idle + 60m running tail
        Assert.InRange(update.UptimeMin, 175, 185);
        Assert.InRange(update.DowntimeMin, 55, 65);
    }

    [Fact]
    public void RestoreShiftHistory_with_no_samples_starts_accrual_at_hydration_not_shift_start()
    {
        var tracker = new MachineRuntimeTracker();
        var line = Guid.NewGuid();
        var machine = Guid.NewGuid();
        var t0 = new DateTimeOffset(2026, 1, 1, 14, 0, 0, TimeSpan.Zero);
        var shift = Shift(t0);
        var breaks = Array.Empty<ShiftWindowCalculator.TimeInterval>();
        var hydrateAt = t0.AddHours(4);

        tracker.RestoreShiftHistory(
            machine, shift.Id, shift.StartUtc, shift.EndUtc, shift.ShiftName,
            Array.Empty<(DateTimeOffset TimestampUtc, RunState State)>(),
            Array.Empty<DowntimeStat>(), 0, null, RunState.Idle, hydrateAt, breaks);

        var after = tracker.Process(
            machine, line, shift, RunState.Idle, 0, 0, 0, null, hydrateAt.AddMinutes(5), 2.0, 30,
            ElapsedBalance(t0, hydrateAt.AddMinutes(5)));

        Assert.InRange(after.DowntimeMin, 4, 6);
        Assert.InRange(after.UptimeMin, 0, 1);
    }

    [Fact]
    public void Shift_rollover_resets_within_shift_counters()
    {
        var tracker = new MachineRuntimeTracker();
        var line = Guid.NewGuid();
        var machine = Guid.NewGuid();
        var t0 = new DateTimeOffset(2026, 1, 1, 13, 50, 0, TimeSpan.Zero);
        var day = Shift(new DateTimeOffset(2026, 1, 1, 6, 0, 0, TimeSpan.Zero));   // 06-14
        var swing = new ShiftInstance
        {
            ShiftName = "Swing",
            StartUtc = new DateTimeOffset(2026, 1, 1, 14, 0, 0, TimeSpan.Zero),
            EndUtc = new DateTimeOffset(2026, 1, 1, 22, 0, 0, TimeSpan.Zero),
        };

        var swingStart = new DateTimeOffset(2026, 1, 1, 14, 0, 0, TimeSpan.Zero);
        tracker.Process(machine, line, day, RunState.Running, 0, 0, 0, null, t0, 2.0, 30, ElapsedBalance(day.StartUtc, t0));
        tracker.Process(machine, line, day, RunState.Running, 1000, 0, 0, null, t0.AddSeconds(60), 2.0, 30, ElapsedBalance(day.StartUtc, t0.AddSeconds(60)));

        // New shift: software shift totals reset to 0 (counter service responsibility).
        var after = tracker.Process(machine, line, swing, RunState.Running, 0, 0, 0, null,
            swingStart.AddSeconds(30), 2.0, 30, ElapsedBalance(swingStart, swingStart.AddSeconds(30)));

        Assert.Equal(swing.Id, after.ShiftInstanceId);
        Assert.Equal("Swing", after.ShiftName);
        Assert.True(after.Oee.QualityPct is >= 0 and <= 100);
    }
}

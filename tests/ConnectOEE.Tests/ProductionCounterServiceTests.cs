using ConnectOEE.Api.Live;
using ConnectOEE.Core;
using ConnectOEE.Core.Entities;
using Microsoft.Extensions.Logging.Abstractions;

namespace ConnectOEE.Tests;

public class ProductionCounterServiceTests
{
    private static ShiftInstance Shift(DateTimeOffset start) => new()
    {
        Id = Guid.NewGuid(),
        ShiftName = "Day",
        StartUtc = start,
        EndUtc = start.AddHours(8),
    };

    private static ProductionCounterService Svc() =>
        new(NullLogger<ProductionCounterService>.Instance);

    [Fact]
    public void Cumulative_monotonic_increments_shift_total()
    {
        var svc = Svc();
        var machine = Guid.NewGuid();
        var line = Guid.NewGuid();
        var t0 = DateTimeOffset.UtcNow;
        var shift = Shift(t0);

        svc.Process(machine, line, shift, 100, null, null, null, null, null,
            CountIngestMode.CumulativeDelta, CountIngestMode.CumulativeDelta, CountIngestMode.CumulativeDelta, t0);
        var sample = svc.Process(machine, line, shift, 105, null, null, null, null, null,
            CountIngestMode.CumulativeDelta, CountIngestMode.CumulativeDelta, CountIngestMode.CumulativeDelta, t0.AddSeconds(1));

        Assert.Equal(5, sample.GoodDelta);
        Assert.Equal(5, sample.ShiftGood);
        Assert.False(sample.PlcResetDetected);
    }

    [Fact]
    public void Cumulative_plc_reset_preserves_shift_total_and_adds_fresh_increments()
    {
        var svc = Svc();
        var machine = Guid.NewGuid();
        var line = Guid.NewGuid();
        var t0 = DateTimeOffset.UtcNow;
        var shift = Shift(t0);

        svc.Process(machine, line, shift, 100, null, null, null, null, null,
            CountIngestMode.CumulativeDelta, CountIngestMode.CumulativeDelta, CountIngestMode.CumulativeDelta, t0);
        svc.Process(machine, line, shift, 2100, null, null, null, null, null,
            CountIngestMode.CumulativeDelta, CountIngestMode.CumulativeDelta, CountIngestMode.CumulativeDelta, t0.AddMilliseconds(1));
        var sample = svc.Process(machine, line, shift, 12, null, null, null, null, null,
            CountIngestMode.CumulativeDelta, CountIngestMode.CumulativeDelta, CountIngestMode.CumulativeDelta, t0.AddSeconds(1));

        Assert.True(sample.PlcResetDetected);
        Assert.Equal(12, sample.GoodDelta);
        Assert.Equal(2012, sample.ShiftGood);
    }

    [Fact]
    public void Pulse_counts_only_on_rising_edge()
    {
        var svc = Svc();
        var machine = Guid.NewGuid();
        var line = Guid.NewGuid();
        var t0 = DateTimeOffset.UtcNow;
        var shift = Shift(t0);

        svc.Process(machine, line, shift, null, null, null, false, null, null,
            CountIngestMode.PulseRisingEdge, CountIngestMode.CumulativeDelta, CountIngestMode.CumulativeDelta, t0);
        var edge = svc.Process(machine, line, shift, null, null, null, true, null, null,
            CountIngestMode.PulseRisingEdge, CountIngestMode.CumulativeDelta, CountIngestMode.CumulativeDelta, t0.AddSeconds(1));
        var hold = svc.Process(machine, line, shift, null, null, null, true, null, null,
            CountIngestMode.PulseRisingEdge, CountIngestMode.CumulativeDelta, CountIngestMode.CumulativeDelta, t0.AddSeconds(2));

        Assert.Equal(1, edge.GoodDelta);
        Assert.Equal(1, edge.ShiftGood);
        Assert.Equal(0, hold.GoodDelta);
        Assert.Equal(1, hold.ShiftGood);
    }

    [Fact]
    public void Shift_rollover_zeros_shift_totals_but_keeps_lifetime()
    {
        var svc = Svc();
        var machine = Guid.NewGuid();
        var line = Guid.NewGuid();
        var t0 = new DateTimeOffset(2026, 1, 1, 13, 0, 0, TimeSpan.Zero);
        var day = Shift(new DateTimeOffset(2026, 1, 1, 6, 0, 0, TimeSpan.Zero));
        var swing = new ShiftInstance
        {
            Id = Guid.NewGuid(),
            ShiftName = "Swing",
            StartUtc = new DateTimeOffset(2026, 1, 1, 14, 0, 0, TimeSpan.Zero),
            EndUtc = new DateTimeOffset(2026, 1, 1, 22, 0, 0, TimeSpan.Zero),
        };

        svc.Process(machine, line, day, 0, null, null, null, null, null,
            CountIngestMode.CumulativeDelta, CountIngestMode.CumulativeDelta, CountIngestMode.CumulativeDelta, t0);
        svc.Process(machine, line, day, 500, null, null, null, null, null,
            CountIngestMode.CumulativeDelta, CountIngestMode.CumulativeDelta, CountIngestMode.CumulativeDelta, t0.AddMinutes(30));

        var after = svc.Process(machine, line, swing, 500, null, null, null, null, null,
            CountIngestMode.CumulativeDelta, CountIngestMode.CumulativeDelta, CountIngestMode.CumulativeDelta,
            new DateTimeOffset(2026, 1, 1, 14, 0, 30, TimeSpan.Zero));

        Assert.Equal(0, after.GoodDelta);
        Assert.Equal(0, after.ShiftGood);
        var persisted = svc.ToPersisted(machine, DateTimeOffset.UtcNow);
        Assert.Equal(500, persisted.LifetimeGood);
    }
}

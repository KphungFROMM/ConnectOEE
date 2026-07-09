namespace ConnectOEE.Core.Entities;

/// <summary>
/// Raw count samples. Promoted to a TimescaleDB hypertable on TimestampUtc.
/// Composite key (MachineId, TimestampUtc) because hypertables cannot have a
/// surrogate single-column PK separate from the partition column.
/// </summary>
public class TsCount
{
    public Guid MachineId { get; set; }
    public Guid LineId { get; set; }
    public DateTimeOffset TimestampUtc { get; set; }
    public long GoodCount { get; set; }
    public long RejectCount { get; set; }
    public long TotalCount { get; set; }
}

/// <summary>Raw run-state samples (hypertable on TimestampUtc).</summary>
public class TsState
{
    public Guid MachineId { get; set; }
    public Guid LineId { get; set; }
    public DateTimeOffset TimestampUtc { get; set; }
    public RunState State { get; set; }
    public int? FaultCode { get; set; }
}

/// <summary>Raw speed samples in parts/hour (hypertable on TimestampUtc).</summary>
public class TsSpeed
{
    public Guid MachineId { get; set; }
    public Guid LineId { get; set; }
    public DateTimeOffset TimestampUtc { get; set; }
    public double Speed { get; set; }
}

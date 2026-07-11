namespace ConnectOEE.Core;

/// <summary>Canonical run state of a machine/line derived from PLC signals.</summary>
public enum RunState
{
    Unknown = 0,
    Running = 1,
    Idle = 2,
    Down = 3,
    PlannedDown = 4,
    Setup = 5,
    Starved = 6,
    Blocked = 7
}

/// <summary>The Six Big Losses categories used for OEE loss attribution.</summary>
public enum LossCategory
{
    Unattributed = 0,
    Breakdown = 1,
    SetupAndAdjustment = 2,
    SmallStop = 3,
    ReducedSpeed = 4,
    StartupReject = 5,
    ProductionReject = 6
}

/// <summary>High-level grouping for downtime: planned vs unplanned.</summary>
public enum DowntimeKind
{
    Unplanned = 0,
    Planned = 1
}

/// <summary>Whether rework counters and FPY are active for a line (multi-industry).</summary>
public enum ReworkTrackingMode
{
    /// <summary>Rework ignored in KPIs; FPY equals yield.</summary>
    Off = 0,
    /// <summary>Active when any machine on the line has ReworkCount mapped.</summary>
    Auto = 1,
    /// <summary>Always show rework KPIs even if unmapped.</summary>
    On = 2
}

/// <summary>Driver implementations registered with the Driver Manager.</summary>
public enum DriverType
{
    Mock = 0,
    /// <summary>ControlLogix / CompactLogix / GuardLogix via EtherNet/IP (CIP tags).</summary>
    RockwellEthernetIp = 1,
    OpcUa = 2,
    ModbusTcp = 3,
    SiemensS7 = 4,
    /// <summary>MicroLogix (1100/1400/…) via EtherNet/IP (PCCC data-table addressing).</summary>
    RockwellMicroLogix = 5,
    /// <summary>Micro800 family (Micro820/850/870/…) via EtherNet/IP (CIP symbolic tags).</summary>
    RockwellMicro800 = 6,
}

public static class DriverTypeExtensions
{
    public static bool IsRockwell(this DriverType type) =>
        type is DriverType.RockwellEthernetIp
            or DriverType.RockwellMicroLogix
            or DriverType.RockwellMicro800;
}

/// <summary>Connection health surfaced to the UI per AGENTS.md UX rules.</summary>
public enum ConnectionState
{
    Disconnected = 0,
    Connecting = 1,
    Connected = 2,
    Stale = 3,
    Faulted = 4
}

/// <summary>How ConnectOEE interprets a mapped count signal (PLC is input only).</summary>
public enum CountIngestMode
{
    /// <summary>Monotonic DINT/INT; delta since last sample; PLC reset detected when value drops.</summary>
    CumulativeDelta = 0,
    /// <summary>BOOL rising edge increments by one per part.</summary>
    PulseRisingEdge = 1
}

/// <summary>Logical signal roles a PLC tag can be mapped to.</summary>
public enum SignalRole
{
    RunState = 0,
    GoodCount = 1,
    RejectCount = 2,
    /// <summary>Optional pulse/delta counter for parts sent to rework (first-pass yield).</summary>
    ReworkCount = 10,
    TotalCount = 3,
    Speed = 4,
    /// <summary>Optional numeric PLC stop reason (INT/DINT).</summary>
    DowntimeReason = 5,
    [Obsolete("Renamed to DowntimeReason")]
    FaultCode = DowntimeReason,
    PartId = 6,
    /// <summary>BOOL aux for MultiBool run-state (machine running).</summary>
    RunStateRunning = 7,
    /// <summary>BOOL aux for MultiBool run-state (machine idle).</summary>
    RunStateIdle = 8,
    /// <summary>BOOL aux for MultiBool run-state (machine faulted).</summary>
    RunStateFaulted = 9,
    Custom = 100
}

/// <summary>How a mapped run-state tag is interpreted into <see cref="RunState"/>.</summary>
public enum RunStateIngestMode
{
    /// <summary>INT/DINT value maps 1:1 to RunState enum.</summary>
    DirectEnum = 0,
    /// <summary>Single BOOL: true=Running, false=Idle.</summary>
    SingleBool = 1,
    /// <summary>Up to three BOOL aux signals (Running/Idle/Faulted roles); Faulted wins.</summary>
    MultiBool = 2
}

/// <summary>Primitive data type of a tag / UDT member for type-compat validation.</summary>
public enum TagDataType
{
    Unknown = 0,
    Bool = 1,
    Int = 2,
    Dint = 3,
    Real = 4,
    String = 5,
    Udt = 6,
    Array = 7,
    /// <summary>16-bit unsigned (CIP UINT / WORD) — common for Micro800 analog I/O.</summary>
    UInt = 8,
    /// <summary>CIP TIME duration (milliseconds).</summary>
    Time = 9,
}

/// <summary>Visibility/scope of a dashboard.</summary>
public enum DashboardScope
{
    Private = 0,
    RoleRestricted = 1,
    PublicKiosk = 2
}

/// <summary>Quality of a sampled value (mirrors OPC-style quality).</summary>
public enum ValueQuality
{
    Bad = 0,
    Uncertain = 1,
    Good = 2
}

/// <summary>Prebuilt report layouts (see docs/12). Custom is designer-authored.</summary>
public enum ReportType
{
    ShiftReport = 0,
    DailyOee = 1,
    DowntimePareto = 2,
    ProductionVsTarget = 3,
    WeeklySummary = 4,
    MonthlySummary = 5,
    ExecutiveSummary = 6,
    FaultMaintenance = 7,
    Custom = 100
}

/// <summary>Output format for a generated report.</summary>
public enum ReportFormat
{
    Pdf = 0,
    Csv = 1
}

/// <summary>How often a scheduled report runs.</summary>
public enum ReportFrequency
{
    Daily = 0,
    Weekly = 1,
    Monthly = 2
}

/// <summary>Delivery channel for a scheduled report.</summary>
public enum ReportDeliveryMethod
{
    Email = 0,
    FileDrop = 1
}

/// <summary>Lifecycle status of a single report generation/delivery.</summary>
public enum ReportRunStatus
{
    Pending = 0,
    Success = 1,
    Failed = 2
}

/// <summary>How a line uses product/recipe data for ideal-rate resolution.</summary>
public enum LineProductionMode
{
    /// <summary>Mixed products — line speed → catalog → line fallback (default).</summary>
    MultiProduct = 0,
    /// <summary>Single dedicated SKU — line fallback should match that product's line speed.</summary>
    DedicatedProduct = 1,
    /// <summary>No PartId / recipe tracking — performance uses line fallback only.</summary>
    NoProductTracking = 2,
}

/// <summary>
/// Physical topology of machines on a line. Independent = parallel peers (sum counts).
/// Continuous = serial A→B→C; line counts come from the designated output station.
/// </summary>
public enum LineTopology
{
    /// <summary>Machines produce independently; line rollup sums counts and averages A/P.</summary>
    Independent = 0,
    /// <summary>Product feeds station-to-station; line output counts from one machine.</summary>
    Continuous = 1,
}

/// <summary>How product changes are recorded on a line.</summary>
public enum ChangeoverMode
{
    /// <summary>Product change opens/closes planned setup downtime (default).</summary>
    SetupTracked = 0,
    /// <summary>Product change logged via ProductionRun + audit only — no downtime events.</summary>
    LogOnly = 1,
}

/// <summary>Relative date window resolved at run time for a report/schedule.</summary>
public enum ReportRangeKind
{
    PreviousShift = 0,
    Today = 1,
    Yesterday = 2,
    Last24h = 3,
    Last7d = 4,
    Last30d = 5,
    PreviousWeek = 6,
    PreviousMonth = 7,
    Custom = 8
}

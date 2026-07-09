namespace ConnectOEE.Core.Abstractions;

/// <summary>
/// A single reading for one logical signal on a machine at a point in time.
/// Drivers translate native tags into these so the ingestion/OEE engine stays
/// driver-agnostic (mock, Rockwell, OPC UA, ...).
/// </summary>
public record SignalReading(
    Guid MachineId,
    Guid LineId,
    SignalRole Role,
    double Value,
    RunState? State,
    int? FaultCode,
    DateTimeOffset TimestampUtc,
    ValueQuality Quality = ValueQuality.Good,
    string? TextValue = null);

/// <summary>
/// Abstraction over a PLC driver. Implementations connect, report connection state,
/// and produce readings on each poll. New drivers plug in without touching ingestion.
/// </summary>
public interface IPlcDriver
{
    DriverType Type { get; }
    ConnectionState State { get; }

    Task ConnectAsync(CancellationToken ct = default);

    /// <summary>Reads current values for all known signals.</summary>
    Task<IReadOnlyList<SignalReading>> PollAsync(CancellationToken ct = default);

    Task DisconnectAsync(CancellationToken ct = default);
}

/// <summary>Identifies a machine + its line for driver simulation/mapping.</summary>
public record DriverMachine(Guid MachineId, Guid LineId, string Name, double IdealRatePerHour);

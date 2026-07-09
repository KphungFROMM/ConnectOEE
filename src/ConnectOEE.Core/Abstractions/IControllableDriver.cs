namespace ConnectOEE.Core.Abstractions;

/// <summary>
/// Operator/automation commands a controllable driver may issue to a machine.
/// Deliberately narrow: the platform never directly forces motion - it sets a
/// permissive/enable bit or pulses reset/ack, and the PLC program owns all
/// interlocks and safety (see docs/08).
/// </summary>
public enum PlcCommand
{
    /// <summary>Set/hold the start-permissive (enable) bit that allows the line to start.</summary>
    StartPermissive = 0,
    /// <summary>Pulse the reset / clear-fault bit.</summary>
    Reset = 1,
    /// <summary>Pulse the acknowledge bit (e.g. ack alarm/fault).</summary>
    Ack = 2
}

/// <summary>
/// Optional capability for drivers that can write back to the controller. Drivers
/// without write support report <see cref="SupportsControl"/> = false and command
/// endpoints return 400. Commands are routed by machine to a mapped control tag.
/// </summary>
public interface IControllableDriver
{
    /// <summary>True when this driver can write control tags.</summary>
    bool SupportsControl { get; }

    /// <summary>Issues a logical command to a machine via its mapped control tag.</summary>
    Task<bool> WriteCommandAsync(Guid machineId, PlcCommand command, CancellationToken ct = default);

    /// <summary>Writes a raw numeric value to a fully-qualified tag path.</summary>
    Task<bool> WriteTagAsync(string tagPath, double value, CancellationToken ct = default);
}

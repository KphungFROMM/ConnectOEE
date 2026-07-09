namespace ConnectOEE.Core.Abstractions;

/// <summary>Optional diagnostics surfaced in admin/wizard PLC health UI.</summary>
public interface IDriverDiagnostics
{
    string? StatusDetail { get; }
}

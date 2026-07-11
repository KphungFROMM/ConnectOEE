namespace ConnectOEE.Core.Licensing;

public interface ILicenseService
{
    LicenseEdition Edition { get; }
    bool IsValid { get; }
    string EditionDisplay { get; }
    string? LicenseHolder { get; }
    int TrialDaysRemaining { get; }
    DateTime? ExpiresUtc { get; }

    int MaxPlants { get; }
    int MaxLines { get; }
    /// <summary>Full industrial PLC driver suite (Rockwell, Modbus, OPC UA, …). Trial is Mock-only.</summary>
    bool PlcDriversEnabled { get; }
    bool PdfReportsEnabled { get; }
    bool ScheduledReportsEnabled { get; }
    int MaxKioskDashboards { get; }

    string MachineIdDisplay { get; }
    string? LastActivationError { get; }

    bool ValidateAndActivate(string? licenseKey);
}

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
    bool RockwellDriverEnabled { get; }
    bool PdfReportsEnabled { get; }
    bool ScheduledReportsEnabled { get; }
    int MaxKioskDashboards { get; }

    bool ValidateAndActivate(string? licenseKey);
}

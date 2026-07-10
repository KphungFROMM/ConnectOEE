namespace ConnectOEE.Core.Licensing;

/// <summary>
/// Full-feature license for local development (same pattern as ConnectModbusTools).
/// Registered automatically in Debug builds.
/// </summary>
public sealed class PersonalLicenseService : ILicenseService
{
    public LicenseEdition Edition => LicenseEdition.Personal;
    public bool IsValid => true;
    public string EditionDisplay => "Personal — Development";
    public string? LicenseHolder => "Development";
    public int TrialDaysRemaining => 0;
    public DateTime? ExpiresUtc => null;

    public int MaxPlants => int.MaxValue;
    public int MaxLines => int.MaxValue;
    public bool RockwellDriverEnabled => true;
    public bool PdfReportsEnabled => true;
    public bool ScheduledReportsEnabled => true;
    public int MaxKioskDashboards => int.MaxValue;

    public bool ValidateAndActivate(string? licenseKey) => true;
}

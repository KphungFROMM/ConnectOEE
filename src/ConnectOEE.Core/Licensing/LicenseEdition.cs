namespace ConnectOEE.Core.Licensing;

public enum LicenseEdition
{
    Trial,
    Full,
    Expired,
    Personal
}

public sealed class LicenseState
{
    public DateTime? TrialStartedUtc { get; set; }
    public string? ActivatedKeyHash { get; set; }
    public string? LicenseHolder { get; set; }
    public DateTime? ActivatedUtc { get; set; }
    public DateTime? ExpiresUtc { get; set; }
    public string? MachineIdHash { get; set; }
}

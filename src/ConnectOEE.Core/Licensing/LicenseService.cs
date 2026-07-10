namespace ConnectOEE.Core.Licensing;

public sealed class LicenseService : ILicenseService
{
    private const int TrialDays = 14;
    private LicenseState _state;

    public LicenseService()
    {
        _state = LicenseStore.Load();
        if (_state.TrialStartedUtc is null && string.IsNullOrEmpty(_state.ActivatedKeyHash))
            _state.TrialStartedUtc = DateTime.UtcNow;
        LicenseStore.Save(_state);
    }

    public LicenseEdition Edition => ComputeEdition();

    public bool IsValid => Edition is LicenseEdition.Trial or LicenseEdition.Full or LicenseEdition.Personal;

    public string? LicenseHolder => Edition switch
    {
        LicenseEdition.Full => _state.LicenseHolder,
        LicenseEdition.Personal => "Development",
        LicenseEdition.Trial => "Trial",
        _ => null
    };

    public int TrialDaysRemaining
    {
        get
        {
            if (_state.TrialStartedUtc is null)
                return TrialDays;
            var elapsed = (DateTime.UtcNow - _state.TrialStartedUtc.Value).TotalDays;
            return Math.Max(0, TrialDays - (int)Math.Floor(elapsed));
        }
    }

    public DateTime? ExpiresUtc => Edition switch
    {
        LicenseEdition.Full => _state.ExpiresUtc,
        _ => null
    };

    public string EditionDisplay => Edition switch
    {
        LicenseEdition.Full when _state.ExpiresUtc is { } expires =>
            $"Full — {_state.LicenseHolder} (until {expires:yyyy-MM-dd})",
        LicenseEdition.Full => $"Full — {_state.LicenseHolder}",
        LicenseEdition.Trial => $"Trial — {TrialDaysRemaining} days left",
        LicenseEdition.Personal => "Personal — Development",
        LicenseEdition.Expired => "Expired — activate license",
        _ => "Unknown"
    };

    public int MaxPlants => HasFullFeatures ? int.MaxValue : 1;
    public int MaxLines => HasFullFeatures ? int.MaxValue : 2;
    public bool RockwellDriverEnabled => HasFullFeatures;
    public bool PdfReportsEnabled => HasFullFeatures;
    public bool ScheduledReportsEnabled => HasFullFeatures;
    public int MaxKioskDashboards => HasFullFeatures ? int.MaxValue : 1;

    private bool HasFullFeatures =>
        Edition is LicenseEdition.Full or LicenseEdition.Personal;

    public bool ValidateAndActivate(string? licenseKey)
    {
        if (!LicenseValidator.TryValidate(licenseKey, out var payload) || payload is null)
            return false;

        _state.ActivatedKeyHash = LicenseValidator.HashKey(licenseKey!);
        _state.LicenseHolder = payload.Holder;
        _state.ActivatedUtc = DateTime.UtcNow;
        _state.ExpiresUtc = LicenseValidator.ParseExpiresUtc(payload.Expires);
        LicenseStore.Save(_state);
        return true;
    }

    private LicenseEdition ComputeEdition()
    {
        if (IsDevOverride)
            return LicenseEdition.Personal;
        if (!string.IsNullOrEmpty(_state.ActivatedKeyHash))
        {
            if (_state.ExpiresUtc is { } expires && DateTime.UtcNow.Date > expires.Date)
                return LicenseEdition.Expired;
            return LicenseEdition.Full;
        }
        if (TrialDaysRemaining > 0)
            return LicenseEdition.Trial;
        return LicenseEdition.Expired;
    }

    private static bool IsDevOverride
    {
        get
        {
#if DEBUG
            return string.Equals(
                Environment.GetEnvironmentVariable("CONNECTOEE_DEV_LICENSE"),
                "1",
                StringComparison.Ordinal);
#else
            return false;
#endif
        }
    }
}

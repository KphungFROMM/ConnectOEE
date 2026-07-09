namespace ConnectOEE.Api.Auth;

/// <summary>Factory deployment security settings (TLS, headers, session policy).</summary>
public class SecurityOptions
{
    public const string SectionName = "Security";

    /// <summary>When true (default in Production), redirect HTTP to HTTPS and emit HSTS.</summary>
    public bool RequireHttps { get; set; } = true;

    public int HstsMaxAgeDays { get; set; } = 365;

    /// <summary>Optional PFX path for Kestrel TLS binding (Windows Service install).</summary>
    public string? CertificatePath { get; set; }

    public string? CertificatePassword { get; set; }

    /// <summary>Comma-separated allowed Host headers. Empty = allow any (dev only).</summary>
    public string AllowedHosts { get; set; } = string.Empty;

    /// <summary>Operator/Staff idle timeout minutes surfaced to the SPA.</summary>
    public int IdleTimeoutMinutes { get; set; } = 15;

    /// <summary>AES key (base64, 32 bytes) for encrypting pg_dump backups at rest.</summary>
    public string? BackupEncryptionKey { get; set; }

    public string KioskCookieName { get; set; } = "connectoee.kiosk";
    public string RefreshCookieName { get; set; } = "connectoee.refresh";
    public int KioskTokenHours { get; set; } = 24;
    public int RefreshTokenDays { get; set; } = 7;
}

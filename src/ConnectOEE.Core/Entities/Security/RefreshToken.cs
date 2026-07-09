namespace ConnectOEE.Core.Entities.Security;

/// <summary>Server-side refresh token (hash stored; raw value only in httpOnly cookie).</summary>
public class RefreshToken : EntityBase
{
    public Guid UserId { get; set; }
    public string TokenHash { get; set; } = string.Empty;
    public DateTimeOffset ExpiresUtc { get; set; }
    public DateTimeOffset? RevokedUtc { get; set; }
    public string? ReplacedByTokenHash { get; set; }
}

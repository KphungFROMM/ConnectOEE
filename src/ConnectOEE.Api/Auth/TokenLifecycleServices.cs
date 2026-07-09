using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using ConnectOEE.Core.Entities.Security;
using ConnectOEE.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace ConnectOEE.Api.Auth;

/// <summary>Short-lived JWT for anonymous kiosk displays (httpOnly cookie).</summary>
public sealed class KioskTokenService
{
    private readonly JwtOptions _jwt;
    private readonly SecurityOptions _security;

    public KioskTokenService(IOptions<JwtOptions> jwt, IOptions<SecurityOptions> security)
    {
        _jwt = jwt.Value;
        _security = security.Value;
    }

    public string CreateToken(Guid dashboardId, Guid lineId)
    {
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, dashboardId.ToString()),
            new(ConnectClaimTypes.LineScope, lineId.ToString()),
            new(ClaimTypes.Role, RoleNames.Kiosk),
            new("token_kind", "kiosk"),
        };

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwt.SigningKey));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var expires = DateTimeOffset.UtcNow.AddHours(_security.KioskTokenHours);

        var jwt = new JwtSecurityToken(
            issuer: _jwt.Issuer,
            audience: $"{_jwt.Audience}-Kiosk",
            claims: claims,
            expires: expires.UtcDateTime,
            signingCredentials: creds);

        return new JwtSecurityTokenHandler().WriteToken(jwt);
    }

    public bool TryValidate(string? token, Guid expectedDashboardId, out Guid lineId)
    {
        lineId = Guid.Empty;
        if (string.IsNullOrWhiteSpace(token)) return false;

        try
        {
            var handler = new JwtSecurityTokenHandler();
            var principal = handler.ValidateToken(token, new TokenValidationParameters
            {
                ValidateIssuer = true,
                ValidIssuer = _jwt.Issuer,
                ValidateAudience = true,
                ValidAudience = $"{_jwt.Audience}-Kiosk",
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwt.SigningKey)),
                ValidateLifetime = true,
                ClockSkew = TimeSpan.FromSeconds(30),
            }, out _);

            if (principal.FindFirst("token_kind")?.Value != "kiosk") return false;
            if (!Guid.TryParse(principal.FindFirstValue(JwtRegisteredClaimNames.Sub), out var dashId)) return false;
            if (dashId != expectedDashboardId) return false;
            if (!Guid.TryParse(principal.FindFirstValue(ConnectClaimTypes.LineScope), out lineId)) return false;
            return lineId != Guid.Empty;
        }
        catch
        {
            return false;
        }
    }
}

/// <summary>Refresh tokens stored as SHA-256 hashes in httpOnly cookies.</summary>
public sealed class RefreshTokenService
{
    private readonly ConnectOeeDbContext _db;
    private readonly SecurityOptions _security;

    public RefreshTokenService(ConnectOeeDbContext db, IOptions<SecurityOptions> security)
    {
        _db = db;
        _security = security.Value;
    }

    public async Task<(string RawToken, RefreshToken Entity)> IssueAsync(Guid userId, CancellationToken ct = default)
    {
        var raw = Convert.ToBase64String(RandomNumberGenerator.GetBytes(64));
        var hash = Hash(raw);
        var entity = new RefreshToken
        {
            UserId = userId,
            TokenHash = hash,
            ExpiresUtc = DateTimeOffset.UtcNow.AddDays(_security.RefreshTokenDays),
        };
        _db.RefreshTokens.Add(entity);
        await _db.SaveChangesAsync(ct);
        return (raw, entity);
    }

    public async Task<RefreshToken?> ValidateAsync(string rawToken, CancellationToken ct = default)
    {
        var hash = Hash(rawToken);
        return await _db.RefreshTokens
            .FirstOrDefaultAsync(t => t.TokenHash == hash && t.RevokedUtc == null && t.ExpiresUtc > DateTimeOffset.UtcNow, ct);
    }

    public async Task RevokeAsync(string rawToken, string? replacedByHash = null, CancellationToken ct = default)
    {
        var hash = Hash(rawToken);
        var token = await _db.RefreshTokens.FirstOrDefaultAsync(t => t.TokenHash == hash, ct);
        if (token is null || token.RevokedUtc is not null) return;
        token.RevokedUtc = DateTimeOffset.UtcNow;
        token.ReplacedByTokenHash = replacedByHash;
        await _db.SaveChangesAsync(ct);
    }

    public static string Hash(string raw)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(raw));
        return Convert.ToHexString(bytes);
    }
}

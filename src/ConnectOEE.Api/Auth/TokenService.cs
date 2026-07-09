using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using ConnectOEE.Core.Entities.Security;
using ConnectOEE.Infrastructure;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace ConnectOEE.Api.Auth;

public record AuthResult(string Token, DateTimeOffset ExpiresUtc, UserInfo User);

public record UserInfo(
    Guid Id,
    string UserName,
    string DisplayName,
    IReadOnlyList<string> Roles,
    IReadOnlyList<string> Permissions,
    IReadOnlyList<Guid> PlantScopes,
    IReadOnlyList<Guid> LineScopes,
    bool MustChangePassword,
    bool TwoFactorEnabled,
    int IdleTimeoutMinutes);

/// <summary>Builds JWTs carrying role, permission, and plant/line-scope claims.</summary>
public class TokenService
{
    private readonly ConnectOeeDbContext _db;
    private readonly UserManager<AppUser> _userManager;
    private readonly JwtOptions _options;
    private readonly SecurityOptions _security;

    public TokenService(ConnectOeeDbContext db, UserManager<AppUser> userManager,
        IOptions<JwtOptions> options, IOptions<SecurityOptions> security)
    {
        _db = db;
        _userManager = userManager;
        _options = options.Value;
        _security = security.Value;
    }

    public async Task<AuthResult> CreateTokenAsync(AppUser user)
    {
        var roles = await _userManager.GetRolesAsync(user);

        // Resolve permission keys granted via the user's roles.
        var roleIds = await _db.Roles
            .Where(r => r.Name != null && roles.Contains(r.Name))
            .Select(r => r.Id)
            .ToListAsync();

        var permissions = await _db.RolePermissions
            .Where(rp => roleIds.Contains(rp.RoleId))
            .Join(_db.Permissions, rp => rp.PermissionId, p => p.Id, (rp, p) => p.Key)
            .Distinct()
            .ToListAsync();

        var plantScopes = await _db.UserPlantScopes
            .Where(s => s.UserId == user.Id)
            .Select(s => s.PlantId).Distinct().ToListAsync();
        var lineScopes = await _db.UserPlantScopes
            .Where(s => s.UserId == user.Id && s.LineId != null)
            .Select(s => s.LineId!.Value).Distinct().ToListAsync();

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new(JwtRegisteredClaimNames.UniqueName, user.UserName ?? string.Empty),
            new("display_name", user.DisplayName ?? user.UserName ?? string.Empty),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
        };
        claims.AddRange(roles.Select(r => new Claim(ClaimTypes.Role, r)));
        claims.AddRange(permissions.Select(p => new Claim(ConnectClaimTypes.Permission, p)));
        claims.AddRange(plantScopes.Select(p => new Claim(ConnectClaimTypes.PlantScope, p.ToString())));
        claims.AddRange(lineScopes.Select(l => new Claim(ConnectClaimTypes.LineScope, l.ToString())));

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_options.SigningKey));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var expires = DateTimeOffset.UtcNow.AddMinutes(_options.AccessTokenMinutes);

        var jwt = new JwtSecurityToken(
            issuer: _options.Issuer,
            audience: _options.Audience,
            claims: claims,
            expires: expires.UtcDateTime,
            signingCredentials: creds);

        var token = new JwtSecurityTokenHandler().WriteToken(jwt);

        var info = new UserInfo(
            user.Id, user.UserName ?? string.Empty, user.DisplayName ?? user.UserName ?? string.Empty,
            roles.ToList(), permissions, plantScopes, lineScopes,
            user.MustChangePassword,
            await _userManager.GetTwoFactorEnabledAsync(user),
            _security.IdleTimeoutMinutes);

        return new AuthResult(token, expires, info);
    }

    public async Task<UserInfo> BuildUserInfoAsync(AppUser user)
    {
        var roles = await _userManager.GetRolesAsync(user);
        var roleIds = await _db.Roles
            .Where(r => r.Name != null && roles.Contains(r.Name))
            .Select(r => r.Id)
            .ToListAsync();
        var permissions = await _db.RolePermissions
            .Where(rp => roleIds.Contains(rp.RoleId))
            .Join(_db.Permissions, rp => rp.PermissionId, p => p.Id, (rp, p) => p.Key)
            .Distinct()
            .ToListAsync();
        var plantScopes = await _db.UserPlantScopes
            .Where(s => s.UserId == user.Id)
            .Select(s => s.PlantId).Distinct().ToListAsync();
        var lineScopes = await _db.UserPlantScopes
            .Where(s => s.UserId == user.Id && s.LineId != null)
            .Select(s => s.LineId!.Value).Distinct().ToListAsync();
        return new UserInfo(
            user.Id, user.UserName ?? string.Empty, user.DisplayName ?? user.UserName ?? string.Empty,
            roles.ToList(), permissions, plantScopes, lineScopes,
            user.MustChangePassword,
            await _userManager.GetTwoFactorEnabledAsync(user),
            _security.IdleTimeoutMinutes);
    }
}

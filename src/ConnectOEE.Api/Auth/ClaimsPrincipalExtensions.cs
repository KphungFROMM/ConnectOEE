using System.Security.Claims;
using System.IdentityModel.Tokens.Jwt;

namespace ConnectOEE.Api.Auth;

public static class ClaimsPrincipalExtensions
{
    public static Guid? GetUserId(this ClaimsPrincipal user)
    {
        var sub = user.FindFirstValue(JwtRegisteredClaimNames.Sub)
                  ?? user.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(sub, out var id) ? id : null;
    }

    public static string? GetUserName(this ClaimsPrincipal user)
        => user.FindFirstValue(JwtRegisteredClaimNames.UniqueName)
           ?? user.Identity?.Name;

    public static IReadOnlyList<Guid> GetPlantScopes(this ClaimsPrincipal user)
        => user.FindAll(ConnectClaimTypes.PlantScope)
            .Select(c => Guid.TryParse(c.Value, out var g) ? g : Guid.Empty)
            .Where(g => g != Guid.Empty).ToList();

    public static IReadOnlyList<Guid> GetLineScopes(this ClaimsPrincipal user)
        => user.FindAll(ConnectClaimTypes.LineScope)
            .Select(c => Guid.TryParse(c.Value, out var g) ? g : Guid.Empty)
            .Where(g => g != Guid.Empty).ToList();
}

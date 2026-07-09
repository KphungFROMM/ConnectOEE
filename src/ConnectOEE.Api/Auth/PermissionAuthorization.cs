using ConnectOEE.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace ConnectOEE.Api.Auth;

/// <summary>Requires the caller to carry a specific permission claim.</summary>
public class PermissionRequirement : IAuthorizationRequirement
{
    public string Permission { get; }
    public PermissionRequirement(string permission) => Permission = permission;
}

public class PermissionHandler : AuthorizationHandler<PermissionRequirement>
{
    private readonly IServiceScopeFactory _scopeFactory;

    public PermissionHandler(IServiceScopeFactory scopeFactory) => _scopeFactory = scopeFactory;

    protected override async Task HandleRequirementAsync(
        AuthorizationHandlerContext context, PermissionRequirement requirement)
    {
        using var scope = _scopeFactory.CreateScope();
        var setup = scope.ServiceProvider.GetRequiredService<ISetupStateService>();
        if (await setup.NeedsSetupAsync())
        {
            context.Succeed(requirement);
            return;
        }

        if (context.User.HasClaim(ConnectClaimTypes.Permission, requirement.Permission))
            context.Succeed(requirement);
    }
}

/// <summary>
/// Authorize a controller/action by permission, e.g. [Authorize(Policy = "perm:plc.write")].
/// Use the HasPermission helper to avoid magic strings.
/// </summary>
public static class PermissionPolicy
{
    public const string Prefix = "perm:";
    public static string For(string permission) => Prefix + permission;
}

/// <summary>Builds permission policies on demand so we don't register one per key.</summary>
public class PermissionPolicyProvider : IAuthorizationPolicyProvider
{
    private readonly DefaultAuthorizationPolicyProvider _fallback;

    public PermissionPolicyProvider(IOptions<AuthorizationOptions> options)
        => _fallback = new DefaultAuthorizationPolicyProvider(options);

    public Task<AuthorizationPolicy> GetDefaultPolicyAsync() => _fallback.GetDefaultPolicyAsync();
    public Task<AuthorizationPolicy?> GetFallbackPolicyAsync() => _fallback.GetFallbackPolicyAsync();

    public Task<AuthorizationPolicy?> GetPolicyAsync(string policyName)
    {
        if (policyName.StartsWith(PermissionPolicy.Prefix, StringComparison.Ordinal))
        {
            var permission = policyName[PermissionPolicy.Prefix.Length..];
            var policy = new AuthorizationPolicyBuilder()
                .AddRequirements(new SetupOrAuthenticatedRequirement())
                .AddRequirements(new PermissionRequirement(permission))
                .Build();
            return Task.FromResult<AuthorizationPolicy?>(policy);
        }
        return _fallback.GetPolicyAsync(policyName);
    }
}

/// <summary>Convenience attribute: [HasPermission(PermissionKeys.PlcWrite)].</summary>
public sealed class HasPermissionAttribute : AuthorizeAttribute
{
    public HasPermissionAttribute(string permission) => Policy = PermissionPolicy.For(permission);
}

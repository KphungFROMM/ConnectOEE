using ConnectOEE.Api.Services;
using Microsoft.AspNetCore.Authorization;

namespace ConnectOEE.Api.Auth;

/// <summary>Allows anonymous access while no admin user exists (first-run setup).</summary>
public sealed class SetupOrAuthenticatedRequirement : IAuthorizationRequirement;

public class SetupOrAuthenticatedHandler : AuthorizationHandler<SetupOrAuthenticatedRequirement>
{
    private readonly ISetupStateService _setup;

    public SetupOrAuthenticatedHandler(ISetupStateService setup) => _setup = setup;

    protected override async Task HandleRequirementAsync(
        AuthorizationHandlerContext context, SetupOrAuthenticatedRequirement requirement)
    {
        if (context.User.Identity?.IsAuthenticated == true)
        {
            context.Succeed(requirement);
            return;
        }

        if (await _setup.NeedsSetupAsync())
            context.Succeed(requirement);
    }
}

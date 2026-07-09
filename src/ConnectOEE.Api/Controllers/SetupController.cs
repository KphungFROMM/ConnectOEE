using System.ComponentModel.DataAnnotations;
using ConnectOEE.Api.Auth;
using ConnectOEE.Api.Services;
using ConnectOEE.Core.Abstractions;
using ConnectOEE.Core.Entities.Security;
using ConnectOEE.Infrastructure.Seeding;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

namespace ConnectOEE.Api.Controllers;

[ApiController]
[Route("api/setup")]
public class SetupController : ControllerBase
{
    private readonly ISetupStateService _setup;
    private readonly UserManager<AppUser> _userManager;
    private readonly TokenService _tokenService;
    private readonly IAuditService _audit;
    private readonly ILogger<SetupController> _logger;

    public SetupController(
        ISetupStateService setup,
        UserManager<AppUser> userManager,
        TokenService tokenService,
        IAuditService audit,
        ILogger<SetupController> logger)
    {
        _setup = setup;
        _userManager = userManager;
        _tokenService = tokenService;
        _audit = audit;
        _logger = logger;
    }

    public record SetupStatus(bool NeedsSetup);

    public record BootstrapAdminRequest(
        [Required] string UserName,
        [Required] string Password,
        string? DisplayName);

    [HttpGet("status")]
    [AllowAnonymous]
    public async Task<ActionResult<SetupStatus>> Status(CancellationToken ct)
        => Ok(new SetupStatus(await _setup.NeedsSetupAsync(ct)));

    /// <summary>Wizard step 9 — create the first admin account and return a login token.</summary>
    [HttpPost("bootstrap-admin")]
    [AllowAnonymous]
    public async Task<ActionResult<AuthResult>> BootstrapAdmin([FromBody] BootstrapAdminRequest req, CancellationToken ct)
    {
        if (!await _setup.NeedsSetupAsync(ct))
            return BadRequest(new { message = "Setup is already complete. Sign in instead." });

        if (string.IsNullOrWhiteSpace(req.UserName) || string.IsNullOrWhiteSpace(req.Password))
            return BadRequest(new { message = "Username and password are required." });

        var user = new AppUser
        {
            UserName = req.UserName.Trim(),
            DisplayName = string.IsNullOrWhiteSpace(req.DisplayName) ? req.UserName.Trim() : req.DisplayName.Trim(),
            Email = $"{req.UserName.Trim()}@connectoee.local",
            IsActive = true,
        };

        var result = await _userManager.CreateAsync(user, req.Password);
        if (!result.Succeeded)
            return BadRequest(new { message = string.Join("; ", result.Errors.Select(e => e.Description)) });

        await _userManager.AddToRoleAsync(user, RoleNames.Admin);
        await DbSeeder.SeedCommissionUsersAsync(_userManager, _logger);
        await _audit.LogAsync("setup.bootstrap-admin", user.Id, user.UserName,
            entityType: nameof(AppUser), entityId: user.Id.ToString());

        var auth = await _tokenService.CreateTokenAsync(user);
        return Ok(auth);
    }
}

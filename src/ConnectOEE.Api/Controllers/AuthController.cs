using System.ComponentModel.DataAnnotations;
using ConnectOEE.Api.Auth;
using ConnectOEE.Core.Abstractions;
using ConnectOEE.Core.Entities.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Options;

namespace ConnectOEE.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly UserManager<AppUser> _userManager;
    private readonly TokenService _tokenService;
    private readonly RefreshTokenService _refreshTokens;
    private readonly IAuditService _audit;
    private readonly SecurityOptions _security;

    public AuthController(
        UserManager<AppUser> userManager,
        TokenService tokenService,
        RefreshTokenService refreshTokens,
        IAuditService audit,
        IOptions<SecurityOptions> security)
    {
        _userManager = userManager;
        _tokenService = tokenService;
        _refreshTokens = refreshTokens;
        _audit = audit;
        _security = security.Value;
    }

    public record LoginRequest([Required] string UserName, [Required] string Password);
    public record LoginTwoFactorRequest([Required] Guid UserId, [Required] string Password, [Required] string Code);
    public record ChangePasswordRequest([Required] string CurrentPassword, [Required] string NewPassword);
    public record ForceChangePasswordRequest([Required] Guid UserId, [Required] string CurrentPassword, [Required] string NewPassword);
    public record MfaEnableRequest([Required] string Code);
    public record MfaSetupResponse(string SharedKey, string AuthenticatorUri);
    public record LoginChallengeResponse(bool RequiresTwoFactor, bool MustChangePassword, Guid UserId, string? Message);

    [HttpGet("config")]
    [AllowAnonymous]
    public ActionResult<object> Config()
        => Ok(new { idleTimeoutMinutes = _security.IdleTimeoutMinutes });

    [HttpPost("login")]
    [AllowAnonymous]
    [EnableRateLimiting("auth")]
    public async Task<ActionResult<object>> Login([FromBody] LoginRequest request)
    {
        var user = await _userManager.FindByNameAsync(request.UserName);
        if (user is null || !user.IsActive)
        {
            await _audit.LogAsync("auth.login", null, request.UserName, result: "Failed");
            return Unauthorized(new { message = "Invalid credentials" });
        }

        if (await _userManager.IsLockedOutAsync(user))
        {
            await _audit.LogAsync("auth.lockout", user.Id, user.UserName, result: "Blocked");
            return StatusCode(429, new { message = "Account locked. Try again later." });
        }

        var passwordOk = await _userManager.CheckPasswordAsync(user, request.Password);
        if (!passwordOk)
        {
            await _userManager.AccessFailedAsync(user);
            await _audit.LogAsync("auth.login", user.Id, user.UserName, result: "Failed");
            return Unauthorized(new { message = "Invalid credentials" });
        }

        await _userManager.ResetAccessFailedCountAsync(user);

        if (user.MustChangePassword)
        {
            return Ok(new LoginChallengeResponse(false, true, user.Id, "Password change required"));
        }

        if (await _userManager.GetTwoFactorEnabledAsync(user))
        {
            return Ok(new LoginChallengeResponse(true, false, user.Id, "Two-factor code required"));
        }

        return Ok(await IssueSessionAsync(user));
    }

    [HttpPost("login-2fa")]
    [AllowAnonymous]
    [EnableRateLimiting("auth")]
    public async Task<ActionResult<AuthResult>> LoginTwoFactor([FromBody] LoginTwoFactorRequest request)
    {
        var user = await _userManager.FindByIdAsync(request.UserId.ToString());
        if (user is null || !user.IsActive)
            return Unauthorized(new { message = "Invalid credentials" });

        if (!await _userManager.CheckPasswordAsync(user, request.Password))
            return Unauthorized(new { message = "Invalid credentials" });

        var valid = await _userManager.VerifyTwoFactorTokenAsync(
            user, TokenOptions.DefaultAuthenticatorProvider, request.Code);
        if (!valid)
        {
            await _audit.LogAsync("auth.login-2fa", user.Id, user.UserName, result: "Failed");
            return Unauthorized(new { message = "Invalid authenticator code" });
        }

        if (user.MustChangePassword)
            return StatusCode(403, new { mustChangePassword = true, userId = user.Id });

        return Ok(await IssueSessionAsync(user));
    }

    [HttpPost("force-change-password")]
    [AllowAnonymous]
    [EnableRateLimiting("auth")]
    public async Task<IActionResult> ForceChangePassword([FromBody] ForceChangePasswordRequest request)
    {
        var user = await _userManager.FindByIdAsync(request.UserId.ToString());
        if (user is null || !user.IsActive || !user.MustChangePassword)
            return BadRequest(new { message = "Password change not required" });

        var result = await _userManager.ChangePasswordAsync(user, request.CurrentPassword, request.NewPassword);
        if (!result.Succeeded)
            return BadRequest(new { message = string.Join("; ", result.Errors.Select(e => e.Description)) });

        user.MustChangePassword = false;
        await _userManager.UpdateAsync(user);
        await _userManager.ResetAccessFailedCountAsync(user);
        await _audit.LogAsync("auth.password-change", user.Id, user.UserName, details: new { forced = true });
        return NoContent();
    }

    [HttpPost("change-password")]
    [Authorize]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest request)
    {
        var id = User.GetUserId();
        if (id is null) return Unauthorized();
        var user = await _userManager.FindByIdAsync(id.Value.ToString());
        if (user is null) return Unauthorized();

        var result = await _userManager.ChangePasswordAsync(user, request.CurrentPassword, request.NewPassword);
        if (!result.Succeeded)
            return BadRequest(new { message = string.Join("; ", result.Errors.Select(e => e.Description)) });

        user.MustChangePassword = false;
        await _userManager.UpdateAsync(user);
        await _audit.LogAsync("auth.password-change", user.Id, user.UserName);
        return NoContent();
    }

    [HttpPost("refresh")]
    [AllowAnonymous]
    [EnableRateLimiting("auth")]
    public async Task<ActionResult<AuthResult>> Refresh()
    {
        var raw = Request.Cookies[_security.RefreshCookieName];
        if (string.IsNullOrEmpty(raw))
            return Unauthorized(new { message = "No refresh token" });

        var stored = await _refreshTokens.ValidateAsync(raw);
        if (stored is null)
            return Unauthorized(new { message = "Invalid refresh token" });

        var user = await _userManager.FindByIdAsync(stored.UserId.ToString());
        if (user is null || !user.IsActive)
            return Unauthorized(new { message = "User inactive" });

        await _refreshTokens.RevokeAsync(raw, replacedByHash: null);
        return Ok(await IssueSessionAsync(user));
    }

    [HttpPost("logout")]
    [Authorize]
    public async Task<IActionResult> Logout()
    {
        var raw = Request.Cookies[_security.RefreshCookieName];
        if (!string.IsNullOrEmpty(raw))
            await _refreshTokens.RevokeAsync(raw);

        Response.Cookies.Delete(_security.RefreshCookieName);
        await _audit.LogAsync("auth.logout", User.GetUserId(), User.GetUserName());
        return NoContent();
    }

    [HttpGet("me")]
    [Authorize]
    public async Task<ActionResult<UserInfo>> Me()
    {
        var id = User.GetUserId();
        if (id is null) return Unauthorized();
        var user = await _userManager.FindByIdAsync(id.Value.ToString());
        if (user is null) return Unauthorized();
        return Ok(await _tokenService.BuildUserInfoAsync(user));
    }

    [HttpGet("mfa/setup")]
    [Authorize]
    public async Task<ActionResult<MfaSetupResponse>> MfaSetup()
    {
        var user = await GetCurrentUserAsync();
        if (user is null) return Unauthorized();

        var key = await _userManager.GetAuthenticatorKeyAsync(user);
        if (string.IsNullOrEmpty(key))
        {
            await _userManager.ResetAuthenticatorKeyAsync(user);
            key = await _userManager.GetAuthenticatorKeyAsync(user);
        }

        return Ok(new MfaSetupResponse(key!, GenerateAuthenticatorUri(user, key!)));
    }

    [HttpPost("mfa/enable")]
    [Authorize]
    public async Task<IActionResult> MfaEnable([FromBody] MfaEnableRequest request)
    {
        var user = await GetCurrentUserAsync();
        if (user is null) return Unauthorized();

        var valid = await _userManager.VerifyTwoFactorTokenAsync(
            user, TokenOptions.DefaultAuthenticatorProvider, request.Code);
        if (!valid)
            return BadRequest(new { message = "Invalid authenticator code" });

        await _userManager.SetTwoFactorEnabledAsync(user, true);
        await _audit.LogAsync("auth.mfa-enable", user.Id, user.UserName);
        return NoContent();
    }

    [HttpPost("mfa/disable")]
    [Authorize]
    public async Task<IActionResult> MfaDisable([FromBody] MfaEnableRequest request)
    {
        var user = await GetCurrentUserAsync();
        if (user is null) return Unauthorized();

        if (!await _userManager.GetTwoFactorEnabledAsync(user))
            return BadRequest(new { message = "MFA is not enabled" });

        var valid = await _userManager.VerifyTwoFactorTokenAsync(
            user, TokenOptions.DefaultAuthenticatorProvider, request.Code);
        if (!valid)
            return BadRequest(new { message = "Invalid authenticator code" });

        await _userManager.SetTwoFactorEnabledAsync(user, false);
        await _userManager.ResetAuthenticatorKeyAsync(user);
        await _audit.LogAsync("auth.mfa-disable", user.Id, user.UserName);
        return NoContent();
    }

    private async Task<AuthResult> IssueSessionAsync(AppUser user)
    {
        var auth = await _tokenService.CreateTokenAsync(user);
        var (raw, _) = await _refreshTokens.IssueAsync(user.Id);
        SetRefreshCookie(raw);
        await _audit.LogAsync("auth.login", user.Id, user.UserName, result: "Success");
        return auth;
    }

    private void SetRefreshCookie(string raw)
    {
        Response.Cookies.Append(_security.RefreshCookieName, raw, new CookieOptions
        {
            HttpOnly = true,
            Secure = Request.IsHttps,
            SameSite = SameSiteMode.Strict,
            Path = "/api/auth",
            MaxAge = TimeSpan.FromDays(_security.RefreshTokenDays),
        });
    }

    private async Task<AppUser?> GetCurrentUserAsync()
    {
        var id = User.GetUserId();
        if (id is null) return null;
        return await _userManager.FindByIdAsync(id.Value.ToString());
    }

    private static string GenerateAuthenticatorUri(AppUser user, string key)
    {
        var encodedKey = Uri.EscapeDataString(key);
        var label = Uri.EscapeDataString($"ConnectOEE:{user.UserName}");
        return $"otpauth://totp/{label}?secret={encodedKey}&issuer=ConnectOEE&digits=6";
    }
}

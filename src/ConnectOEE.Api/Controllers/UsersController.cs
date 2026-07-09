using ConnectOEE.Api.Auth;
using ConnectOEE.Core.Abstractions;
using ConnectOEE.Core.Entities;
using ConnectOEE.Core.Entities.Security;
using ConnectOEE.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ConnectOEE.Api.Controllers;

[ApiController]
[Route("api/users")]
[Authorize]
public class UsersController : ControllerBase
{
    private readonly UserManager<AppUser> _userManager;
    private readonly RoleManager<AppRole> _roleManager;
    private readonly ConnectOeeDbContext _db;
    private readonly IAuditService _audit;

    public UsersController(UserManager<AppUser> userManager, RoleManager<AppRole> roleManager, ConnectOeeDbContext db, IAuditService audit)
    {
        _userManager = userManager;
        _roleManager = roleManager;
        _db = db;
        _audit = audit;
    }

    public record UserDto(Guid Id, string UserName, string DisplayName, bool IsActive, IReadOnlyList<string> Roles, IReadOnlyList<ScopeDto> Scopes);
    public record ScopeDto(Guid PlantId, Guid? LineId);
    public record CreateUserRequest(string UserName, string Password, string DisplayName, IReadOnlyList<string> Roles);
    public record UpdateUserRequest(string? DisplayName, IReadOnlyList<string>? Roles);
    public record ResetPasswordRequest(string Password);
    public record SetScopesRequest(IReadOnlyList<ScopeDto> Scopes);
    public record SetActiveRequest(bool IsActive);

    [HttpGet]
    [HasPermission(PermissionKeys.ManageUsers)]
    public async Task<ActionResult<IEnumerable<UserDto>>> List()
    {
        var users = await _userManager.Users.OrderBy(u => u.UserName).ToListAsync();
        var result = new List<UserDto>();
        foreach (var u in users)
        {
            var roles = await _userManager.GetRolesAsync(u);
            var scopes = await _db.UserPlantScopes.Where(s => s.UserId == u.Id)
                .Select(s => new ScopeDto(s.PlantId, s.LineId)).ToListAsync();
            result.Add(new UserDto(u.Id, u.UserName ?? "", u.DisplayName ?? u.UserName ?? "", u.IsActive, roles.ToList(), scopes));
        }
        return Ok(result);
    }

    [HttpPost]
    [HasPermission(PermissionKeys.ManageUsers)]
    public async Task<ActionResult<UserDto>> Create([FromBody] CreateUserRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.UserName) || string.IsNullOrWhiteSpace(req.Password))
            return BadRequest(new { message = "UserName and Password are required" });

        var user = new AppUser { UserName = req.UserName.Trim(), DisplayName = req.DisplayName?.Trim() ?? req.UserName.Trim(), Email = $"{req.UserName.Trim()}@local" };
        var result = await _userManager.CreateAsync(user, req.Password);
        if (!result.Succeeded) return BadRequest(new { message = string.Join("; ", result.Errors.Select(e => e.Description)) });

        foreach (var role in req.Roles ?? Array.Empty<string>())
            if (await _roleManager.RoleExistsAsync(role))
                await _userManager.AddToRoleAsync(user, role);

        await _audit.LogAsync("user.create", User.GetUserId(), User.GetUserName(), entityType: nameof(AppUser), entityId: user.Id.ToString());
        return Ok(new UserDto(user.Id, user.UserName!, user.DisplayName!, user.IsActive, req.Roles?.ToList() ?? new List<string>(), Array.Empty<ScopeDto>()));
    }

    [HttpPut("{id:guid}")]
    [HasPermission(PermissionKeys.ManageUsers)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateUserRequest req)
    {
        var user = await _userManager.FindByIdAsync(id.ToString());
        if (user is null) return NotFound();

        if (!string.IsNullOrWhiteSpace(req.DisplayName))
            user.DisplayName = req.DisplayName.Trim();

        if (req.Roles is not null)
        {
            var currentRoles = (await _userManager.GetRolesAsync(user)).ToList();
            var wasAdmin = currentRoles.Contains(RoleNames.Admin);
            var willBeAdmin = req.Roles.Contains(RoleNames.Admin);
            if (wasAdmin && !willBeAdmin && await CountActiveAdminsAsync() <= 1)
                return BadRequest(new { message = "Cannot remove the last Admin account" });

            if (currentRoles.Count > 0)
                await _userManager.RemoveFromRolesAsync(user, currentRoles);
            foreach (var role in req.Roles.Distinct(StringComparer.OrdinalIgnoreCase))
                if (await _roleManager.RoleExistsAsync(role))
                    await _userManager.AddToRoleAsync(user, role);
        }

        await _userManager.UpdateAsync(user);
        await _audit.LogAsync("user.update", User.GetUserId(), User.GetUserName(), entityType: nameof(AppUser), entityId: id.ToString());
        return NoContent();
    }

    [HttpPut("{id:guid}/password")]
    [HasPermission(PermissionKeys.ManageUsers)]
    public async Task<IActionResult> ResetPassword(Guid id, [FromBody] ResetPasswordRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Password))
            return BadRequest(new { message = "Password is required" });

        var user = await _userManager.FindByIdAsync(id.ToString());
        if (user is null) return NotFound();

        var token = await _userManager.GeneratePasswordResetTokenAsync(user);
        var result = await _userManager.ResetPasswordAsync(user, token, req.Password);
        if (!result.Succeeded)
            return BadRequest(new { message = string.Join("; ", result.Errors.Select(e => e.Description)) });

        user.MustChangePassword = false;
        await _userManager.UpdateAsync(user);
        await _audit.LogAsync("user.password-reset", User.GetUserId(), User.GetUserName(), entityType: nameof(AppUser), entityId: id.ToString());
        return NoContent();
    }

    [HttpDelete("{id:guid}")]
    [HasPermission(PermissionKeys.ManageUsers)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var me = User.GetUserId();
        if (me == id)
            return BadRequest(new { message = "Cannot deactivate your own account" });

        var user = await _userManager.FindByIdAsync(id.ToString());
        if (user is null) return NotFound();

        var roles = await _userManager.GetRolesAsync(user);
        if (roles.Contains(RoleNames.Admin) && await CountActiveAdminsAsync() <= 1)
            return BadRequest(new { message = "Cannot deactivate the last Admin account" });

        user.IsActive = false;
        await _userManager.UpdateAsync(user);
        await _audit.LogAsync("user.deactivate", User.GetUserId(), User.GetUserName(), entityType: nameof(AppUser), entityId: id.ToString());
        return NoContent();
    }

    private async Task<int> CountActiveAdminsAsync()
        => (await _userManager.GetUsersInRoleAsync(RoleNames.Admin)).Count(u => u.IsActive);

    [HttpPut("{id:guid}/scopes")]
    [HasPermission(PermissionKeys.ManageUsers)]
    public async Task<IActionResult> SetScopes(Guid id, [FromBody] SetScopesRequest req)
    {
        var user = await _userManager.FindByIdAsync(id.ToString());
        if (user is null) return NotFound();
        var existing = await _db.UserPlantScopes.Where(s => s.UserId == id).ToListAsync();
        _db.UserPlantScopes.RemoveRange(existing);
        foreach (var s in req.Scopes ?? Array.Empty<ScopeDto>())
            _db.UserPlantScopes.Add(new UserPlantScope { UserId = id, PlantId = s.PlantId, LineId = s.LineId });
        await _db.SaveChangesAsync();
        await _audit.LogAsync("user.scopes", User.GetUserId(), User.GetUserName(), entityType: nameof(AppUser), entityId: id.ToString());
        return NoContent();
    }

    [HttpPut("{id:guid}/active")]
    [HasPermission(PermissionKeys.ManageUsers)]
    public async Task<IActionResult> SetActive(Guid id, [FromBody] SetActiveRequest req)
    {
        var user = await _userManager.FindByIdAsync(id.ToString());
        if (user is null) return NotFound();
        user.IsActive = req.IsActive;
        await _userManager.UpdateAsync(user);
        return NoContent();
    }
}

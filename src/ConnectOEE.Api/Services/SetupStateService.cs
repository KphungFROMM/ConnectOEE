using ConnectOEE.Core;
using ConnectOEE.Core.Entities.Security;
using ConnectOEE.Infrastructure;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace ConnectOEE.Api.Services;

public interface ISetupStateService
{
    Task<bool> NeedsSetupAsync(CancellationToken ct = default);
}

public class SetupStateService : ISetupStateService
{
    private readonly ConnectOeeDbContext _db;
    private readonly RoleManager<AppRole> _roleManager;

    public SetupStateService(ConnectOeeDbContext db, RoleManager<AppRole> roleManager)
    {
        _db = db;
        _roleManager = roleManager;
    }

    /// <summary>True until at least one Admin user exists (commission test users do not count).</summary>
    public async Task<bool> NeedsSetupAsync(CancellationToken ct = default)
    {
        var adminRole = await _roleManager.FindByNameAsync(RoleNames.Admin);
        if (adminRole is null) return true;
        return !await _db.UserRoles.AnyAsync(ur => ur.RoleId == adminRole.Id, ct);
    }
}

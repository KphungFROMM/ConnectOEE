using System.Security.Claims;
using ConnectOEE.Core.Entities.Security;
using ConnectOEE.Historian;
using ConnectOEE.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ConnectOEE.Api.Auth;

public interface IScopeAccessService
{
    bool HasUnrestrictedAccess(ClaimsPrincipal user);
    Task<bool> CanAccessLineAsync(ClaimsPrincipal user, Guid lineId, CancellationToken ct = default);
    Task<bool> CanAccessPlantAsync(ClaimsPrincipal user, Guid plantId, CancellationToken ct = default);
    Task<bool> CanAccessEntityAsync(ClaimsPrincipal user, EntityLevel level, Guid id, CancellationToken ct = default);
    Task<IReadOnlyList<Guid>> GetAccessibleLineIdsAsync(ClaimsPrincipal user, CancellationToken ct = default);
}

/// <summary>
/// Central plant/line scope enforcement. Empty scopes = unrestricted (typical Admin).
/// </summary>
public sealed class ScopeAccessService : IScopeAccessService
{
    private readonly ConnectOeeDbContext _db;

    public ScopeAccessService(ConnectOeeDbContext db) => _db = db;

    public bool HasUnrestrictedAccess(ClaimsPrincipal user)
    {
        if (user.IsInRole(RoleNames.Admin)) return true;
        return user.GetPlantScopes().Count == 0 && user.GetLineScopes().Count == 0;
    }

    public async Task<bool> CanAccessLineAsync(ClaimsPrincipal user, Guid lineId, CancellationToken ct = default)
    {
        if (HasUnrestrictedAccess(user)) return true;

        var lineScopes = user.GetLineScopes();
        if (lineScopes.Count > 0)
            return lineScopes.Contains(lineId);

        var plantScopes = user.GetPlantScopes();
        if (plantScopes.Count == 0) return true;

        var plantId = await _db.Lines.AsNoTracking()
            .Where(l => l.Id == lineId)
            .Select(l => l.Department != null ? l.Department.PlantId : Guid.Empty)
            .FirstOrDefaultAsync(ct);
        return plantId != Guid.Empty && plantScopes.Contains(plantId);
    }

    public async Task<bool> CanAccessPlantAsync(ClaimsPrincipal user, Guid plantId, CancellationToken ct = default)
    {
        if (HasUnrestrictedAccess(user)) return true;

        var plantScopes = user.GetPlantScopes();
        if (plantScopes.Count > 0)
            return plantScopes.Contains(plantId);

        var lineScopes = user.GetLineScopes();
        if (lineScopes.Count == 0) return true;

        var linePlantIds = await _db.Lines.AsNoTracking()
            .Where(l => lineScopes.Contains(l.Id) && l.Department != null)
            .Select(l => l.Department!.PlantId)
            .Distinct()
            .ToListAsync(ct);
        return linePlantIds.Contains(plantId);
    }

    public async Task<bool> CanAccessEntityAsync(ClaimsPrincipal user, EntityLevel level, Guid id, CancellationToken ct = default)
    {
        if (HasUnrestrictedAccess(user)) return true;

        return level switch
        {
            EntityLevel.Plant => await CanAccessPlantAsync(user, id, ct),
            EntityLevel.Department => await CanAccessDepartmentAsync(user, id, ct),
            EntityLevel.Line => await CanAccessLineAsync(user, id, ct),
            EntityLevel.Machine => await CanAccessMachineAsync(user, id, ct),
            _ => false,
        };
    }

    public async Task<IReadOnlyList<Guid>> GetAccessibleLineIdsAsync(ClaimsPrincipal user, CancellationToken ct = default)
    {
        if (HasUnrestrictedAccess(user))
        {
            return await _db.Lines.AsNoTracking().Select(l => l.Id).ToListAsync(ct);
        }

        var lineScopes = user.GetLineScopes();
        if (lineScopes.Count > 0)
            return lineScopes.ToList();

        var plantScopes = user.GetPlantScopes();
        if (plantScopes.Count == 0)
            return await _db.Lines.AsNoTracking().Select(l => l.Id).ToListAsync(ct);

        return await _db.Lines.AsNoTracking()
            .Where(l => l.Department != null && plantScopes.Contains(l.Department.PlantId))
            .Select(l => l.Id)
            .ToListAsync(ct);
    }

    private async Task<bool> CanAccessDepartmentAsync(ClaimsPrincipal user, Guid departmentId, CancellationToken ct)
    {
        var plantId = await _db.Departments.AsNoTracking()
            .Where(d => d.Id == departmentId)
            .Select(d => d.PlantId)
            .FirstOrDefaultAsync(ct);
        return plantId != Guid.Empty && await CanAccessPlantAsync(user, plantId, ct);
    }

    private async Task<bool> CanAccessMachineAsync(ClaimsPrincipal user, Guid machineId, CancellationToken ct)
    {
        var lineId = await _db.Machines.AsNoTracking()
            .Where(m => m.Id == machineId)
            .Select(m => m.LineId)
            .FirstOrDefaultAsync(ct);
        return lineId != Guid.Empty && await CanAccessLineAsync(user, lineId, ct);
    }
}

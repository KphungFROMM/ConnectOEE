using ConnectOEE.Api.Auth;
using ConnectOEE.Api.Live;
using ConnectOEE.Core;
using ConnectOEE.Core.Abstractions;
using ConnectOEE.Core.Entities;
using ConnectOEE.Core.Entities.Security;
using ConnectOEE.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace ConnectOEE.Api.Controllers;

[ApiController]
[Route("api/recipes")]
[Authorize]
public class RecipesController : ControllerBase
{
    private readonly ConnectOeeDbContext _db;
    private readonly IAuditService _audit;
    private readonly RecipeResolverService _recipes;
    private readonly ChangeoverService _changeover;
    private readonly IShiftResolver _shiftResolver;
    private readonly IHubContext<LiveHub> _hub;

    public RecipesController(
        ConnectOeeDbContext db,
        IAuditService audit,
        RecipeResolverService recipes,
        ChangeoverService changeover,
        IShiftResolver shiftResolver,
        IHubContext<LiveHub> hub)
    {
        _db = db;
        _audit = audit;
        _recipes = recipes;
        _changeover = changeover;
        _shiftResolver = shiftResolver;
        _hub = hub;
    }

    public record RecipeDto(Guid Id, Guid? LineId, string Code, string Name, string? PlcAlias, double IdealCycleTimeSec, double? TargetQuantity, bool IsActive, bool IsAutoCreated);
    public record LineRateDto(Guid ProductRecipeId, string Code, string Name, double DefaultCycleSec, double EffectiveCycleSec, double? TargetQuantity, bool HasLineOverride, bool IsAutoCreated);
    public record SaveRecipeRequest(Guid? LineId, string Code, string Name, string? PlcAlias, double IdealCycleTimeSec, double? TargetQuantity, bool? IsActive);
    public record SaveLineRateRequest(double IdealCycleTimeSec, double? TargetQuantity);
    public record SelectRecipeRequest(Guid? RecipeId);

    [HttpGet]
    public async Task<ActionResult<IEnumerable<RecipeDto>>> List([FromQuery] Guid? lineId, [FromQuery] bool? autoCreatedOnly)
    {
        var q = _db.ProductRecipes.AsNoTracking().AsQueryable();
        if (autoCreatedOnly == true) q = q.Where(r => r.IsAutoCreated);
        else q = q.Where(r => r.IsActive);
        var items = await q.OrderBy(r => r.Code).ToListAsync();
        return Ok(items.Select(r => new RecipeDto(r.Id, r.LineId, r.Code, r.Name, r.PlcAlias, r.IdealCycleTimeSec, r.TargetQuantity, r.IsActive, r.IsAutoCreated)));
    }

    [HttpGet("lines/{lineId:guid}/rates")]
    [HasPermission(PermissionKeys.ViewPlantExplorer)]
    public async Task<ActionResult<IEnumerable<LineRateDto>>> LineRates(Guid lineId)
    {
        if (!await _db.Lines.AnyAsync(l => l.Id == lineId)) return NotFound();

        var recipes = await _db.ProductRecipes.AsNoTracking()
            .Where(r => r.IsActive)
            .OrderBy(r => r.Code)
            .ToListAsync();
        var rates = await _db.LineProductRates.AsNoTracking()
            .Where(r => r.LineId == lineId)
            .ToDictionaryAsync(r => r.ProductRecipeId);

        return Ok(recipes.Select(r =>
        {
            rates.TryGetValue(r.Id, out var rate);
            var effective = rate?.IdealCycleTimeSec ?? r.IdealCycleTimeSec;
            return new LineRateDto(
                r.Id, r.Code, r.Name, r.IdealCycleTimeSec, effective,
                rate?.TargetQuantity ?? r.TargetQuantity, rate is not null, r.IsAutoCreated);
        }));
    }

    [HttpPut("lines/{lineId:guid}/rates/{recipeId:guid}")]
    [HasPermission(PermissionKeys.ManageProducts)]
    public async Task<IActionResult> UpsertLineRate(Guid lineId, Guid recipeId, [FromBody] SaveLineRateRequest req)
    {
        if (!await _db.Lines.AnyAsync(l => l.Id == lineId)) return NotFound();
        if (!await _db.ProductRecipes.AnyAsync(r => r.Id == recipeId)) return NotFound();

        var row = await _db.LineProductRates.FirstOrDefaultAsync(r => r.LineId == lineId && r.ProductRecipeId == recipeId);
        if (row is null)
        {
            row = new LineProductRate { LineId = lineId, ProductRecipeId = recipeId };
            _db.LineProductRates.Add(row);
        }
        row.IdealCycleTimeSec = req.IdealCycleTimeSec <= 0 ? 2.0 : req.IdealCycleTimeSec;
        row.TargetQuantity = req.TargetQuantity;
        row.UpdatedUtc = DateTimeOffset.UtcNow;

        var recipe = await _db.ProductRecipes.FirstAsync(r => r.Id == recipeId);
        if (recipe.IsAutoCreated)
        {
            recipe.IsAutoCreated = false;
            recipe.UpdatedUtc = DateTimeOffset.UtcNow;
        }

        await _db.SaveChangesAsync();
        _recipes.InvalidateCatalog();
        await _audit.LogAsync("recipe.line-rate", User.GetUserId(), User.GetUserName(),
            entityType: nameof(LineProductRate), entityId: row.Id.ToString(),
            details: new { lineId, recipeId, row.IdealCycleTimeSec });
        return NoContent();
    }

    [HttpPost]
    [HasPermission(PermissionKeys.ManageProducts)]
    public async Task<ActionResult<RecipeDto>> Create([FromBody] SaveRecipeRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Code)) return BadRequest(new { message = "Code is required" });
        var r = new ProductRecipe
        {
            LineId = null,
            Code = req.Code.Trim(),
            Name = string.IsNullOrWhiteSpace(req.Name) ? req.Code.Trim() : req.Name.Trim(),
            PlcAlias = req.PlcAlias?.Trim(),
            IdealCycleTimeSec = req.IdealCycleTimeSec <= 0 ? 2.0 : req.IdealCycleTimeSec,
            TargetQuantity = req.TargetQuantity,
            IsActive = req.IsActive ?? true,
        };
        _db.ProductRecipes.Add(r);
        await _db.SaveChangesAsync();
        _recipes.InvalidateCatalog();
        await _audit.LogAsync("recipe.create", User.GetUserId(), User.GetUserName(), entityType: nameof(ProductRecipe), entityId: r.Id.ToString());
        return Ok(new RecipeDto(r.Id, r.LineId, r.Code, r.Name, r.PlcAlias, r.IdealCycleTimeSec, r.TargetQuantity, r.IsActive, r.IsAutoCreated));
    }

    [HttpPut("{id:guid}")]
    [HasPermission(PermissionKeys.ManageProducts)]
    public async Task<IActionResult> Update(Guid id, [FromBody] SaveRecipeRequest req)
    {
        var r = await _db.ProductRecipes.FirstOrDefaultAsync(x => x.Id == id);
        if (r is null) return NotFound();
        r.LineId = null;
        r.Code = req.Code.Trim();
        r.Name = req.Name.Trim();
        r.PlcAlias = req.PlcAlias?.Trim();
        r.IdealCycleTimeSec = req.IdealCycleTimeSec;
        r.TargetQuantity = req.TargetQuantity;
        if (req.IsActive.HasValue) r.IsActive = req.IsActive.Value;
        r.IsAutoCreated = false;
        r.UpdatedUtc = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync();
        _recipes.InvalidateCatalog();
        return NoContent();
    }

    [HttpDelete("{id:guid}")]
    [HasPermission(PermissionKeys.ManageProducts)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var r = await _db.ProductRecipes.FirstOrDefaultAsync(x => x.Id == id);
        if (r is null) return NotFound();
        _db.ProductRecipes.Remove(r);
        await _db.SaveChangesAsync();
        _recipes.InvalidateCatalog();
        return NoContent();
    }

    [HttpPost("lines/{lineId:guid}/select")]
    [HasPermission(PermissionKeys.SelectProduct)]
    public async Task<IActionResult> SelectForLine(Guid lineId, [FromBody] SelectRecipeRequest req)
    {
        var machines = await _db.Machines.Where(m => m.LineId == lineId).OrderBy(m => m.SequenceIndex).ToListAsync();
        if (machines.Count == 0) return NotFound();

        if (await HasPlcPartIdOverrideAsync(machines[0].Id))
            return BadRequest(new { message = "PLC PartId is driving the active product on this line." });

        foreach (var m in machines)
        {
            var state = await _db.MachineProductionStates.FirstOrDefaultAsync(s => s.MachineId == m.Id);
            if (state is null)
            {
                state = new MachineProductionState { MachineId = m.Id, LineId = lineId };
                _db.MachineProductionStates.Add(state);
            }
            state.SoftwareRecipeId = req.RecipeId;
            state.UpdatedUtc = DateTimeOffset.UtcNow;
        }

        var ts = DateTimeOffset.UtcNow;
        var primary = machines[0].Id;
        var result = await ApplySelectionAsync(primary, lineId, req.RecipeId, ts);
        await _audit.LogAsync("recipe.select.line", User.GetUserId(), User.GetUserName(),
            entityType: nameof(Line), entityId: lineId.ToString(), details: new { req.RecipeId });
        return Ok(new { result.Context.RecipeCode, result.Context.IdealCycleSec });
    }

    [HttpPost("machines/{machineId:guid}/select")]
    [HasPermission(PermissionKeys.SelectProduct)]
    public async Task<IActionResult> SelectForMachine(Guid machineId, [FromBody] SelectRecipeRequest req)
    {
        var machine = await _db.Machines.AsNoTracking().FirstOrDefaultAsync(m => m.Id == machineId);
        if (machine is null) return NotFound();

        if (await HasPlcPartIdOverrideAsync(machineId))
            return BadRequest(new { message = "PLC PartId is driving the active product on this machine." });

        var state = await _db.MachineProductionStates.FirstOrDefaultAsync(s => s.MachineId == machineId);
        if (state is null)
        {
            state = new MachineProductionState { MachineId = machineId, LineId = machine.LineId };
            _db.MachineProductionStates.Add(state);
        }
        state.SoftwareRecipeId = req.RecipeId;
        state.UpdatedUtc = DateTimeOffset.UtcNow;

        var ts = DateTimeOffset.UtcNow;
        var result = await ApplySelectionAsync(machineId, machine.LineId, req.RecipeId, ts);
        await _audit.LogAsync("recipe.select", User.GetUserId(), User.GetUserName(),
            entityType: nameof(Machine), entityId: machineId.ToString(), details: new { req.RecipeId });
        return Ok(new { result.Context.RecipeCode, result.Context.IdealCycleSec });
    }

    private async Task<RecipeResolverService.ResolveResult> ApplySelectionAsync(
        Guid machineId, Guid lineId, Guid? recipeId, DateTimeOffset ts)
    {
        var shift = await _shiftResolver.ResolveAsync(lineId, ts, HttpContext.RequestAborted);
        var result = await _recipes.ApplyManualSelectionAsync(_db, machineId, lineId, recipeId, ts, HttpContext.RequestAborted);

        if (result.RunToClose is not null) _db.ProductionRuns.Update(result.RunToClose);
        if (result.RunToAdd is not null) _db.ProductionRuns.Add(result.RunToAdd);

        if (result.RecipeChanged)
        {
            var lineCfg = await _db.OeeConfigs.AsNoTracking().FirstOrDefaultAsync(o => o.LineId == lineId);
            if ((lineCfg?.ChangeoverMode ?? ChangeoverMode.SetupTracked) == ChangeoverMode.SetupTracked)
            {
                var changeover = _changeover.StartChangeover(
                    lineId, machineId, shift.Id, result.PreviousRecipeCode, result.Context.RecipeCode, ts);
                if (changeover is not null) _db.DowntimeEvents.Add(changeover);
            }
        }

        await _db.SaveChangesAsync();
        _recipes.InvalidateCatalog();

        if (result.RecipeChanged)
            await _hub.Clients.Group(LiveHub.LineGroup(lineId)).SendAsync("recipeChanged", lineId);

        return result;
    }

    private async Task<bool> HasPlcPartIdOverrideAsync(Guid machineId)
    {
        var signalIds = await _db.LogicalSignals.AsNoTracking()
            .Where(s => s.MachineId == machineId && s.Role == SignalRole.PartId)
            .Select(s => s.Id)
            .ToListAsync();
        if (signalIds.Count == 0) return false;
        return await _db.TagMappings.AnyAsync(m => signalIds.Contains(m.LogicalSignalId));
    }
}

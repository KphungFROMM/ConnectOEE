using ConnectOEE.Api.Auth;
using ConnectOEE.Api.Live;
using ConnectOEE.Api.Services;
using ConnectOEE.Core;
using ConnectOEE.Core.Abstractions;
using ConnectOEE.Core.Entities;
using ConnectOEE.Core.Entities.Security;
using ConnectOEE.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ConnectOEE.Api.Controllers;

/// <summary>
/// Scope-aware plant hierarchy for the Plant Explorer tree + hierarchy admin CRUD
/// (used by both the standalone admin screens and the startup wizard). Node KPIs/status
/// come from the live snapshot cache (machine level), rolled up for line/dept/plant.
/// </summary>
[ApiController]
[Route("api/hierarchy")]
[Authorize]
public class HierarchyController : ControllerBase
{
    private readonly ConnectOeeDbContext _db;
    private readonly SnapshotCache _cache;
    private readonly ChangeoverService _changeover;
    private readonly IAuditService _audit;
    private readonly HierarchyDeleteGuardService _deleteGuard;

    public HierarchyController(
        ConnectOeeDbContext db,
        SnapshotCache cache,
        ChangeoverService changeover,
        IAuditService audit,
        HierarchyDeleteGuardService deleteGuard)
    {
        _db = db;
        _cache = cache;
        _changeover = changeover;
        _audit = audit;
        _deleteGuard = deleteGuard;
    }

    public record NodeKpi(double OeePct, double AvailabilityPct, double PerformancePct, double QualityPct,
        long GoodCount, long RejectCount, string Status, string ConnectionState,
        string? ActiveRecipeCode, string? ActiveRecipeName, double IdealCycleTimeSec, double ActualCycleTimeSec,
        double ActualRatePph, double IdealRatePph, bool RecipeIsAutoCreated);
    public record MachineNode(Guid Id, string Name, NodeKpi Kpi, string? State, int? FaultCode, double Speed);
    public record LineNode(Guid Id, string Name, NodeKpi Kpi, List<MachineNode> Machines, string? ActiveProductCode);
    public record DeptNode(Guid Id, string Name, NodeKpi Kpi, List<LineNode> Lines);
    public record PlantNode(Guid Id, string Name, NodeKpi Kpi, List<DeptNode> Departments);

    [HttpGet("tree")]
    [HasPermission(PermissionKeys.ViewPlantExplorer)]
    public Task<ActionResult<IEnumerable<PlantNode>>> Tree() => BuildTreeAsync();

    /// <summary>Scope-aware hierarchy for Operator Station (operators lack Plant Explorer permission).</summary>
    [HttpGet("stations")]
    [HasPermission(PermissionKeys.EnterDowntimeReason)]
    public Task<ActionResult<IEnumerable<PlantNode>>> OperatorStations() => BuildTreeAsync();

    private async Task<ActionResult<IEnumerable<PlantNode>>> BuildTreeAsync()
    {
        var scopes = User.GetPlantScopes();
        var lineScopes = User.GetLineScopes();

        var plantsQuery = _db.Plants.AsNoTracking()
            .Include(p => p.Departments).ThenInclude(d => d.Lines).ThenInclude(l => l.Machines)
            .AsQueryable();
        if (scopes.Count > 0) plantsQuery = plantsQuery.Where(p => scopes.Contains(p.Id));

        var plants = await plantsQuery.OrderBy(p => p.Name).ToListAsync();

        var result = plants.Select(p =>
        {
            var depts = p.Departments.OrderBy(d => d.Name).Select(d =>
            {
                var lines = d.Lines.OrderBy(l => l.Name)
                    .Where(l => lineScopes.Count == 0 || lineScopes.Contains(l.Id))
                    .Select(l =>
                {
                    var machines = l.Machines.OrderBy(m => m.SequenceIndex).Select(m =>
                    {
                        var snap = _cache.All().FirstOrDefault(s => s.MachineId == m.Id);
                        return new MachineNode(m.Id, m.Name, KpiFromSnapshot(snap), snap?.State, snap?.FaultCode, snap?.ActualRatePph ?? 0);
                    }).ToList();
                    var productCode = machines.Select(m => m.Kpi.ActiveRecipeCode).FirstOrDefault(c => !string.IsNullOrWhiteSpace(c));
                    return new LineNode(l.Id, l.Name, RollUp(machines.Select(x => x.Kpi)), machines, productCode);
                }).ToList();
                return new DeptNode(d.Id, d.Name, RollUp(lines.Select(x => x.Kpi)), lines);
            }).Where(d => d.Lines.Count > 0).ToList();
            return new PlantNode(p.Id, p.Name, RollUp(depts.Select(x => x.Kpi)), depts);
        }).Where(p => p.Departments.Count > 0).ToList();

        return Ok(result);
    }

    private static NodeKpi KpiFromSnapshot(MachineSnapshot? s)
    {
        if (s is null) return new NodeKpi(0, 0, 0, 0, 0, 0, "Unknown", "Disconnected", null, null, 0, 0, 0, 0, false);
        return new NodeKpi(s.OeePct, s.AvailabilityPct, s.PerformancePct, s.QualityPct,
            s.GoodCount, s.RejectCount, s.State, s.ConnectionState,
            s.ActiveRecipeCode, s.ActiveRecipeName, s.IdealCycleTimeSec, s.ActualCycleTimeSec,
            s.ActualRatePph, s.IdealRatePph, s.RecipeIsAutoCreated);
    }

    /// <summary>Rolls child KPIs up: averaged A/P, quality from summed counts, OEE = A×P×Q.</summary>
    private static NodeKpi RollUp(IEnumerable<NodeKpi> children)
    {
        var list = children.ToList();
        if (list.Count == 0) return new NodeKpi(0, 0, 0, 0, 0, 0, "Unknown", "Disconnected", null, null, 0, 0, 0, 0, false);

        var good = list.Sum(c => c.GoodCount);
        var reject = list.Sum(c => c.RejectCount);
        var availability = Math.Round(list.Average(c => c.AvailabilityPct), 2);
        var performance = Math.Round(list.Average(c => c.PerformancePct), 2);
        var totalPieces = good + reject;
        var quality = totalPieces > 0
            ? Math.Round(good * 100.0 / totalPieces, 2)
            : Math.Round(list.Average(c => c.QualityPct), 2);
        var oee = Math.Round(availability * performance * quality / 10000.0, 2);

        return new NodeKpi(
            oee,
            availability,
            performance,
            quality,
            good,
            reject,
            WorstStatus(list.Select(c => c.Status)),
            list.Any(c => c.ConnectionState == "Connected") ? "Connected" : "Disconnected",
            list.Select(c => c.ActiveRecipeCode).FirstOrDefault(c => !string.IsNullOrWhiteSpace(c)),
            list.Select(c => c.ActiveRecipeName).FirstOrDefault(c => !string.IsNullOrWhiteSpace(c)),
            Math.Round(list.Where(c => c.IdealCycleTimeSec > 0).Select(c => c.IdealCycleTimeSec).DefaultIfEmpty(0).Average(), 2),
            Math.Round(list.Where(c => c.ActualCycleTimeSec > 0).Select(c => c.ActualCycleTimeSec).DefaultIfEmpty(0).Average(), 2),
            Math.Round(list.Average(c => c.ActualRatePph), 2),
            Math.Round(list.Average(c => c.IdealRatePph), 2),
            list.Any(c => c.RecipeIsAutoCreated));
    }

    public record ProductionContextDto(
        string? ActiveRecipeCode,
        string? ActiveRecipeName,
        Guid? ActiveRecipeId,
        double IdealCycleTimeSec,
        string IdealCycleSource,
        double? TargetQuantity,
        string ProductSource,
        bool PlcPartIdMapped,
        bool RecipeIsAutoCreated,
        bool ChangeoverOpen,
        string? ChangeoverReason,
        DateTimeOffset? ProductionRunStartUtc,
        int AutoCreatedProductCount,
        ChangeoverMode ChangeoverMode,
        IReadOnlyList<ProductChangeLogDto> RecentProductChanges);

    public record ProductChangeLogDto(string? FromProductId, string ToProductId, DateTimeOffset ChangedUtc);

    [HttpGet("lines/{lineId:guid}/production-context")]
    [HasPermission(PermissionKeys.ViewPlantExplorer)]
    public async Task<ActionResult<ProductionContextDto>> ProductionContext(Guid lineId)
    {
        if (!await _db.Lines.AnyAsync(l => l.Id == lineId)) return NotFound();

        var snap = _cache.All().FirstOrDefault(s => s.LineId == lineId);
        var state = await _db.MachineProductionStates.AsNoTracking()
            .Where(s => s.LineId == lineId)
            .OrderBy(s => s.MachineId)
            .FirstOrDefaultAsync();

        var openRun = await _db.ProductionRuns.AsNoTracking()
            .Where(r => r.LineId == lineId && r.EndUtc == null)
            .OrderByDescending(r => r.StartUtc)
            .FirstOrDefaultAsync();

        var machineId = await _db.Machines.Where(m => m.LineId == lineId).OrderBy(m => m.SequenceIndex)
            .Select(m => m.Id).FirstOrDefaultAsync();
        var plcMapped = machineId != Guid.Empty && await _db.TagMappings.AnyAsync(m =>
            _db.LogicalSignals.Any(s => s.Id == m.LogicalSignalId && s.MachineId == machineId && s.Role == SignalRole.PartId));

        var changeoverOpen = _changeover.HasOpenChangeover(lineId);
        DowntimeEvent? changeoverEv = null;
        var lineOee = await _db.OeeConfigs.AsNoTracking().FirstOrDefaultAsync(o => o.LineId == lineId);
        var changeoverMode = lineOee?.ChangeoverMode ?? ChangeoverMode.SetupTracked;
        if (changeoverOpen && changeoverMode == ChangeoverMode.SetupTracked)
        {
            var evId = _changeover.GetOpenChangeoverId(lineId);
            if (evId is Guid id)
                changeoverEv = await _db.DowntimeEvents.AsNoTracking().FirstOrDefaultAsync(e => e.Id == id);
        }
        else
        {
            changeoverOpen = false;
        }

        var recentRuns = await _db.ProductionRuns.AsNoTracking()
            .Where(r => r.LineId == lineId)
            .OrderByDescending(r => r.StartUtc)
            .Take(6)
            .ToListAsync();
        var recentChanges = new List<ProductChangeLogDto>();
        for (var i = 0; i < recentRuns.Count - 1; i++)
        {
            var current = recentRuns[i];
            var previous = recentRuns[i + 1];
            if (string.IsNullOrWhiteSpace(current.ProductId)) continue;
            recentChanges.Add(new ProductChangeLogDto(previous.ProductId, current.ProductId!, current.StartUtc));
        }
        if (recentChanges.Count > 5) recentChanges = recentChanges.Take(5).ToList();

        var autoCount = await _db.ProductRecipes.CountAsync(r => r.IsAutoCreated && r.IsActive);

        var productSource = plcMapped ? "plc"
            : state?.SoftwareRecipeId is not null ? "manual"
            : snap?.RecipeIsAutoCreated == true ? "auto"
            : "none";

        var ctx = new ProductionContextDto(
            snap?.ActiveRecipeCode ?? state?.ActiveRecipeCode ?? openRun?.ProductId,
            snap?.ActiveRecipeName,
            state?.ActiveRecipeId,
            snap?.IdealCycleTimeSec ?? 0,
            snap?.IdealCycleSource ?? "line-default",
            openRun?.TargetQuantity,
            productSource,
            plcMapped,
            snap?.RecipeIsAutoCreated ?? false,
            changeoverOpen,
            changeoverEv?.Reason,
            openRun?.StartUtc,
            autoCount,
            changeoverMode,
            recentChanges);

        return Ok(ctx);
    }

    private static string WorstStatus(IEnumerable<string> statuses)
    {
        var set = statuses.ToHashSet();
        if (set.Contains("Down") || set.Contains("Setup")) return "Down";
        if (set.Contains("Idle") || set.Contains("Starved") || set.Contains("Blocked")) return "Idle";
        if (set.Contains("PlannedDown")) return "PlannedDown";
        if (set.Contains("Running")) return "Running";
        return "Unknown";
    }

    // ---------------- Hierarchy admin CRUD (wizard + admin screens) ----------------

    public record CreateDepartmentRequest(Guid PlantId, string Name);
    public record CreateLineRequest(Guid DepartmentId, string Name, double? IdealRatePerHour, double? IdealCycleTimeSec, double? TargetOeePct, int? MicroStopThresholdSec);
    public record CreateMachineRequest(Guid LineId, string Name, int? SequenceIndex);
    public record OeeConfigDto(
        double IdealRatePerHour,
        double IdealCycleTimeSec,
        double TargetOeePct,
        double TargetAvailabilityPct,
        double TargetPerformancePct,
        double TargetQualityPct,
        int MicroStopThresholdSec,
        LineProductionMode ProductionMode,
        ChangeoverMode ChangeoverMode,
        ReworkTrackingMode ReworkTracking);
    public record OeeConfigRequest(
        double IdealRatePerHour,
        double? IdealCycleTimeSec,
        double? TargetOeePct,
        double? TargetAvailabilityPct,
        double? TargetPerformancePct,
        double? TargetQualityPct,
        int? MicroStopThresholdSec,
        LineProductionMode? ProductionMode,
        ChangeoverMode? ChangeoverMode,
        ReworkTrackingMode? ReworkTracking);
    public record IdResult(Guid Id);

    [HttpPost("departments")]
    [HasPermission(PermissionKeys.ManageHierarchy)]
    public async Task<ActionResult<IdResult>> CreateDepartment([FromBody] CreateDepartmentRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Name)) return BadRequest(new { message = "Name is required" });
        if (!await _db.Plants.AnyAsync(p => p.Id == req.PlantId)) return BadRequest(new { message = "Plant not found" });

        var dept = new Department { Name = req.Name.Trim(), PlantId = req.PlantId };
        _db.Departments.Add(dept);
        await _db.SaveChangesAsync();
        await _audit.LogAsync("department.create", User.GetUserId(), User.GetUserName(), entityType: nameof(Department), entityId: dept.Id.ToString(), details: new { dept.Name });
        return Ok(new IdResult(dept.Id));
    }

    [HttpPost("lines")]
    [HasPermission(PermissionKeys.ManageHierarchy)]
    public async Task<ActionResult<IdResult>> CreateLine([FromBody] CreateLineRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Name)) return BadRequest(new { message = "Name is required" });
        if (!await _db.Departments.AnyAsync(d => d.Id == req.DepartmentId)) return BadRequest(new { message = "Department not found" });

        var rate = req.IdealRatePerHour ?? 1800;
        var line = new Line
        {
            Name = req.Name.Trim(),
            DepartmentId = req.DepartmentId,
            OeeConfig = new OeeConfig
            {
                IdealRatePerHour = rate,
                IdealCycleTimeSec = req.IdealCycleTimeSec ?? (rate > 0 ? 3600.0 / rate : 2.0),
                TargetOeePct = req.TargetOeePct ?? 85,
                MicroStopThresholdSec = req.MicroStopThresholdSec ?? 120,
            },
        };
        _db.Lines.Add(line);
        await _db.SaveChangesAsync();
        await _audit.LogAsync("line.create", User.GetUserId(), User.GetUserName(), entityType: nameof(Line), entityId: line.Id.ToString(), details: new { line.Name });
        return Ok(new IdResult(line.Id));
    }

    [HttpGet("lines/{id:guid}/oee")]
    [HasPermission(PermissionKeys.ManageHierarchy)]
    public async Task<ActionResult<OeeConfigDto>> GetLineOee(Guid id)
    {
        if (!await _db.Lines.AnyAsync(l => l.Id == id)) return NotFound();

        var cfg = await _db.OeeConfigs.AsNoTracking().FirstOrDefaultAsync(o => o.LineId == id);
        if (cfg is null)
            return Ok(new OeeConfigDto(1800, 2.0, 85, 90, 95, 99, 120, LineProductionMode.MultiProduct, ChangeoverMode.SetupTracked, ReworkTrackingMode.Auto));

        return Ok(new OeeConfigDto(
            cfg.IdealRatePerHour,
            cfg.IdealCycleTimeSec,
            cfg.TargetOeePct,
            cfg.TargetAvailabilityPct,
            cfg.TargetPerformancePct,
            cfg.TargetQualityPct,
            cfg.MicroStopThresholdSec,
            cfg.ProductionMode,
            cfg.ChangeoverMode,
            cfg.ReworkTracking));
    }

    [HttpPut("lines/{id:guid}/oee")]
    [HasPermission(PermissionKeys.ManageHierarchy)]
    public async Task<IActionResult> UpdateOee(Guid id, [FromBody] OeeConfigRequest req)
    {
        var cfg = await _db.OeeConfigs.FirstOrDefaultAsync(o => o.LineId == id);
        if (cfg is null)
        {
            if (!await _db.Lines.AnyAsync(l => l.Id == id)) return NotFound();
            cfg = new OeeConfig { LineId = id };
            _db.OeeConfigs.Add(cfg);
        }
        cfg.IdealRatePerHour = req.IdealRatePerHour;
        cfg.IdealCycleTimeSec = req.IdealCycleTimeSec ?? (req.IdealRatePerHour > 0 ? 3600.0 / req.IdealRatePerHour : cfg.IdealCycleTimeSec);
        cfg.TargetOeePct = req.TargetOeePct ?? cfg.TargetOeePct;
        cfg.TargetAvailabilityPct = req.TargetAvailabilityPct ?? cfg.TargetAvailabilityPct;
        cfg.TargetPerformancePct = req.TargetPerformancePct ?? cfg.TargetPerformancePct;
        cfg.TargetQualityPct = req.TargetQualityPct ?? cfg.TargetQualityPct;
        cfg.MicroStopThresholdSec = req.MicroStopThresholdSec ?? cfg.MicroStopThresholdSec;
        if (req.ProductionMode is { } mode) cfg.ProductionMode = mode;
        if (req.ChangeoverMode is { } coMode) cfg.ChangeoverMode = coMode;
        if (req.ReworkTracking is { } rework) cfg.ReworkTracking = rework;
        cfg.UpdatedUtc = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost("machines")]
    [HasPermission(PermissionKeys.ManageHierarchy)]
    public async Task<ActionResult<IdResult>> CreateMachine([FromBody] CreateMachineRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Name)) return BadRequest(new { message = "Name is required" });
        if (!await _db.Lines.AnyAsync(l => l.Id == req.LineId)) return BadRequest(new { message = "Line not found" });

        var seq = req.SequenceIndex ?? await _db.Machines.CountAsync(m => m.LineId == req.LineId);
        var machine = new Machine { Name = req.Name.Trim(), LineId = req.LineId, SequenceIndex = seq };
        _db.Machines.Add(machine);

        // A machine needs the standard logical signals so the engine + mappings work.
        foreach (var (role, name, type, unit) in DefaultSignals())
            _db.LogicalSignals.Add(new LogicalSignal { Name = name, Role = role, ExpectedType = type, Unit = unit, MachineId = machine.Id, LineId = req.LineId });

        await _db.SaveChangesAsync();
        await _audit.LogAsync("machine.create", User.GetUserId(), User.GetUserName(), entityType: nameof(Machine), entityId: machine.Id.ToString(), details: new { machine.Name });
        return Ok(new IdResult(machine.Id));
    }

    public record RenameRequest(string Name);
    public record ReorderMachinesRequest(IReadOnlyList<Guid> MachineIds);

    [HttpPut("departments/{id:guid}")]
    [HasPermission(PermissionKeys.ManageHierarchy)]
    public async Task<IActionResult> UpdateDepartment(Guid id, [FromBody] RenameRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Name)) return BadRequest(new { message = "Name is required" });
        var dept = await _db.Departments.FirstOrDefaultAsync(d => d.Id == id);
        if (dept is null) return NotFound();
        dept.Name = req.Name.Trim();
        dept.UpdatedUtc = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync();
        await _audit.LogAsync("department.update", User.GetUserId(), User.GetUserName(), entityType: nameof(Department), entityId: id.ToString());
        return NoContent();
    }

    [HttpDelete("departments/{id:guid}")]
    [HasPermission(PermissionKeys.ManageHierarchy)]
    public async Task<IActionResult> DeleteDepartment(Guid id)
    {
        var dept = await _db.Departments.FirstOrDefaultAsync(d => d.Id == id);
        if (dept is null) return NotFound();
        var blockers = await _deleteGuard.ForDepartmentAsync(id);
        if (blockers.IsBlocked)
            return BadRequest(new { message = "Cannot delete department while dependencies exist", blockers });
        _db.Departments.Remove(dept);
        await _db.SaveChangesAsync();
        await _audit.LogAsync("department.delete", User.GetUserId(), User.GetUserName(), entityType: nameof(Department), entityId: id.ToString());
        return NoContent();
    }

    [HttpPut("lines/{id:guid}")]
    [HasPermission(PermissionKeys.ManageHierarchy)]
    public async Task<IActionResult> UpdateLine(Guid id, [FromBody] RenameRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Name)) return BadRequest(new { message = "Name is required" });
        var line = await _db.Lines.FirstOrDefaultAsync(l => l.Id == id);
        if (line is null) return NotFound();
        line.Name = req.Name.Trim();
        line.UpdatedUtc = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync();
        await _audit.LogAsync("line.update", User.GetUserId(), User.GetUserName(), entityType: nameof(Line), entityId: id.ToString());
        return NoContent();
    }

    [HttpDelete("lines/{id:guid}")]
    [HasPermission(PermissionKeys.ManageHierarchy)]
    public async Task<IActionResult> DeleteLine(Guid id)
    {
        var line = await _db.Lines.FirstOrDefaultAsync(l => l.Id == id);
        if (line is null) return NotFound();
        var blockers = await _deleteGuard.ForLineAsync(id);
        if (blockers.IsBlocked)
            return BadRequest(new { message = "Cannot delete line while dependencies exist", blockers });
        _db.Lines.Remove(line);
        await _db.SaveChangesAsync();
        await _audit.LogAsync("line.delete", User.GetUserId(), User.GetUserName(), entityType: nameof(Line), entityId: id.ToString());
        return NoContent();
    }

    [HttpPut("machines/{id:guid}")]
    [HasPermission(PermissionKeys.ManageHierarchy)]
    public async Task<IActionResult> UpdateMachine(Guid id, [FromBody] RenameRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Name)) return BadRequest(new { message = "Name is required" });
        var machine = await _db.Machines.FirstOrDefaultAsync(m => m.Id == id);
        if (machine is null) return NotFound();
        machine.Name = req.Name.Trim();
        machine.UpdatedUtc = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync();
        await _audit.LogAsync("machine.update", User.GetUserId(), User.GetUserName(), entityType: nameof(Machine), entityId: id.ToString());
        return NoContent();
    }

    [HttpDelete("machines/{id:guid}")]
    [HasPermission(PermissionKeys.ManageHierarchy)]
    public async Task<IActionResult> DeleteMachine(Guid id)
    {
        var machine = await _db.Machines.FirstOrDefaultAsync(m => m.Id == id);
        if (machine is null) return NotFound();
        var blockers = await _deleteGuard.ForMachineAsync(id);
        if (blockers.IsBlocked)
            return BadRequest(new { message = "Cannot delete machine while dependencies exist", blockers });

        var signals = await _db.LogicalSignals.Where(s => s.MachineId == id).ToListAsync();
        _db.LogicalSignals.RemoveRange(signals);
        _db.Machines.Remove(machine);
        await _db.SaveChangesAsync();
        await _audit.LogAsync("machine.delete", User.GetUserId(), User.GetUserName(), entityType: nameof(Machine), entityId: id.ToString());
        return NoContent();
    }

    [HttpPut("lines/{lineId:guid}/machines/reorder")]
    [HasPermission(PermissionKeys.ManageHierarchy)]
    public async Task<IActionResult> ReorderMachines(Guid lineId, [FromBody] ReorderMachinesRequest req)
    {
        if (req.MachineIds is null || req.MachineIds.Count == 0)
            return BadRequest(new { message = "machineIds is required" });

        var machines = await _db.Machines.Where(m => m.LineId == lineId).ToListAsync();
        if (machines.Count == 0) return NotFound();
        var idSet = machines.Select(m => m.Id).ToHashSet();
        if (req.MachineIds.Any(id => !idSet.Contains(id)))
            return BadRequest(new { message = "All machineIds must belong to the line" });

        for (var i = 0; i < req.MachineIds.Count; i++)
        {
            var m = machines.First(x => x.Id == req.MachineIds[i]);
            m.SequenceIndex = i;
            m.UpdatedUtc = DateTimeOffset.UtcNow;
        }
        await _db.SaveChangesAsync();
        await _audit.LogAsync("machine.reorder", User.GetUserId(), User.GetUserName(), entityType: nameof(Line), entityId: lineId.ToString());
        return NoContent();
    }

    private static IEnumerable<(SignalRole, string, TagDataType, string?)> DefaultSignals() => new[]
    {
        (SignalRole.RunState, "Run State", TagDataType.Int, (string?)null),
        (SignalRole.RunStateRunning, "Running (BOOL)", TagDataType.Bool, null),
        (SignalRole.RunStateIdle, "Idle (BOOL)", TagDataType.Bool, null),
        (SignalRole.RunStateFaulted, "Faulted (BOOL)", TagDataType.Bool, null),
        (SignalRole.GoodCount, "Good Count", TagDataType.Dint, "parts"),
        (SignalRole.RejectCount, "Reject Count", TagDataType.Dint, "parts"),
        (SignalRole.ReworkCount, "Rework Count", TagDataType.Dint, "parts"),
        (SignalRole.DowntimeReason, "Downtime Reason", TagDataType.Int, (string?)null),
        (SignalRole.PartId, "Recipe / Part ID", TagDataType.String, null),
    };
}

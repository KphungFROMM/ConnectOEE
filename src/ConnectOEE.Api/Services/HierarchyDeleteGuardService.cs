using ConnectOEE.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ConnectOEE.Api.Services;

public record HierarchyDeleteBlockers(
    int Departments = 0,
    int Lines = 0,
    int Machines = 0,
    int PlcConnections = 0,
    int TagMappings = 0,
    int Dashboards = 0,
    int ShiftAssignments = 0,
    int LogicalSignals = 0)
{
    public bool IsBlocked =>
        Departments > 0 || Lines > 0 || Machines > 0 || PlcConnections > 0
        || TagMappings > 0 || Dashboards > 0 || ShiftAssignments > 0 || LogicalSignals > 0;

    public IReadOnlyList<string> Messages()
    {
        var list = new List<string>();
        if (Departments > 0) list.Add($"{Departments} department(s)");
        if (Lines > 0) list.Add($"{Lines} line(s)");
        if (Machines > 0) list.Add($"{Machines} machine(s)");
        if (PlcConnections > 0) list.Add($"{PlcConnections} PLC connection(s)");
        if (TagMappings > 0) list.Add($"{TagMappings} tag mapping(s)");
        if (Dashboards > 0) list.Add($"{Dashboards} dashboard(s)");
        if (ShiftAssignments > 0) list.Add($"{ShiftAssignments} shift assignment(s)");
        if (LogicalSignals > 0) list.Add($"{LogicalSignals} logical signal(s)");
        return list;
    }
}

public class HierarchyDeleteGuardService
{
    private readonly ConnectOeeDbContext _db;

    public HierarchyDeleteGuardService(ConnectOeeDbContext db) => _db = db;

    public async Task<HierarchyDeleteBlockers> ForPlantAsync(Guid plantId, CancellationToken ct = default)
    {
        var deptCount = await _db.Departments.CountAsync(d => d.PlantId == plantId, ct);
        var dashCount = await _db.Dashboards.CountAsync(d => d.PlantId == plantId, ct);
        return new HierarchyDeleteBlockers(Departments: deptCount, Dashboards: dashCount);
    }

    public async Task<HierarchyDeleteBlockers> ForDepartmentAsync(Guid departmentId, CancellationToken ct = default)
    {
        var lineCount = await _db.Lines.CountAsync(l => l.DepartmentId == departmentId, ct);
        return new HierarchyDeleteBlockers(Lines: lineCount);
    }

    public async Task<HierarchyDeleteBlockers> ForLineAsync(Guid lineId, CancellationToken ct = default)
    {
        var machineCount = await _db.Machines.CountAsync(m => m.LineId == lineId, ct);
        var plcCount = await _db.PlcConnections.CountAsync(c => c.LineId == lineId, ct);
        var dashCount = await _db.Dashboards.CountAsync(d => d.LineId == lineId, ct);
        var shiftCount = await _db.ShiftAssignments.CountAsync(a => a.LineId == lineId, ct);
        return new HierarchyDeleteBlockers(
            Machines: machineCount,
            PlcConnections: plcCount,
            Dashboards: dashCount,
            ShiftAssignments: shiftCount);
    }

    public async Task<HierarchyDeleteBlockers> ForMachineAsync(Guid machineId, CancellationToken ct = default)
    {
        var mappingCount = await _db.TagMappings.CountAsync(m =>
            _db.LogicalSignals.Any(s => s.Id == m.LogicalSignalId && s.MachineId == machineId), ct);
        var dashCount = await _db.Dashboards.CountAsync(d => d.MachineId == machineId, ct);
        return new HierarchyDeleteBlockers(TagMappings: mappingCount, Dashboards: dashCount);
    }
}

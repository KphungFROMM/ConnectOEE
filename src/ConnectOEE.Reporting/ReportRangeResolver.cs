using ConnectOEE.Core;
using ConnectOEE.Historian;
using ConnectOEE.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ConnectOEE.Reporting;

/// <summary>Resolves relative report windows, including calendar shift boundaries when a line scope is available.</summary>
public class ReportRangeResolver
{
    private readonly ConnectOeeDbContext _db;

    public ReportRangeResolver(ConnectOeeDbContext db) => _db = db;

    public async Task<(DateTimeOffset from, DateTimeOffset to)> ResolveAsync(
        ReportRangeKind kind,
        EntityLevel level,
        Guid scopeId,
        DateTimeOffset? customFrom,
        DateTimeOffset? customTo,
        CancellationToken ct = default)
    {
        var now = DateTimeOffset.UtcNow;

        if (kind == ReportRangeKind.Custom && customFrom is { } cf && customTo is { } ct2)
            return (cf.ToUniversalTime(), ct2.ToUniversalTime());

        if (kind is ReportRangeKind.PreviousShift or ReportRangeKind.Today)
        {
            var lineIds = await ResolveLineIdsAsync(level, scopeId, ct);
            if (lineIds.Count > 0)
            {
                var shiftWindow = await ResolveShiftWindowAsync(lineIds, kind, now, ct);
                if (shiftWindow.HasValue) return shiftWindow.Value;
            }
        }

        return ReportService.ResolveRangeStatic(kind, now);
    }

    private async Task<(DateTimeOffset from, DateTimeOffset to)?> ResolveShiftWindowAsync(
        List<Guid> lineIds, ReportRangeKind kind, DateTimeOffset now, CancellationToken ct)
    {
        if (kind == ReportRangeKind.Today)
        {
            var open = await _db.ShiftInstances.AsNoTracking()
                .Where(s => lineIds.Contains(s.LineId) && !s.IsClosed && s.StartUtc <= now && s.EndUtc > now)
                .OrderByDescending(s => s.StartUtc)
                .FirstOrDefaultAsync(ct);
            if (open is not null)
                return (open.StartUtc, now);

            var localNow = now.ToLocalTime();
            var todayStart = new DateTimeOffset(localNow.Year, localNow.Month, localNow.Day, 0, 0, 0, localNow.Offset);
            return (todayStart.ToUniversalTime(), now);
        }

        // PreviousShift: most recently ended shift instance on any line in scope.
        var closed = await _db.ShiftInstances.AsNoTracking()
            .Where(s => lineIds.Contains(s.LineId) && s.EndUtc <= now)
            .OrderByDescending(s => s.EndUtc)
            .FirstOrDefaultAsync(ct);
        if (closed is not null)
            return (closed.StartUtc, closed.EndUtc);

        return null;
    }

    private async Task<List<Guid>> ResolveLineIdsAsync(EntityLevel level, Guid id, CancellationToken ct) => level switch
    {
        EntityLevel.Line => new List<Guid> { id },
        EntityLevel.Machine => await _db.Machines.AsNoTracking()
            .Where(m => m.Id == id).Select(m => m.LineId).ToListAsync(ct),
        EntityLevel.Department => await _db.Lines.AsNoTracking()
            .Where(l => l.DepartmentId == id).Select(l => l.Id).ToListAsync(ct),
        _ => await (from l in _db.Lines.AsNoTracking()
                    join d in _db.Departments.AsNoTracking() on l.DepartmentId equals d.Id
                    where d.PlantId == id
                    select l.Id).ToListAsync(ct),
    };
}

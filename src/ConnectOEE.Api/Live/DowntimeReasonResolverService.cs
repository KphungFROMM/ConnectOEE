using ConnectOEE.Core;
using ConnectOEE.Core.Abstractions;
using ConnectOEE.Core.Entities;
using ConnectOEE.Drivers;
using ConnectOEE.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ConnectOEE.Api.Live;

/// <summary>
/// Resolves numeric PLC downtime reason codes to catalog rows. Unknown codes are
/// auto-stubbed in <see cref="FaultCodeMap"/> for supervisor review (mirrors recipe auto-stub).
/// </summary>
public class DowntimeReasonResolverService
{
    public sealed record ResolvedReason(
        int Code,
        string Reason,
        LossCategory Category,
        DowntimeKind Kind,
        bool NeedsReview,
        bool WasAutoCreated);

    private readonly IServiceScopeFactory _scopeFactory;
    private List<FaultCodeMap> _maps = new();
    private DateTimeOffset _catalogLoaded = DateTimeOffset.MinValue;

    public DowntimeReasonResolverService(IServiceScopeFactory scopeFactory) => _scopeFactory = scopeFactory;

    public static string PlaceholderReason(int code) => $"PLC code {code} — needs review";

    public static bool IsPlaceholderReason(string reason, int code) =>
        string.Equals(reason.Trim(), PlaceholderReason(code), StringComparison.Ordinal);

    public void InvalidateCatalog() => _catalogLoaded = DateTimeOffset.MinValue;

    public async Task EnsureCatalogAsync(ConnectOeeDbContext db, CancellationToken ct)
    {
        if (DateTimeOffset.UtcNow - _catalogLoaded < TimeSpan.FromSeconds(30)) return;
        _maps = await db.FaultCodeMaps.AsNoTracking().ToListAsync(ct);
        _catalogLoaded = DateTimeOffset.UtcNow;
    }

    public async Task<ResolvedReason?> ResolveAsync(
        ConnectOeeDbContext db,
        Guid machineId,
        Guid lineId,
        int? code,
        CancellationToken ct)
    {
        if (code is null or 0) return null;

        await EnsureCatalogAsync(db, ct);
        var map = Lookup(code.Value, machineId, lineId);
        if (map is not null)
            return new ResolvedReason(map.Code, map.Reason, map.Category, map.Kind, map.NeedsReview, map.IsAutoCreated);

        map = await EnsureStubAsync(db, lineId, machineId, code.Value, ct);
        return new ResolvedReason(map.Code, map.Reason, map.Category, map.Kind, map.NeedsReview, map.IsAutoCreated);
    }

    private FaultCodeMap? Lookup(int code, Guid machineId, Guid lineId) =>
        _maps.FirstOrDefault(m => m.MachineId == machineId && m.Code == code)
        ?? _maps.FirstOrDefault(m => m.MachineId == null && m.LineId == lineId && m.Code == code);

    private async Task<FaultCodeMap> EnsureStubAsync(
        ConnectOeeDbContext db,
        Guid lineId,
        Guid machineId,
        int code,
        CancellationToken ct)
    {
        var existing = await db.FaultCodeMaps.FirstOrDefaultAsync(m =>
            m.Code == code && (m.LineId == lineId || m.LineId == null) &&
            (m.MachineId == machineId || m.MachineId == null), ct);

        if (existing is not null)
        {
            if (!_maps.Any(m => m.Id == existing.Id))
                _maps.Add(existing);
            return existing;
        }

        var band = RockwellFaultCatalog.Resolve(code);
        var stub = new FaultCodeMap
        {
            LineId = lineId,
            MachineId = null,
            Code = code,
            Reason = PlaceholderReason(code),
            Category = band.Category,
            Kind = band.Kind,
            IsAutoCreated = true,
            NeedsReview = true,
        };
        db.FaultCodeMaps.Add(stub);
        await db.SaveChangesAsync(ct);
        _maps.Add(stub);
        InvalidateCatalog();

        using var scope = _scopeFactory.CreateScope();
        var audit = scope.ServiceProvider.GetRequiredService<IAuditService>();
        await audit.LogAsync("downtime.reason.auto-create", null, "system",
            entityType: nameof(FaultCodeMap), entityId: stub.Id.ToString(),
            details: new { stub.Code, lineId, machineId, stub.Category, stub.Kind }, ct: ct);

        return stub;
    }
}

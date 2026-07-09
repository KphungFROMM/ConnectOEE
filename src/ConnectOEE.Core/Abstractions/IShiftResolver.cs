using ConnectOEE.Core.Entities;

namespace ConnectOEE.Core.Abstractions;

/// <summary>
/// Resolves and materializes the active <see cref="ShiftInstance"/> for a line at a
/// given instant. Handles plant time zone/DST, cross-midnight shifts, effective-dated
/// pattern assignments (line overrides plant), and a 24h fallback when unconfigured.
/// </summary>
public interface IShiftResolver
{
    Task<ShiftInstance> ResolveAsync(Guid lineId, DateTimeOffset timestampUtc, CancellationToken ct = default);
}

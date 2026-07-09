using ConnectOEE.Core.Entities;
using ConnectOEE.Core.Oee;

namespace ConnectOEE.Core.Abstractions;

/// <summary>
/// Computes calendar-based shift time balance from assigned patterns and plant calendar.
/// </summary>
public interface IShiftScheduleService
{
    Task<ShiftTimeBalance> GetTimeBalanceAsync(
        Guid lineId,
        ShiftInstance shift,
        DateTimeOffset nowUtc,
        CancellationToken ct = default);

    Task<ShiftAssignment?> FindAssignmentAsync(
        Guid lineId,
        Guid? plantId,
        DateOnly date,
        CancellationToken ct = default);
}

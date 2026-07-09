namespace ConnectOEE.Core.Oee;

/// <summary>
/// Calendar-based time balance for a shift window, derived from the assigned pattern.
/// </summary>
public record ShiftTimeBalance(
    bool IsCalendarExcluded,
    double AllTimeSec,
    double BreakOverlapSec,
    IReadOnlyList<ShiftWindowCalculator.TimeInterval> BreakIntervalsUtc);

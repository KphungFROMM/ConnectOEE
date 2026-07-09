namespace ConnectOEE.Core.Oee;

/// <summary>Parts-based production expectations and loss attribution at ideal rate.</summary>
public record ProductionPartsLoss(
    long MaxPossibleParts,
    long? ExpectedPartsPace,
    long TheoreticalOutput,
    long PartsLostAvailability,
    long PartsLostPerformance,
    long PartsLostQuality,
    long PartsLostBreakdown,
    long PartsCouldHaveMade,
    long OutputGapParts,
    IReadOnlyDictionary<string, long>? PartsLostByCategory = null)
{
    public static readonly ProductionPartsLoss Empty = new(0, null, 0, 0, 0, 0, 0, 0, 0, null);
}

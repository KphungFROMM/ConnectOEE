using ConnectOEE.Core;

namespace ConnectOEE.Drivers;

/// <summary>A resolved interpretation of a numeric fault code.</summary>
public record FaultInfo(int Code, string Reason, LossCategory Category, DowntimeKind Kind);

/// <summary>
/// Default fault-code interpretation for Rockwell lines used when no explicit
/// <c>FaultCodeMap</c> row exists for a machine/line. Real deployments override these in
/// the DB; this provides sensible loss attribution out of the box using a common code
/// banding convention so OEE losses are categorised even before an engineer maps codes.
///
/// Banding (typical Rockwell line convention):
///   0        -> no fault
///   1..99    -> minor stops / sensor faults      -> Small Stop (unplanned)
///   100..199 -> equipment breakdowns / E-stops   -> Breakdown (unplanned)
///   200..299 -> changeover / setup / adjustment  -> Setup &amp; Adjustment (planned)
///   300..399 -> material starved / blocked        -> Small Stop (unplanned)
///   400..499 -> reduced speed / process limits    -> Reduced Speed (unplanned)
///   500+     -> uncategorised                      -> Breakdown (unplanned)
/// </summary>
public static class RockwellFaultCatalog
{
    public static FaultInfo Resolve(int code)
    {
        if (code <= 0) return new FaultInfo(0, "No fault", LossCategory.Unattributed, DowntimeKind.Unplanned);

        return code switch
        {
            < 100 => new FaultInfo(code, $"Minor stop / sensor fault {code}", LossCategory.SmallStop, DowntimeKind.Unplanned),
            < 200 => new FaultInfo(code, $"Equipment breakdown {code}", LossCategory.Breakdown, DowntimeKind.Unplanned),
            < 300 => new FaultInfo(code, $"Changeover / setup {code}", LossCategory.SetupAndAdjustment, DowntimeKind.Planned),
            < 400 => new FaultInfo(code, $"Material starved / blocked {code}", LossCategory.SmallStop, DowntimeKind.Unplanned),
            < 500 => new FaultInfo(code, $"Reduced speed / process limit {code}", LossCategory.ReducedSpeed, DowntimeKind.Unplanned),
            _ => new FaultInfo(code, $"Fault {code}", LossCategory.Breakdown, DowntimeKind.Unplanned),
        };
    }
}

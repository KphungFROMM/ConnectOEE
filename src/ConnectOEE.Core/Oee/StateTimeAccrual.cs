namespace ConnectOEE.Core.Oee;

/// <summary>Accrues elapsed seconds into per-state buckets. OEE run time uses Running only.</summary>
public static class StateTimeAccrual
{
    public static void Accrue(ref StateTimeSeconds times, RunState state, double elapsedSec)
    {
        if (elapsedSec <= 0) return;
        times = state switch
        {
            RunState.Running => times with { RunSec = times.RunSec + elapsedSec },
            RunState.PlannedDown => times with { PlannedDownSec = times.PlannedDownSec + elapsedSec },
            RunState.Idle => times with { IdleSec = times.IdleSec + elapsedSec },
            RunState.Down => times with { DownSec = times.DownSec + elapsedSec },
            RunState.Setup => times with { SetupSec = times.SetupSec + elapsedSec },
            RunState.Starved => times with { StarvedSec = times.StarvedSec + elapsedSec },
            RunState.Blocked => times with { BlockedSec = times.BlockedSec + elapsedSec },
            _ => times with { UnknownSec = times.UnknownSec + elapsedSec },
        };
    }

    public static StateTimeMinutes ToMinutes(StateTimeSeconds times)
    {
        static double Min(double sec) => Math.Round(sec / 60.0, 2);
        var uptimeMin = Min(times.RunSec);
        var stoppedMin = Min(times.TotalStoppedSec);
        var total = uptimeMin + stoppedMin;
        double? Pct(double sec) => total > 0 ? Math.Round(Min(sec) / total * 100.0, 2) : null;

        return new StateTimeMinutes(
            Min(times.IdleSec),
            Min(times.DownSec),
            Min(times.SetupSec),
            Min(times.StarvedSec),
            Min(times.BlockedSec),
            Min(times.UnknownSec),
            Pct(times.IdleSec),
            Pct(times.DownSec),
            Pct(times.SetupSec),
            Pct(times.StarvedSec),
            Pct(times.BlockedSec),
            Pct(times.UnknownSec));
    }
}

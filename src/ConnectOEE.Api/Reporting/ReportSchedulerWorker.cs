using ConnectOEE.Core;
using ConnectOEE.Core.Entities;
using ConnectOEE.Historian;
using ConnectOEE.Infrastructure;
using ConnectOEE.Reporting;
using Microsoft.EntityFrameworkCore;

namespace ConnectOEE.Api.Reporting;

/// <summary>
/// Runs due report schedules. Wakes once a minute, generates each schedule whose
/// next-run time has passed, delivers it (email/file drop), and rolls the next-run
/// forward. Failures are recorded on the schedule and surfaced in the Reports admin UI.
/// </summary>
public class ReportSchedulerWorker : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<ReportSchedulerWorker> _logger;

    public ReportSchedulerWorker(IServiceScopeFactory scopeFactory, ILogger<ReportSchedulerWorker> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Small initial delay so the app finishes migrating/seeding first.
        try { await Task.Delay(TimeSpan.FromSeconds(15), stoppingToken); }
        catch (OperationCanceledException) { return; }

        while (!stoppingToken.IsCancellationRequested)
        {
            try { await TickAsync(stoppingToken); }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception ex) { _logger.LogError(ex, "Report scheduler tick failed"); }

            try { await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken); }
            catch (OperationCanceledException) { break; }
        }
    }

    private async Task TickAsync(CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ConnectOeeDbContext>();
        var reports = scope.ServiceProvider.GetRequiredService<ReportService>();
        var delivery = scope.ServiceProvider.GetRequiredService<ReportDeliveryService>();

        var now = DateTimeOffset.UtcNow;
        var schedules = await db.ReportSchedules.Where(s => s.Enabled).ToListAsync(ct);

        foreach (var s in schedules)
        {
            // Initialize the next-run on first sight.
            if (s.NextRunUtc is null)
            {
                s.NextRunUtc = ComputeNextRun(s, now);
                continue;
            }
            if (s.NextRunUtc > now) continue;

            try
            {
                var level = Enum.TryParse<EntityLevel>(s.ScopeLevel, out var lvl) ? lvl : EntityLevel.Plant;
                var report = await reports.GenerateAsync(
                    s.ReportTemplateId, level, s.ScopeId, s.RangeKind, s.Format,
                    triggeredBy: $"schedule:{s.Name}", scheduleId: s.Id, ct: ct);

                await delivery.DeliverAsync(s, report, ct);

                s.LastStatus = ReportRunStatus.Success;
                s.LastError = null;
                _logger.LogInformation("Delivered scheduled report '{Name}' via {Method}", s.Name, s.DeliveryMethod);
            }
            catch (Exception ex)
            {
                s.LastStatus = ReportRunStatus.Failed;
                s.LastError = ex.Message.Length > 1000 ? ex.Message[..1000] : ex.Message;
                _logger.LogError(ex, "Scheduled report '{Name}' failed", s.Name);

                db.ReportRuns.Add(new ReportRun
                {
                    ReportTemplateId = s.ReportTemplateId,
                    ReportScheduleId = s.Id,
                    Title = $"{s.Name} (failed)",
                    Format = s.Format,
                    GeneratedUtc = now,
                    Status = ReportRunStatus.Failed,
                    TriggeredBy = $"schedule:{s.Name}",
                    Error = s.LastError,
                });
            }
            finally
            {
                s.LastRunUtc = now;
                s.NextRunUtc = ComputeNextRun(s, now);
            }
        }

        await db.SaveChangesAsync(ct);
    }

    /// <summary>Next fire time (UTC) after <paramref name="afterUtc"/> for the cadence.</summary>
    public static DateTimeOffset ComputeNextRun(ReportSchedule s, DateTimeOffset afterUtc)
    {
        var localAfter = afterUtc.ToLocalTime();
        var time = s.TimeOfDay;

        DateTimeOffset NextDailyFrom(DateTimeOffset day)
        {
            var candidate = new DateTimeOffset(day.Year, day.Month, day.Day, time.Hour, time.Minute, 0, day.Offset);
            return candidate;
        }

        switch (s.Frequency)
        {
            case ReportFrequency.Weekly:
            {
                for (var i = 0; i < 8; i++)
                {
                    var day = localAfter.Date.AddDays(i);
                    if ((int)day.DayOfWeek == s.DayOfPeriod)
                    {
                        var candidate = NextDailyFrom(new DateTimeOffset(day, localAfter.Offset));
                        if (candidate > localAfter) return candidate.ToUniversalTime();
                    }
                }
                return localAfter.AddDays(7).ToUniversalTime();
            }
            case ReportFrequency.Monthly:
            {
                var dom = Math.Clamp(s.DayOfPeriod, 1, 28);
                var thisMonth = new DateTimeOffset(localAfter.Year, localAfter.Month, dom, time.Hour, time.Minute, 0, localAfter.Offset);
                if (thisMonth > localAfter) return thisMonth.ToUniversalTime();
                var next = thisMonth.AddMonths(1);
                return next.ToUniversalTime();
            }
            case ReportFrequency.Daily:
            default:
            {
                var today = NextDailyFrom(localAfter);
                if (today > localAfter) return today.ToUniversalTime();
                return today.AddDays(1).ToUniversalTime();
            }
        }
    }
}

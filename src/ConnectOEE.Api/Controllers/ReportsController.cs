using ConnectOEE.Api.Auth;
using ConnectOEE.Api.Services;
using ConnectOEE.Core;
using ConnectOEE.Core.Entities;
using ConnectOEE.Core.Entities.Security;
using ConnectOEE.Core.Licensing;
using ConnectOEE.Historian;
using ConnectOEE.Infrastructure;
using ConnectOEE.Reporting;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ConnectOEE.Api.Controllers;

/// <summary>
/// Reports API: list templates, generate on-demand (PDF/CSV download), manage
/// scheduled reports + their delivery, view run history, and configure SMTP. Viewing
/// requires <c>reports.view</c>; mutating schedules/SMTP requires <c>reports.manage</c>.
/// </summary>
[ApiController]
[Route("api/reports")]
[Authorize]
public class ReportsController : ControllerBase
{
    private readonly ConnectOeeDbContext _db;
    private readonly ReportService _reports;
    private readonly ReportDeliveryService _delivery;
    private readonly ILicenseService _license;

    public ReportsController(ConnectOeeDbContext db, ReportService reports, ReportDeliveryService delivery,
        ILicenseService license)
    {
        _db = db;
        _reports = reports;
        _delivery = delivery;
        _license = license;
    }

    // ----- Templates -----

    public record TemplateDto(Guid Id, string Name, string? Description, string ReportType, bool IsSystem, bool IsPublished);

    [HttpGet("templates")]
    [HasPermission(PermissionKeys.ViewReports)]
    public async Task<ActionResult<IEnumerable<TemplateDto>>> Templates(CancellationToken ct)
    {
        var items = await _db.ReportTemplates.AsNoTracking()
            .OrderBy(t => t.ReportType)
            .Select(t => new TemplateDto(t.Id, t.Name, t.Description, t.ReportType.ToString(), t.IsSystem, t.IsPublished))
            .ToListAsync(ct);
        return Ok(items);
    }

    public record SaveCustomTemplateRequest(string Name, string? Description, string LayoutJson);

    [HttpPost("templates/custom")]
    [HasPermission(PermissionKeys.ManageReports)]
    public async Task<ActionResult<TemplateDto>> SaveCustomTemplate([FromBody] SaveCustomTemplateRequest req, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(req.Name)) return BadRequest(new { message = "Name is required" });
        var layout = string.IsNullOrWhiteSpace(req.LayoutJson) ? "[]" : req.LayoutJson;
        var err = ReportBlockLayout.Validate(layout);
        if (err is not null) return BadRequest(new { message = err });

        var t = new ReportTemplate
        {
            Name = req.Name.Trim(),
            Description = req.Description?.Trim(),
            ReportType = ReportType.Custom,
            IsSystem = false,
            IsPublished = true,
            LayoutJson = layout,
        };
        _db.ReportTemplates.Add(t);
        await _db.SaveChangesAsync(ct);
        return Ok(new TemplateDto(t.Id, t.Name, t.Description, t.ReportType.ToString(), t.IsSystem, t.IsPublished));
    }

    public record TemplateDetailDto(
        Guid Id, string Name, string? Description, string ReportType, bool IsSystem, bool IsPublished,
        string[] SuggestedRanges, string? LayoutJson);

    [HttpGet("templates/{id:guid}")]
    [HasPermission(PermissionKeys.ViewReports)]
    public async Task<ActionResult<TemplateDetailDto>> Template(Guid id, CancellationToken ct)
    {
        var t = await _db.ReportTemplates.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct);
        if (t is null) return NotFound();
        return Ok(new TemplateDetailDto(t.Id, t.Name, t.Description, t.ReportType.ToString(), t.IsSystem, t.IsPublished,
            SuggestedRangesFor(t.ReportType),
            t.ReportType == ReportType.Custom ? t.LayoutJson : null));
    }

    [HttpPut("templates/{id:guid}")]
    [HasPermission(PermissionKeys.ManageReports)]
    public async Task<ActionResult<TemplateDto>> UpdateTemplate(Guid id, [FromBody] SaveCustomTemplateRequest req, CancellationToken ct)
    {
        var t = await _db.ReportTemplates.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (t is null) return NotFound();
        if (t.IsSystem || t.ReportType != ReportType.Custom)
            return BadRequest(new { message = "Only custom templates can be updated." });
        if (string.IsNullOrWhiteSpace(req.Name)) return BadRequest(new { message = "Name is required" });

        var layout = string.IsNullOrWhiteSpace(req.LayoutJson) ? "[]" : req.LayoutJson;
        var err = ReportBlockLayout.Validate(layout);
        if (err is not null) return BadRequest(new { message = err });

        t.Name = req.Name.Trim();
        t.Description = req.Description?.Trim();
        t.LayoutJson = layout;
        await _db.SaveChangesAsync(ct);
        return Ok(new TemplateDto(t.Id, t.Name, t.Description, t.ReportType.ToString(), t.IsSystem, t.IsPublished));
    }

    [HttpDelete("templates/{id:guid}")]
    [HasPermission(PermissionKeys.ManageReports)]
    public async Task<IActionResult> DeleteTemplate(Guid id, CancellationToken ct)
    {
        var t = await _db.ReportTemplates.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (t is null) return NotFound();
        if (t.IsSystem || t.ReportType != ReportType.Custom)
            return BadRequest(new { message = "Only custom templates can be deleted." });

        var inUse = await _db.ReportSchedules.AnyAsync(s => s.ReportTemplateId == id, ct);
        if (inUse) return BadRequest(new { message = "Template is used by one or more schedules. Remove those schedules first." });

        _db.ReportTemplates.Remove(t);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    public record ForkTemplateRequest(string? Name);

    /// <summary>Fork a system template into an editable Custom template with matching block layout.</summary>
    [HttpPost("templates/{id:guid}/fork")]
    [HasPermission(PermissionKeys.ManageReports)]
    public async Task<ActionResult<TemplateDetailDto>> ForkTemplate(Guid id, [FromBody] ForkTemplateRequest? req, CancellationToken ct)
    {
        var source = await _db.ReportTemplates.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct);
        if (source is null) return NotFound();

        IReadOnlyList<ReportBlock> blocks;
        if (source.ReportType == ReportType.Custom)
        {
            blocks = ReportBlockLayout.Parse(source.LayoutJson);
            if (blocks.Count == 0) blocks = ReportBlockLayout.PresetFor(ReportType.WeeklySummary);
        }
        else
        {
            blocks = ReportBlockLayout.PresetFor(source.ReportType);
        }

        var name = string.IsNullOrWhiteSpace(req?.Name)
            ? $"{source.Name} (copy)"
            : req!.Name!.Trim();

        var t = new ReportTemplate
        {
            Name = name,
            Description = source.Description,
            ReportType = ReportType.Custom,
            IsSystem = false,
            IsPublished = true,
            LayoutJson = ReportBlockLayout.Serialize(blocks),
        };
        _db.ReportTemplates.Add(t);
        await _db.SaveChangesAsync(ct);
        return Ok(new TemplateDetailDto(t.Id, t.Name, t.Description, t.ReportType.ToString(), t.IsSystem, t.IsPublished,
            SuggestedRangesFor(ReportType.Custom), t.LayoutJson));
    }

    // ----- On-demand generation -----

    private static string[] SuggestedRangesFor(ReportType type) => type switch
    {
        ReportType.ShiftReport => new[] { "PreviousShift", "Today", "Yesterday" },
        ReportType.DailyOee => new[] { "Today", "Yesterday", "Last7d" },
        ReportType.WeeklySummary => new[] { "PreviousWeek", "Last7d" },
        ReportType.MonthlySummary => new[] { "PreviousMonth", "Last30d" },
        ReportType.ExecutiveSummary => new[] { "Last7d", "Last30d", "PreviousMonth" },
        _ => new[] { "Last7d", "Last30d" },
    };

    public record GenerateRequest(Guid TemplateId, EntityLevel Level, Guid ScopeId,
        ReportRangeKind RangeKind, ReportFormat Format, DateTimeOffset? FromUtc = null, DateTimeOffset? ToUtc = null);

    [HttpPost("preview")]
    [HasPermission(PermissionKeys.ViewReports)]
    public async Task<IActionResult> Preview([FromBody] GenerateRequest req, CancellationToken ct)
    {
        var pdf = LicenseEnforcement.CheckPdfReports(_license, req.Format);
        if (pdf is not null) return pdf;

        var report = await _reports.GenerateAsync(req.TemplateId, req.Level, req.ScopeId, req.RangeKind,
            req.Format, triggeredBy: User.Identity?.Name, scheduleId: null,
            customFrom: req.FromUtc, customTo: req.ToUtc, persist: false, ct);
        Response.Headers.ContentDisposition = $"inline; filename=\"{report.FileName}\"";
        return File(report.Content, report.ContentType);
    }

    [HttpPost("generate")]
    [HasPermission(PermissionKeys.ViewReports)]
    public async Task<IActionResult> Generate([FromBody] GenerateRequest req, CancellationToken ct)
    {
        var pdf = LicenseEnforcement.CheckPdfReports(_license, req.Format);
        if (pdf is not null) return pdf;

        var report = await _reports.GenerateAsync(req.TemplateId, req.Level, req.ScopeId, req.RangeKind,
            req.Format, triggeredBy: User.Identity?.Name, scheduleId: null,
            customFrom: req.FromUtc, customTo: req.ToUtc, persist: true, ct);
        return File(report.Content, report.ContentType, report.FileName);
    }

    // ----- Run history -----

    public record RunDto(Guid Id, Guid ReportTemplateId, Guid? ReportScheduleId, string Title,
        string Format, DateTimeOffset GeneratedUtc, string Status, bool HasFile, string? TriggeredBy, string? Error);

    [HttpGet("runs")]
    [HasPermission(PermissionKeys.ViewReports)]
    public async Task<ActionResult<IEnumerable<RunDto>>> Runs(
        [FromQuery] int skip = 0, [FromQuery] int take = 50,
        [FromQuery] string? status = null, CancellationToken ct = default)
    {
        take = Math.Clamp(take, 1, 100);
        var q = _db.ReportRuns.AsNoTracking().OrderByDescending(r => r.GeneratedUtc).AsQueryable();
        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<ReportRunStatus>(status, true, out var st))
            q = q.Where(r => r.Status == st);

        var items = await q.Skip(skip).Take(take)
            .Select(r => new RunDto(r.Id, r.ReportTemplateId, r.ReportScheduleId, r.Title,
                r.Format.ToString(), r.GeneratedUtc, r.Status.ToString(), r.FilePath != null, r.TriggeredBy, r.Error))
            .ToListAsync(ct);
        return Ok(items);
    }

    [HttpGet("runs/{id:guid}/download")]
    [HasPermission(PermissionKeys.ViewReports)]
    public async Task<IActionResult> Download(Guid id, CancellationToken ct)
    {
        var run = await _db.ReportRuns.AsNoTracking().FirstOrDefaultAsync(r => r.Id == id, ct);
        if (run?.FilePath is null || !System.IO.File.Exists(run.FilePath))
            return NotFound();

        var bytes = await System.IO.File.ReadAllBytesAsync(run.FilePath, ct);
        var contentType = run.Format == ReportFormat.Csv ? "text/csv" : "application/pdf";
        var ext = run.Format == ReportFormat.Csv ? "csv" : "pdf";
        return File(bytes, contentType, $"{run.Title}.{ext}");
    }

    // ----- Schedules -----

    public record ScheduleDto(Guid Id, string Name, Guid ReportTemplateId, string Format,
        string ScopeLevel, Guid ScopeId, string RangeKind, string Frequency, string TimeOfDay, int DayOfPeriod,
        bool Enabled, string DeliveryMethod, string? Recipients, string? FileDropPath,
        DateTimeOffset? NextRunUtc, DateTimeOffset? LastRunUtc, string? LastStatus, string? LastError);

    public record ScheduleUpsert(string Name, Guid ReportTemplateId, ReportFormat Format,
        string ScopeLevel, Guid ScopeId, ReportRangeKind RangeKind, ReportFrequency Frequency,
        string TimeOfDay, int DayOfPeriod, bool Enabled, ReportDeliveryMethod DeliveryMethod,
        string? Recipients, string? FileDropPath);

    [HttpGet("schedules")]
    [HasPermission(PermissionKeys.ViewReports)]
    public async Task<ActionResult<IEnumerable<ScheduleDto>>> Schedules(CancellationToken ct)
    {
        var items = await _db.ReportSchedules.AsNoTracking().OrderBy(s => s.Name).ToListAsync(ct);
        return Ok(items.Select(ToDto));
    }

    [HttpPost("schedules")]
    [HasPermission(PermissionKeys.ManageReports)]
    public async Task<ActionResult<ScheduleDto>> CreateSchedule([FromBody] ScheduleUpsert req, CancellationToken ct)
    {
        var scheduled = LicenseEnforcement.CheckScheduledReports(_license);
        if (scheduled is not null) return scheduled;

        var s = new ReportSchedule();
        Apply(s, req);
        s.NextRunUtc = Api.Reporting.ReportSchedulerWorker.ComputeNextRun(s, DateTimeOffset.UtcNow);
        _db.ReportSchedules.Add(s);
        await _db.SaveChangesAsync(ct);
        return Ok(ToDto(s));
    }

    [HttpPut("schedules/{id:guid}")]
    [HasPermission(PermissionKeys.ManageReports)]
    public async Task<ActionResult<ScheduleDto>> UpdateSchedule(Guid id, [FromBody] ScheduleUpsert req, CancellationToken ct)
    {
        var s = await _db.ReportSchedules.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (s is null) return NotFound();
        Apply(s, req);
        s.UpdatedUtc = DateTimeOffset.UtcNow;
        s.NextRunUtc = Api.Reporting.ReportSchedulerWorker.ComputeNextRun(s, DateTimeOffset.UtcNow);
        await _db.SaveChangesAsync(ct);
        return Ok(ToDto(s));
    }

    [HttpDelete("schedules/{id:guid}")]
    [HasPermission(PermissionKeys.ManageReports)]
    public async Task<IActionResult> DeleteSchedule(Guid id, CancellationToken ct)
    {
        var s = await _db.ReportSchedules.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (s is null) return NotFound();
        _db.ReportSchedules.Remove(s);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpPost("schedules/{id:guid}/run-now")]
    [HasPermission(PermissionKeys.ManageReports)]
    public async Task<IActionResult> RunNow(Guid id, CancellationToken ct)
    {
        var s = await _db.ReportSchedules.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (s is null) return NotFound();

        var level = Enum.TryParse<EntityLevel>(s.ScopeLevel, out var lvl) ? lvl : EntityLevel.Plant;
        try
        {
            var report = await _reports.GenerateAsync(s.ReportTemplateId, level, s.ScopeId, s.RangeKind,
                s.Format, triggeredBy: $"manual:{User.Identity?.Name}", scheduleId: s.Id, ct: ct);
            await _delivery.DeliverAsync(s, report, ct);
            s.LastRunUtc = DateTimeOffset.UtcNow;
            s.LastStatus = ReportRunStatus.Success;
            s.LastError = null;
            await _db.SaveChangesAsync(ct);
            return Ok(new { delivered = true });
        }
        catch (Exception ex)
        {
            s.LastRunUtc = DateTimeOffset.UtcNow;
            s.LastStatus = ReportRunStatus.Failed;
            s.LastError = ex.Message;
            await _db.SaveChangesAsync(ct);
            return BadRequest(new { error = ex.Message });
        }
    }

    // ----- SMTP settings -----

    public record SmtpDto(string Host, int Port, bool UseSsl, string? Username, bool HasPassword,
        string FromAddress, string FromName);
    public record SmtpUpsert(string Host, int Port, bool UseSsl, string? Username, string? Password,
        string FromAddress, string FromName);

    [HttpGet("smtp")]
    [HasPermission(PermissionKeys.ManageReports)]
    public async Task<ActionResult<SmtpDto>> GetSmtp(CancellationToken ct)
    {
        var s = await _db.SmtpSettings.AsNoTracking().FirstOrDefaultAsync(ct);
        if (s is null) return Ok(new SmtpDto("", 587, true, null, false, "connectoee@localhost", "ConnectOEE"));
        return Ok(new SmtpDto(s.Host, s.Port, s.UseSsl, s.Username, !string.IsNullOrEmpty(s.Password), s.FromAddress, s.FromName));
    }

    [HttpPut("smtp")]
    [HasPermission(PermissionKeys.ManageReports)]
    public async Task<ActionResult<SmtpDto>> SaveSmtp([FromBody] SmtpUpsert req, CancellationToken ct)
    {
        var s = await _db.SmtpSettings.FirstOrDefaultAsync(ct);
        if (s is null)
        {
            s = new SmtpSetting { Id = SmtpSetting.SingletonId };
            _db.SmtpSettings.Add(s);
        }
        s.Host = req.Host;
        s.Port = req.Port;
        s.UseSsl = req.UseSsl;
        s.Username = req.Username;
        // Only overwrite the password when a new value is supplied (UI sends blank to keep).
        if (!string.IsNullOrEmpty(req.Password)) s.Password = req.Password;
        s.FromAddress = req.FromAddress;
        s.FromName = req.FromName;
        s.UpdatedUtc = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Ok(new SmtpDto(s.Host, s.Port, s.UseSsl, s.Username, !string.IsNullOrEmpty(s.Password), s.FromAddress, s.FromName));
    }

    public record SmtpTestRequest(string Recipient);

    [HttpPost("smtp/test")]
    [HasPermission(PermissionKeys.ManageReports)]
    public async Task<IActionResult> TestSmtp([FromBody] SmtpTestRequest req, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(req.Recipient))
            return BadRequest(new { message = "Recipient is required" });
        try
        {
            await _delivery.SendTestEmailAsync(req.Recipient.Trim(), ct);
            return Ok(new { sent = true });
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    // ----- Mapping helpers -----

    private static void Apply(ReportSchedule s, ScheduleUpsert req)
    {
        s.Name = req.Name;
        s.ReportTemplateId = req.ReportTemplateId;
        s.Format = req.Format;
        s.ScopeLevel = req.ScopeLevel;
        s.ScopeId = req.ScopeId;
        s.RangeKind = req.RangeKind;
        s.Frequency = req.Frequency;
        s.TimeOfDay = TimeOnly.TryParse(req.TimeOfDay, out var t) ? t : new TimeOnly(6, 0);
        s.DayOfPeriod = req.DayOfPeriod;
        s.Enabled = req.Enabled;
        s.DeliveryMethod = req.DeliveryMethod;
        s.Recipients = req.Recipients;
        s.FileDropPath = req.FileDropPath;
    }

    private static ScheduleDto ToDto(ReportSchedule s) => new(
        s.Id, s.Name, s.ReportTemplateId, s.Format.ToString(), s.ScopeLevel, s.ScopeId,
        s.RangeKind.ToString(), s.Frequency.ToString(), s.TimeOfDay.ToString("HH:mm"), s.DayOfPeriod,
        s.Enabled, s.DeliveryMethod.ToString(), s.Recipients, s.FileDropPath,
        s.NextRunUtc, s.LastRunUtc, s.LastStatus?.ToString(), s.LastError);
}

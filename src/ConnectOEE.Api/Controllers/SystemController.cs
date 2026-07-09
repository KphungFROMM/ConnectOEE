using System.Diagnostics;
using System.Reflection;
using ConnectOEE.Api.Auth;
using ConnectOEE.Api.Live;
using ConnectOEE.Core;
using ConnectOEE.Core.Abstractions;
using ConnectOEE.Core.Entities;
using ConnectOEE.Core.Entities.Security;
using ConnectOEE.Infrastructure;
using ConnectOEE.Infrastructure.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Npgsql;

namespace ConnectOEE.Api.Controllers;

/// <summary>
/// System / operations surface for the Admin screen: version + health info, historian
/// retention/compression policy summary, and on-demand database backups (pg_dump).
/// Backup/restore ops are gated to hierarchy managers (Admin) and audited.
/// </summary>
[ApiController]
[Route("api/system")]
[Authorize]
public class SystemController : ControllerBase
{
    private readonly ConnectOeeDbContext _db;
    private readonly IConfiguration _config;
    private readonly IHostEnvironment _env;
    private readonly IAuditService _audit;
    private readonly DriverRegistry _registry;
    private readonly ClientPresenceRegistry _presence;
    private readonly LiveHubConnectionCounter _hubConnections;
    private readonly TagPreviewRegistry _tagPreview;
    private readonly SnapshotCache _snapshots;
    private readonly UserManager<AppUser> _userManager;
    private readonly SecurityOptions _security;
    private readonly ILogger<SystemController> _logger;

    public SystemController(ConnectOeeDbContext db, IConfiguration config, IHostEnvironment env,
        IAuditService audit, DriverRegistry registry, ClientPresenceRegistry presence,
        LiveHubConnectionCounter hubConnections, TagPreviewRegistry tagPreview, SnapshotCache snapshots,
        UserManager<AppUser> userManager, IOptions<SecurityOptions> security,
        ILogger<SystemController> logger)
    {
        _db = db;
        _config = config;
        _env = env;
        _audit = audit;
        _registry = registry;
        _presence = presence;
        _hubConnections = hubConnections;
        _tagPreview = tagPreview;
        _snapshots = snapshots;
        _userManager = userManager;
        _security = security.Value;
        _logger = logger;
    }

    public record CommissioningCheck(string Key, string Label, bool Passed, string? Detail, bool Required = true);
    public record CommissioningStatus(Guid LineId, string LineName, bool Ready, IReadOnlyList<CommissioningCheck> Checks);

    public record RetentionPolicy(string Hypertable, string PolicyType, string? Schedule);
    public record SystemInfo(
        string Version, string Environment, DateTimeOffset ServerTimeUtc, DateTimeOffset StartedUtc,
        double UptimeHours, bool DatabaseReachable, IReadOnlyList<RetentionPolicy> Policies);
    public record BackupFile(string Name, long SizeBytes, DateTimeOffset CreatedUtc);

    public record PresenceRequest(
        Guid SessionId, string ClientKind, string? Route, string? PageLabel, string? Theme,
        Guid? KioskDashboardId, string? KioskDashboardName, Guid? LineId, string? LineName);

    public record ClientSessionDto(
        Guid SessionId, string ClientKind, Guid? UserId, string? UserName, string? DisplayName,
        string? Route, string? PageLabel, string? Theme,
        Guid? KioskDashboardId, string? KioskDashboardName, Guid? LineId, string? LineName,
        DateTimeOffset ConnectedUtc, DateTimeOffset LastSeenUtc);

    public record MonitorSummary(
        int StaffSessions, int OperatorSessions, int KioskSessions, int UniqueUsers,
        int SignalRConnections, int TagPreviewClients);

    public record PipelineHealth(int Connected, int Stale, int Disconnected, int Total);

    public record RecentSignInDto(DateTimeOffset TimestampUtc, string? UserName, string? Result);

    public record ReportScheduleHealthDto(
        Guid Id, string Name, bool Enabled, DateTimeOffset? NextRunUtc, string? LastError);

    public record SystemMonitorDto(
        MonitorSummary Summary,
        IReadOnlyList<ClientSessionDto> Sessions,
        PipelineHealth Pipeline,
        IReadOnlyList<RecentSignInDto> RecentSignIns,
        int EnabledSchedules,
        IReadOnlyList<ReportScheduleHealthDto> UpcomingSchedules,
        IReadOnlyList<ReportScheduleHealthDto> SchedulesWithErrors);

    /// <summary>Heartbeat from a browser tab or kiosk display (30s interval).</summary>
    [HttpPost("presence")]
    [AllowAnonymous]
    public async Task<IActionResult> PresenceHeartbeat([FromBody] PresenceRequest req, CancellationToken ct)
    {
        if (req.SessionId == Guid.Empty) return BadRequest(new { message = "sessionId is required" });

        var kind = (req.ClientKind ?? "Staff").Trim();
        if (kind is not ("Staff" or "Operator" or "Kiosk"))
            return BadRequest(new { message = "Invalid clientKind" });

        Guid? userId = null;
        string? userName = null;
        string? displayName = null;

        if (User.Identity?.IsAuthenticated == true)
        {
            userId = User.GetUserId();
            userName = User.GetUserName();
            displayName = User.FindFirst("display_name")?.Value ?? userName;
        }
        else if (kind != "Kiosk")
            return Unauthorized(new { message = "Authentication required" });

        Guid? kioskId = req.KioskDashboardId;
        string? kioskName = req.KioskDashboardName;
        Guid? lineId = req.LineId;
        string? lineName = req.LineName;

        if (kind == "Kiosk")
        {
            if (kioskId is null || kioskId == Guid.Empty)
                return BadRequest(new { message = "kioskDashboardId is required for kiosk clients" });

            var dash = await _db.Dashboards.AsNoTracking()
                .FirstOrDefaultAsync(d => d.Id == kioskId.Value, ct);
            if (dash is null || dash.Scope != DashboardScope.PublicKiosk || !dash.IsPublished || dash.LineId is null)
                return NotFound(new { message = "Kiosk dashboard not found or not published" });

            kioskName ??= dash.Name;
            lineId ??= dash.LineId;
            if (lineName is null && lineId is { } lid)
            {
                lineName = await _db.Lines.AsNoTracking()
                    .Where(l => l.Id == lid)
                    .Select(l => l.Name)
                    .FirstOrDefaultAsync(ct);
            }
        }

        _presence.Touch(new ClientPresence
        {
            SessionId = req.SessionId,
            ClientKind = kind,
            UserId = userId,
            UserName = userName,
            DisplayName = displayName,
            Route = req.Route,
            PageLabel = req.PageLabel,
            Theme = req.Theme,
            KioskDashboardId = kioskId,
            KioskDashboardName = kioskName,
            LineId = lineId,
            LineName = lineName,
        });

        return NoContent();
    }

    [HttpDelete("presence/{sessionId:guid}")]
    [AllowAnonymous]
    public IActionResult RemovePresence(Guid sessionId)
    {
        _presence.Remove(sessionId);
        return NoContent();
    }

    [HttpGet("monitor")]
    [HasPermission(PermissionKeys.ManageUsers)]
    public async Task<ActionResult<SystemMonitorDto>> Monitor(CancellationToken ct)
    {
        var sessions = _presence.ActiveSessions();
        var sessionDtos = sessions.Select(s => new ClientSessionDto(
            s.SessionId, s.ClientKind, s.UserId, s.UserName, s.DisplayName,
            s.Route, s.PageLabel, s.Theme,
            s.KioskDashboardId, s.KioskDashboardName, s.LineId, s.LineName,
            s.ConnectedUtc, s.LastSeenUtc)).ToList();

        var uniqueUsers = sessions
            .Where(s => s.UserId is not null)
            .Select(s => s.UserId!.Value)
            .Distinct()
            .Count();

        var summary = new MonitorSummary(
            sessions.Count(s => s.ClientKind == "Staff"),
            sessions.Count(s => s.ClientKind == "Operator"),
            sessions.Count(s => s.ClientKind == "Kiosk"),
            uniqueUsers,
            Math.Max(0, _hubConnections.ConnectionCount),
            _tagPreview.Snapshot().Count);

        var snaps = _snapshots.All();
        var pipeline = new PipelineHealth(
            snaps.Count(s => s.ConnectionState == "Connected"),
            snaps.Count(s => s.ConnectionState is "Stale" or "Connecting" or "Faulted"),
            snaps.Count(s => s.ConnectionState is "Disconnected" or "Unknown"),
            snaps.Count);

        var recentSignIns = await _db.AuditLogs.AsNoTracking()
            .Where(a => a.Action == "auth.login")
            .OrderByDescending(a => a.TimestampUtc)
            .Take(10)
            .Select(a => new RecentSignInDto(a.TimestampUtc, a.UserName, a.Result))
            .ToListAsync(ct);

        var schedules = await _db.ReportSchedules.AsNoTracking().ToListAsync(ct);
        var enabled = schedules.Where(s => s.Enabled).ToList();
        var upcoming = enabled
            .Where(s => s.NextRunUtc is not null)
            .OrderBy(s => s.NextRunUtc)
            .Take(3)
            .Select(s => new ReportScheduleHealthDto(s.Id, s.Name, s.Enabled, s.NextRunUtc, s.LastError))
            .ToList();
        var withErrors = schedules
            .Where(s => !string.IsNullOrWhiteSpace(s.LastError))
            .OrderByDescending(s => s.LastRunUtc)
            .Take(5)
            .Select(s => new ReportScheduleHealthDto(s.Id, s.Name, s.Enabled, s.NextRunUtc, s.LastError))
            .ToList();

        return Ok(new SystemMonitorDto(
            summary, sessionDtos, pipeline, recentSignIns,
            enabled.Count, upcoming, withErrors));
    }

    public record SecurityCommissioningStatus(bool Ready, IReadOnlyList<CommissioningCheck> Checks);

    /// <summary>Cybersecurity go/no-go checks before factory go-live.</summary>
    [HttpGet("security-commissioning")]
    [HasPermission(PermissionKeys.ManageHierarchy)]
    public async Task<ActionResult<SecurityCommissioningStatus>> SecurityCommissioning(CancellationToken ct)
    {
        var requireHttps = _config.GetValue("Security:RequireHttps", _security.RequireHttps);
        var httpsOk = Request.IsHttps || !requireHttps || _env.IsDevelopment();

        var stalePasswords = await _db.Users.CountAsync(u => u.MustChangePassword && u.IsActive, ct);
        var passwordsOk = stalePasswords == 0;

        var admins = await _userManager.GetUsersInRoleAsync(RoleNames.Admin);
        var mfaOk = admins.Count > 0;
        foreach (var admin in admins)
        {
            if (!await _userManager.GetTwoFactorEnabledAsync(admin))
            {
                mfaOk = false;
                break;
            }
        }

        var jwtKey = _config["Jwt:SigningKey"] ?? string.Empty;
        var jwtOk = !jwtKey.Contains("REPLACE_IN_LOCAL", StringComparison.OrdinalIgnoreCase)
                    && jwtKey.Length >= 32;

        var checks = new List<CommissioningCheck>
        {
            new("https", "HTTPS enabled (or reverse-proxy TLS documented)", httpsOk,
                httpsOk ? null : "Enable TLS on ConnectOEE or terminate at IIS/nginx"),
            new("passwordsChanged", "No active users with default password flag", passwordsOk,
                passwordsOk ? null : $"{stalePasswords} user(s) must change password"),
            new("adminMfa", "MFA enabled for all Admin accounts", mfaOk,
                mfaOk ? null : "Enable MFA under Admin account settings"),
            new("jwtSecret", "Production JWT signing key configured", jwtOk,
                jwtOk ? null : "Set Jwt:SigningKey via secure config (32+ chars)"),
        };

        var ready = checks.All(c => c.Passed);
        return Ok(new SecurityCommissioningStatus(ready, checks));
    }

    [HttpGet("info")]
    public async Task<ActionResult<SystemInfo>> Info(CancellationToken ct)
    {
        var version = Assembly.GetExecutingAssembly().GetName().Version?.ToString() ?? "1.0.0";
        var started = Process.GetCurrentProcess().StartTime.ToUniversalTime();
        var startedUtc = new DateTimeOffset(started, TimeSpan.Zero);

        var dbOk = await DatabaseReachableAsync(ct);
        var policies = await ReadRetentionPoliciesAsync(ct);

        return Ok(new SystemInfo(
            version, _env.EnvironmentName, DateTimeOffset.UtcNow, startedUtc,
            Math.Round((DateTimeOffset.UtcNow - startedUtc).TotalHours, 2), dbOk, policies));
    }

    [HttpGet("backups")]
    [HasPermission(PermissionKeys.ManageHierarchy)]
    public ActionResult<IEnumerable<BackupFile>> Backups()
    {
        var dir = BackupDir();
        if (!Directory.Exists(dir)) return Ok(Array.Empty<BackupFile>());
        var files = new DirectoryInfo(dir).GetFiles("*.*")
            .Where(f => f.Extension is ".dump" or ".enc")
            .OrderByDescending(f => f.CreationTimeUtc)
            .Select(f => new BackupFile(f.Name, f.Length, new DateTimeOffset(f.CreationTimeUtc, TimeSpan.Zero)))
            .ToList();
        return Ok(files);
    }

    [HttpPost("backup")]
    [HasPermission(PermissionKeys.ManageHierarchy)]
    public async Task<ActionResult<BackupFile>> Backup(CancellationToken ct)
    {
        var csb = new NpgsqlConnectionStringBuilder(ConnString());
        var dir = BackupDir();
        Directory.CreateDirectory(dir);
        var name = $"connectoee-{DateTime.UtcNow:yyyyMMdd-HHmmss}.dump";
        var fullPath = Path.Combine(dir, name);

        var psi = new ProcessStartInfo
        {
            FileName = "pg_dump",
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true,
        };
        // Custom format (-Fc) is compressed + restorable with pg_restore.
        psi.ArgumentList.Add("-h"); psi.ArgumentList.Add(csb.Host ?? "localhost");
        psi.ArgumentList.Add("-p"); psi.ArgumentList.Add((csb.Port == 0 ? 5432 : csb.Port).ToString());
        psi.ArgumentList.Add("-U"); psi.ArgumentList.Add(csb.Username ?? "postgres");
        psi.ArgumentList.Add("-d"); psi.ArgumentList.Add(csb.Database ?? "connectoee");
        psi.ArgumentList.Add("-Fc");
        psi.ArgumentList.Add("-f"); psi.ArgumentList.Add(fullPath);
        psi.Environment["PGPASSWORD"] = csb.Password ?? string.Empty;

        try
        {
            using var proc = Process.Start(psi);
            if (proc is null) return StatusCode(500, new { message = "Failed to start pg_dump" });
            var stderr = await proc.StandardError.ReadToEndAsync(ct);
            await proc.WaitForExitAsync(ct);
            if (proc.ExitCode != 0)
            {
                _logger.LogWarning("pg_dump failed ({Code}): {Err}", proc.ExitCode, stderr);
                return StatusCode(500, new { message = $"pg_dump exited {proc.ExitCode}: {stderr}" });
            }
        }
        catch (Exception ex) when (ex is System.ComponentModel.Win32Exception)
        {
            return StatusCode(500, new { message = "pg_dump not found on PATH. Install PostgreSQL client tools to enable backups." });
        }

        var info = new FileInfo(fullPath);
        var backupName = name;
        var backupSize = info.Length;

        var encKey = BackupEncryption.TryParseKey(
            WindowsSecretProtector.Resolve(_security.BackupEncryptionKey));
        if (encKey is not null)
        {
            var encPath = fullPath + ".enc";
            await BackupEncryption.EncryptFileAsync(fullPath, encPath, encKey, ct);
            System.IO.File.Delete(fullPath);
            var encInfo = new FileInfo(encPath);
            backupName = encInfo.Name;
            backupSize = encInfo.Length;
        }

        await _audit.LogAsync("system.backup", User.GetUserId(), User.GetUserName(),
            entityType: "Database", details: new { name = backupName, size = backupSize, encrypted = encKey is not null });
        return Ok(new BackupFile(backupName, backupSize, new DateTimeOffset(info.CreationTimeUtc, TimeSpan.Zero)));
    }

    /// <summary>Go/no-go commissioning checklist for a line before field connect.</summary>
    [HttpGet("commissioning")]
    public async Task<ActionResult<CommissioningStatus>> Commissioning([FromQuery] Guid lineId, CancellationToken ct)
    {
        var line = await _db.Lines.AsNoTracking()
            .Include(l => l.Machines)
            .FirstOrDefaultAsync(l => l.Id == lineId, ct);
        if (line is null) return NotFound();

        var machineIds = line.Machines.Select(m => m.Id).ToList();
        var signals = await _db.LogicalSignals.AsNoTracking()
            .Include(s => s.Mapping)
            .Where(s => s.MachineId != null && machineIds.Contains(s.MachineId.Value))
            .ToListAsync(ct);

        var runStateSignals = signals.Where(s => s.Role == SignalRole.RunState).ToList();
        var runStateMapped = runStateSignals.Count > 0 && runStateSignals.All(s => s.Mapping != null);
        var runStateModeOk = runStateSignals.All(s =>
            s.Mapping is null ||
            s.RunStateIngestMode != RunStateIngestMode.DirectEnum ||
            s.ExpectedType != TagDataType.Bool);
        var goodCountMapped = line.Machines.Count > 0 && line.Machines.All(m =>
            signals.Any(s => s.MachineId == m.Id && s.Role == SignalRole.GoodCount && s.Mapping != null));
        var partIdMapped = signals.Any(s => s.Role == SignalRole.PartId && s.Mapping != null);
        var recipeCount = await _db.ProductRecipes.CountAsync(r => r.IsActive, ct);
        var kioskBound = await _db.Dashboards.AnyAsync(d =>
            d.Scope == DashboardScope.PublicKiosk && d.IsPublished && d.LineId == lineId, ct);
        var plcHealthy = _registry.AreLineMachinesHealthy(machineIds);

        var checks = new List<CommissioningCheck>
        {
            new("runStateMapped", "Run State tag mapped (every machine)", runStateMapped,
                runStateMapped ? null : "Map Run State on every machine"),
            new("runStateMode", "Run State ingest mode configured for BOOL tags", runStateModeOk || !runStateMapped,
                runStateModeOk ? null : "Set SingleBool or MultiBool when Run State is a BOOL tag"),
            new("goodCountMapped", "Good Count tag mapped (every machine)", goodCountMapped,
                goodCountMapped ? null : "Map Good Count on every machine"),
            new("partIdMapped", "Part ID / recipe tag mapped", partIdMapped,
                partIdMapped ? "PartId mapped — PLC drives active product" : "Optional — use software product selection or auto-stub",
                Required: false),
            new("recipes", "Product catalog entries", recipeCount > 0,
                recipeCount > 0 ? $"{recipeCount} product(s) in catalog" : "Optional — auto-create from unknown PLC PartId",
                Required: false),
            new("kioskBound", "Kiosk dashboard bound to line", kioskBound,
                kioskBound ? null : "Publish a kiosk dashboard with this lineId"),
            new("plcHealthy", "PLC driver connected for line machines", plcHealthy,
                plcHealthy ? null : "Enable a driver covering all machines on this line"),
        };

        var ready = checks.Where(c => c.Required).All(c => c.Passed);

        return Ok(new CommissioningStatus(lineId, line.Name, ready, checks));
    }

    // ----- helpers -----

    private string ConnString() =>
        _config.GetConnectionString(DependencyInjection.ConnectionStringName)
        ?? Environment.GetEnvironmentVariable("CONNECTOEE_CONNECTION")
        ?? "Host=localhost;Port=5432;Database=connectoee;Username=connectoee;Password=connectoee_dev_pw";

    private string BackupDir() => Path.Combine(_env.ContentRootPath, "backups");

    private async Task<bool> DatabaseReachableAsync(CancellationToken ct)
    {
        try { return await _db.Database.CanConnectAsync(ct); }
        catch { return false; }
    }

    private async Task<IReadOnlyList<RetentionPolicy>> ReadRetentionPoliciesAsync(CancellationToken ct)
    {
        // Best-effort: read TimescaleDB background jobs (retention/compression/aggregation).
        const string sql = @"select hypertable_name, proc_name, schedule_interval::text
                             from timescaledb_information.jobs
                             order by hypertable_name, proc_name";
        var result = new List<RetentionPolicy>();
        try
        {
            await using var conn = new NpgsqlConnection(ConnString());
            await conn.OpenAsync(ct);
            await using var cmd = new NpgsqlCommand(sql, conn);
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                var ht = reader.IsDBNull(0) ? "(global)" : reader.GetString(0);
                var proc = reader.IsDBNull(1) ? "" : reader.GetString(1);
                var sched = reader.IsDBNull(2) ? null : reader.GetString(2);
                result.Add(new RetentionPolicy(ht, FriendlyPolicy(proc), sched));
            }
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Retention policy read failed (TimescaleDB may be unavailable)");
        }
        return result;
    }

    private static string FriendlyPolicy(string proc) => proc switch
    {
        "policy_retention" => "Retention",
        "policy_compression" => "Compression",
        "policy_refresh_continuous_aggregate" => "Continuous aggregate refresh",
        _ => proc,
    };
}

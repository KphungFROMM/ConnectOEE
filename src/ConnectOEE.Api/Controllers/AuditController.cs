using ConnectOEE.Api.Auth;
using ConnectOEE.Core.Entities.Security;
using ConnectOEE.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text;

namespace ConnectOEE.Api.Controllers;

[ApiController]
[Route("api/audit")]
[HasPermission(PermissionKeys.ManageUsers)]
public class AuditController : ControllerBase
{
    private readonly ConnectOeeDbContext _db;

    public AuditController(ConnectOeeDbContext db) => _db = db;

    public record AuditLogDto(
        Guid Id, DateTimeOffset TimestampUtc, string Action, Guid? UserId, string? UserName,
        string? EntityType, string? EntityId, string? Result, string? DetailsJson);

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<AuditLogDto>>> List(
        [FromQuery] DateTimeOffset? from,
        [FromQuery] DateTimeOffset? to,
        [FromQuery] string? action,
        [FromQuery] int take = 200,
        CancellationToken ct = default)
    {
        take = Math.Clamp(take, 1, 2000);
        var query = _db.AuditLogs.AsNoTracking().AsQueryable();
        if (from is { } f) query = query.Where(a => a.TimestampUtc >= f);
        if (to is { } t) query = query.Where(a => a.TimestampUtc <= t);
        if (!string.IsNullOrWhiteSpace(action))
            query = query.Where(a => a.Action == action);

        var rows = await query
            .OrderByDescending(a => a.TimestampUtc)
            .Take(take)
            .Select(a => new AuditLogDto(
                a.Id, a.TimestampUtc, a.Action, a.UserId, a.UserName,
                a.EntityType, a.EntityId, a.Result, a.DetailsJson))
            .ToListAsync(ct);
        return Ok(rows);
    }

    [HttpGet("export")]
    public async Task<IActionResult> ExportCsv(
        [FromQuery] DateTimeOffset? from,
        [FromQuery] DateTimeOffset? to,
        [FromQuery] int take = 5000,
        CancellationToken ct = default)
    {
        take = Math.Clamp(take, 1, 10000);
        var query = _db.AuditLogs.AsNoTracking().AsQueryable();
        if (from is { } f) query = query.Where(a => a.TimestampUtc >= f);
        if (to is { } t) query = query.Where(a => a.TimestampUtc <= t);

        var rows = await query
            .OrderByDescending(a => a.TimestampUtc)
            .Take(take)
            .ToListAsync(ct);

        var sb = new StringBuilder();
        sb.AppendLine("TimestampUtc,Action,UserName,EntityType,EntityId,Result,DetailsJson");
        foreach (var r in rows)
        {
            sb.Append(Esc(r.TimestampUtc.ToString("O"))).Append(',')
              .Append(Esc(r.Action)).Append(',')
              .Append(Esc(r.UserName)).Append(',')
              .Append(Esc(r.EntityType)).Append(',')
              .Append(Esc(r.EntityId)).Append(',')
              .Append(Esc(r.Result)).Append(',')
              .Append(Esc(r.DetailsJson))
              .AppendLine();
        }

        var bytes = Encoding.UTF8.GetBytes(sb.ToString());
        return File(bytes, "text/csv", $"connectoee-audit-{DateTime.UtcNow:yyyyMMdd-HHmmss}.csv");
    }

    private static string Esc(string? v)
    {
        if (string.IsNullOrEmpty(v)) return "";
        if (v.Contains('"') || v.Contains(',') || v.Contains('\n'))
            return $"\"{v.Replace("\"", "\"\"")}\"";
        return v;
    }
}

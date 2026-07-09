using System.Text.Json;
using ConnectOEE.Core.Abstractions;
using ConnectOEE.Core.Entities;

namespace ConnectOEE.Infrastructure.Auditing;

public class AuditService : IAuditService
{
    private readonly ConnectOeeDbContext _db;

    public AuditService(ConnectOeeDbContext db) => _db = db;

    public async Task LogAsync(
        string action,
        Guid? userId,
        string? userName,
        string? entityType = null,
        string? entityId = null,
        object? details = null,
        string? result = "Success",
        CancellationToken ct = default)
    {
        var entry = new AuditLog
        {
            Action = action,
            UserId = userId,
            UserName = userName,
            EntityType = entityType,
            EntityId = entityId,
            DetailsJson = details is null ? null : JsonSerializer.Serialize(details),
            Result = result,
            TimestampUtc = DateTimeOffset.UtcNow,
        };
        _db.AuditLogs.Add(entry);
        await _db.SaveChangesAsync(ct);
    }
}

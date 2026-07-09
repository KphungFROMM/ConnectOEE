namespace ConnectOEE.Core.Abstractions;

/// <summary>Writes immutable, append-only audit records for sensitive operations.</summary>
public interface IAuditService
{
    Task LogAsync(
        string action,
        Guid? userId,
        string? userName,
        string? entityType = null,
        string? entityId = null,
        object? details = null,
        string? result = "Success",
        CancellationToken ct = default);
}

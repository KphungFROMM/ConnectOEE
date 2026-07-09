using System.ComponentModel.DataAnnotations;

namespace ConnectOEE.Core.Entities;

/// <summary>Append-only audit record for sensitive operations (config, PLC writes).</summary>
public class AuditLog : EntityBase
{
    public Guid? UserId { get; set; }
    [MaxLength(200)]
    public string? UserName { get; set; }
    [MaxLength(150)]
    public string Action { get; set; } = string.Empty;
    [MaxLength(200)]
    public string? EntityType { get; set; }
    [MaxLength(200)]
    public string? EntityId { get; set; }
    /// <summary>Old/new values or write details as JSON.</summary>
    public string? DetailsJson { get; set; }
    [MaxLength(50)]
    public string? Result { get; set; }
    public DateTimeOffset TimestampUtc { get; set; } = DateTimeOffset.UtcNow;
}

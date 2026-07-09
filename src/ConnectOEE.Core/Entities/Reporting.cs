using System.ComponentModel.DataAnnotations;

namespace ConnectOEE.Core.Entities;

/// <summary>
/// A report layout (prebuilt or designer-authored). Built-in templates map to a
/// <see cref="ReportType"/>; custom templates carry a block layout in LayoutJson.
/// </summary>
public class ReportTemplate : EntityBase
{
    [MaxLength(200)]
    public string Name { get; set; } = string.Empty;
    [MaxLength(500)]
    public string? Description { get; set; }
    public ReportType ReportType { get; set; }
    public bool IsSystem { get; set; }
    public bool IsPublished { get; set; } = true;

    /// <summary>Designer block layout (sections/blocks/bindings) for Custom templates.</summary>
    public string LayoutJson { get; set; } = "{}";
}

/// <summary>
/// A recurring report job: which template, what scope/range parameters, schedule
/// cadence, and how it is delivered (email or file drop).
/// </summary>
public class ReportSchedule : EntityBase
{
    [MaxLength(200)]
    public string Name { get; set; } = string.Empty;

    public Guid ReportTemplateId { get; set; }
    public ReportTemplate? ReportTemplate { get; set; }

    public ReportFormat Format { get; set; } = ReportFormat.Pdf;

    // ----- Scope + range parameters (resolved at run time) -----
    /// <summary>Plant/Department/Line/Machine level name (matches Historian EntityLevel).</summary>
    [MaxLength(20)]
    public string ScopeLevel { get; set; } = "Plant";
    public Guid ScopeId { get; set; }
    public ReportRangeKind RangeKind { get; set; } = ReportRangeKind.Yesterday;

    // ----- Cadence -----
    public ReportFrequency Frequency { get; set; } = ReportFrequency.Daily;
    /// <summary>Local time-of-day the report should run.</summary>
    public TimeOnly TimeOfDay { get; set; } = new(6, 0);
    /// <summary>Day of week for weekly (0=Sunday). Day of month for monthly.</summary>
    public int DayOfPeriod { get; set; } = 1;
    public bool Enabled { get; set; } = true;

    // ----- Delivery -----
    public ReportDeliveryMethod DeliveryMethod { get; set; } = ReportDeliveryMethod.Email;
    /// <summary>Comma/semicolon separated recipient emails (Email delivery).</summary>
    [MaxLength(2000)]
    public string? Recipients { get; set; }
    /// <summary>Target folder for FileDrop delivery (local/UNC path).</summary>
    [MaxLength(500)]
    public string? FileDropPath { get; set; }

    // ----- Run bookkeeping -----
    public DateTimeOffset? NextRunUtc { get; set; }
    public DateTimeOffset? LastRunUtc { get; set; }
    public ReportRunStatus? LastStatus { get; set; }
    [MaxLength(1000)]
    public string? LastError { get; set; }
}

/// <summary>A single generated report (scheduled or on-demand) with its artifact path.</summary>
public class ReportRun : EntityBase
{
    public Guid ReportTemplateId { get; set; }
    public Guid? ReportScheduleId { get; set; }

    [MaxLength(300)]
    public string Title { get; set; } = string.Empty;
    public ReportFormat Format { get; set; }
    public DateTimeOffset GeneratedUtc { get; set; } = DateTimeOffset.UtcNow;
    public ReportRunStatus Status { get; set; } = ReportRunStatus.Pending;

    /// <summary>Stored artifact path on the server (for download / re-delivery).</summary>
    [MaxLength(500)]
    public string? FilePath { get; set; }
    [MaxLength(1000)]
    public string? Error { get; set; }
    [MaxLength(200)]
    public string? TriggeredBy { get; set; }
}

/// <summary>
/// Single-row SMTP configuration for email delivery (Id is a fixed well-known Guid).
/// Password is stored as-is for an on-prem deployment; treat the DB as a secret store.
/// </summary>
public class SmtpSetting : EntityBase
{
    public static readonly Guid SingletonId = new("00000000-0000-0000-0000-0000000000aa");

    [MaxLength(200)]
    public string Host { get; set; } = string.Empty;
    public int Port { get; set; } = 587;
    public bool UseSsl { get; set; } = true;
    [MaxLength(200)]
    public string? Username { get; set; }
    [MaxLength(500)]
    public string? Password { get; set; }
    [MaxLength(200)]
    public string FromAddress { get; set; } = "connectoee@localhost";
    [MaxLength(200)]
    public string FromName { get; set; } = "ConnectOEE";
}

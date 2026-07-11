using System.ComponentModel.DataAnnotations;

namespace ConnectOEE.Core.Entities;

/// <summary>
/// Single-row site appearance (KPI identity, status colors, header branding).
/// Id is a fixed well-known Guid.
/// </summary>
public class AppearanceSetting : EntityBase
{
    public static readonly Guid SingletonId = new("00000000-0000-0000-0000-0000000000ab");

    /// <summary>OEE factor identity hex (#RRGGBB).</summary>
    [MaxLength(7)]
    public string OeeHex { get; set; } = "#2E9E5B";

    [MaxLength(7)]
    public string AvailabilityHex { get; set; } = "#2563EB";

    [MaxLength(7)]
    public string PerformanceHex { get; set; } = "#6366F1";

    [MaxLength(7)]
    public string QualityHex { get; set; } = "#9333EA";

    /// <summary>Industrial status / Andon hex colors.</summary>
    [MaxLength(7)]
    public string RunningHex { get; set; } = "#2E9E5B";

    [MaxLength(7)]
    public string WarningHex { get; set; } = "#E0A800";

    [MaxLength(7)]
    public string FaultHex { get; set; } = "#D64545";

    [MaxLength(7)]
    public string IdleHex { get; set; } = "#8A929E";

    /// <summary>Custom header title. Empty = use product name ConnectOEE.</summary>
    [MaxLength(80)]
    public string HeaderTitle { get; set; } = string.Empty;

    /// <summary>
    /// Header logo URL (absolute or app-relative). Empty = default /app-icon.png.
    /// Uploaded logos are served from /api/settings/appearance/logo.
    /// </summary>
    [MaxLength(500)]
    public string HeaderLogoUrl { get; set; } = string.Empty;
}

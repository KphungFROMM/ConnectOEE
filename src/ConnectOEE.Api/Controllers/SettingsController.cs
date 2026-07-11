using System.Text.RegularExpressions;
using ConnectOEE.Api.Auth;
using ConnectOEE.Core.Entities;
using ConnectOEE.Core.Entities.Security;
using ConnectOEE.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ConnectOEE.Api.Controllers;

[ApiController]
[Route("api/settings")]
[Authorize]
public class SettingsController : ControllerBase
{
    private static readonly Regex HexRegex = new(@"^#[0-9A-Fa-f]{6}$", RegexOptions.Compiled);
    private static readonly HashSet<string> AllowedLogoExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg",
    };

    private readonly ConnectOeeDbContext _db;
    private readonly IWebHostEnvironment _env;

    public SettingsController(ConnectOeeDbContext db, IWebHostEnvironment env)
    {
        _db = db;
        _env = env;
    }

    public record AppearanceDto(
        string OeeHex,
        string AvailabilityHex,
        string PerformanceHex,
        string QualityHex,
        string RunningHex,
        string WarningHex,
        string FaultHex,
        string IdleHex,
        string HeaderTitle,
        string HeaderLogoUrl);

    /// <summary>Any authenticated user — walls/builder need live identity colors + header branding.</summary>
    [HttpGet("appearance")]
    public async Task<ActionResult<AppearanceDto>> GetAppearance(CancellationToken ct)
    {
        var s = await _db.AppearanceSettings.AsNoTracking().FirstOrDefaultAsync(ct);
        return Ok(ToDto(s));
    }

    [HttpPut("appearance")]
    [HasPermission(PermissionKeys.ManageUsers)]
    public async Task<ActionResult<AppearanceDto>> SaveAppearance([FromBody] AppearanceDto req, CancellationToken ct)
    {
        if (!IsValidHex(req.OeeHex) || !IsValidHex(req.AvailabilityHex)
            || !IsValidHex(req.PerformanceHex) || !IsValidHex(req.QualityHex)
            || !IsValidHex(req.RunningHex) || !IsValidHex(req.WarningHex)
            || !IsValidHex(req.FaultHex) || !IsValidHex(req.IdleHex))
        {
            return BadRequest(new { message = "Each color must be #RRGGBB." });
        }

        var title = (req.HeaderTitle ?? string.Empty).Trim();
        if (title.Length > 80)
            return BadRequest(new { message = "Header title must be 80 characters or fewer." });

        var logoUrl = (req.HeaderLogoUrl ?? string.Empty).Trim();
        if (logoUrl.Length > 500)
            return BadRequest(new { message = "Logo URL must be 500 characters or fewer." });

        var s = await GetOrCreateAsync(ct);
        s.OeeHex = NormalizeHex(req.OeeHex);
        s.AvailabilityHex = NormalizeHex(req.AvailabilityHex);
        s.PerformanceHex = NormalizeHex(req.PerformanceHex);
        s.QualityHex = NormalizeHex(req.QualityHex);
        s.RunningHex = NormalizeHex(req.RunningHex);
        s.WarningHex = NormalizeHex(req.WarningHex);
        s.FaultHex = NormalizeHex(req.FaultHex);
        s.IdleHex = NormalizeHex(req.IdleHex);
        s.HeaderTitle = title;
        s.HeaderLogoUrl = logoUrl;
        s.UpdatedUtc = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Ok(ToDto(s));
    }

    [HttpPost("appearance/reset")]
    [HasPermission(PermissionKeys.ManageUsers)]
    public async Task<ActionResult<AppearanceDto>> ResetAppearance(CancellationToken ct)
    {
        var defaults = new AppearanceSetting();
        var s = await GetOrCreateAsync(ct);
        s.OeeHex = defaults.OeeHex;
        s.AvailabilityHex = defaults.AvailabilityHex;
        s.PerformanceHex = defaults.PerformanceHex;
        s.QualityHex = defaults.QualityHex;
        s.RunningHex = defaults.RunningHex;
        s.WarningHex = defaults.WarningHex;
        s.FaultHex = defaults.FaultHex;
        s.IdleHex = defaults.IdleHex;
        s.HeaderTitle = defaults.HeaderTitle;
        s.HeaderLogoUrl = defaults.HeaderLogoUrl;
        s.UpdatedUtc = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);
        TryDeleteUploadedLogo();
        return Ok(ToDto(s));
    }

    /// <summary>Upload a header logo image (png/jpg/webp/gif/svg, max 2 MB).</summary>
    [HttpPost("appearance/logo")]
    [HasPermission(PermissionKeys.ManageUsers)]
    [RequestSizeLimit(2_000_000)]
    public async Task<ActionResult<AppearanceDto>> UploadLogo(IFormFile? file, CancellationToken ct)
    {
        if (file is null || file.Length == 0)
            return BadRequest(new { message = "Choose an image file to upload." });
        if (file.Length > 2_000_000)
            return BadRequest(new { message = "Logo must be 2 MB or smaller." });

        var ext = Path.GetExtension(file.FileName);
        if (string.IsNullOrEmpty(ext) || !AllowedLogoExtensions.Contains(ext))
            return BadRequest(new { message = "Use PNG, JPG, WEBP, GIF, or SVG." });

        var dir = BrandingDir();
        Directory.CreateDirectory(dir);
        TryDeleteUploadedLogo();

        var dest = Path.Combine(dir, $"header-logo{ext.ToLowerInvariant()}");
        await using (var stream = System.IO.File.Create(dest))
            await file.CopyToAsync(stream, ct);

        var s = await GetOrCreateAsync(ct);
        s.HeaderLogoUrl = $"/api/settings/appearance/logo?v={DateTimeOffset.UtcNow.ToUnixTimeSeconds()}";
        s.UpdatedUtc = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Ok(ToDto(s));
    }

    /// <summary>Serve the uploaded header logo (public — used as &lt;img src&gt; without Bearer).</summary>
    [HttpGet("appearance/logo")]
    [AllowAnonymous]
    [ResponseCache(Duration = 3600, Location = ResponseCacheLocation.Client)]
    public IActionResult GetLogo()
    {
        var path = FindUploadedLogoPath();
        if (path is null) return NotFound();
        var contentType = Path.GetExtension(path).ToLowerInvariant() switch
        {
            ".svg" => "image/svg+xml",
            ".jpg" or ".jpeg" => "image/jpeg",
            ".webp" => "image/webp",
            ".gif" => "image/gif",
            _ => "image/png",
        };
        return PhysicalFile(path, contentType);
    }

    private async Task<AppearanceSetting> GetOrCreateAsync(CancellationToken ct)
    {
        var s = await _db.AppearanceSettings.FirstOrDefaultAsync(ct);
        if (s is not null) return s;
        s = new AppearanceSetting { Id = AppearanceSetting.SingletonId };
        _db.AppearanceSettings.Add(s);
        return s;
    }

    private string BrandingDir() =>
        Path.Combine(_env.ContentRootPath, "Assets", "branding");

    private string? FindUploadedLogoPath()
    {
        var dir = BrandingDir();
        if (!Directory.Exists(dir)) return null;
        return Directory.EnumerateFiles(dir, "header-logo.*").FirstOrDefault();
    }

    private void TryDeleteUploadedLogo()
    {
        var dir = BrandingDir();
        if (!Directory.Exists(dir)) return;
        foreach (var f in Directory.EnumerateFiles(dir, "header-logo.*"))
        {
            try { System.IO.File.Delete(f); } catch { /* ignore */ }
        }
    }

    private static AppearanceDto ToDto(AppearanceSetting? s)
    {
        var d = new AppearanceSetting();
        return new AppearanceDto(
            s?.OeeHex ?? d.OeeHex,
            s?.AvailabilityHex ?? d.AvailabilityHex,
            s?.PerformanceHex ?? d.PerformanceHex,
            s?.QualityHex ?? d.QualityHex,
            s?.RunningHex ?? d.RunningHex,
            s?.WarningHex ?? d.WarningHex,
            s?.FaultHex ?? d.FaultHex,
            s?.IdleHex ?? d.IdleHex,
            s?.HeaderTitle ?? d.HeaderTitle,
            s?.HeaderLogoUrl ?? d.HeaderLogoUrl);
    }

    private static bool IsValidHex(string? value) =>
        !string.IsNullOrWhiteSpace(value) && HexRegex.IsMatch(value.Trim());

    private static string NormalizeHex(string value) => value.Trim().ToUpperInvariant();
}

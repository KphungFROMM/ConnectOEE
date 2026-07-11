using ConnectOEE.Core.Licensing;
using ConnectOEE.Infrastructure;
using ConnectOEE.Core;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ConnectOEE.Api.Services;

public static class LicenseEnforcement
{
    public static ActionResult? RequireValidLicense(ILicenseService license)
    {
        if (license.IsValid)
            return null;

        return new ObjectResult(new
        {
            code = "license_expired",
            message = "ConnectOEE license has expired. Activate a license in Admin → System."
        })
        {
            StatusCode = StatusCodes.Status403Forbidden
        };
    }

    public static ActionResult? RequireFeature(ILicenseService license, bool allowed, string code, string message)
    {
        var expired = RequireValidLicense(license);
        if (expired is not null)
            return expired;

        if (allowed)
            return null;

        return new ObjectResult(new { code, message })
        {
            StatusCode = StatusCodes.Status403Forbidden
        };
    }

    public static async Task<ActionResult?> CheckPlantLimitAsync(
        ConnectOeeDbContext db, ILicenseService license, CancellationToken ct = default)
    {
        var expired = RequireValidLicense(license);
        if (expired is not null)
            return expired;

        if (license.MaxPlants == int.MaxValue)
            return null;

        var count = await db.Plants.CountAsync(ct);
        if (count >= license.MaxPlants)
        {
            return new ObjectResult(new
            {
                code = "license_limit",
                message = $"Trial license allows up to {license.MaxPlants} plant. Activate a full license to add more."
            })
            {
                StatusCode = StatusCodes.Status403Forbidden
            };
        }

        return null;
    }

    public static async Task<ActionResult?> CheckLineLimitAsync(
        ConnectOeeDbContext db, ILicenseService license, CancellationToken ct = default)
    {
        var expired = RequireValidLicense(license);
        if (expired is not null)
            return expired;

        if (license.MaxLines == int.MaxValue)
            return null;

        var count = await db.Lines.CountAsync(ct);
        if (count >= license.MaxLines)
        {
            return new ObjectResult(new
            {
                code = "license_limit",
                message = $"Trial license allows up to {license.MaxLines} lines. Activate a full license to add more."
            })
            {
                StatusCode = StatusCodes.Status403Forbidden
            };
        }

        return null;
    }

    /// <summary>
    /// Trial allows Mock only. Full/Personal unlocks the industrial driver suite
    /// (Rockwell, Modbus TCP, OPC UA, and future vendors).
    /// </summary>
    public static ActionResult? CheckPlcDriver(ILicenseService license, string? driverType)
    {
        if (!Enum.TryParse<DriverType>(driverType, out var dt) || dt == DriverType.Mock)
            return null;

        return RequireFeature(
            license,
            license.PlcDriversEnabled,
            "license_limit",
            "Industrial PLC drivers require a full license. Trial supports the Mock / Simulator driver only.");
    }

    /// <summary>Legacy alias for <see cref="CheckPlcDriver"/>.</summary>
    public static ActionResult? CheckRockwellDriver(ILicenseService license, string? driverType) =>
        CheckPlcDriver(license, driverType);

    public static ActionResult? CheckPdfReports(ILicenseService license, ReportFormat format)
    {
        if (format != ReportFormat.Pdf)
            return null;

        return RequireFeature(
            license,
            license.PdfReportsEnabled,
            "license_limit",
            "PDF reports require a full license. Trial supports CSV export only.");
    }

    public static ActionResult? CheckScheduledReports(ILicenseService license)
    {
        return RequireFeature(
            license,
            license.ScheduledReportsEnabled,
            "license_limit",
            "Scheduled reports require a full license.");
    }

    public static async Task<ActionResult?> CheckKioskLimitAsync(
        ConnectOeeDbContext db, ILicenseService license, CancellationToken ct = default)
    {
        var expired = RequireValidLicense(license);
        if (expired is not null)
            return expired;

        if (license.MaxKioskDashboards == int.MaxValue)
            return null;

        var count = await db.Dashboards.CountAsync(d => d.Scope == DashboardScope.PublicKiosk, ct);
        if (count >= license.MaxKioskDashboards)
        {
            return new ObjectResult(new
            {
                code = "license_limit",
                message = $"Trial license allows up to {license.MaxKioskDashboards} kiosk dashboard. Activate a full license to add more."
            })
            {
                StatusCode = StatusCodes.Status403Forbidden
            };
        }

        return null;
    }
}

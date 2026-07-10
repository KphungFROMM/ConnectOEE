using ConnectOEE.Api.Auth;
using ConnectOEE.Core.Entities.Security;
using ConnectOEE.Core.Licensing;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ConnectOEE.Api.Controllers;

[ApiController]
[Route("api/license")]
[Authorize]
public class LicenseController : ControllerBase
{
    private readonly ILicenseService _license;

    public LicenseController(ILicenseService license)
    {
        _license = license;
    }

    public record LicenseStatusDto(
        string Edition,
        string EditionDisplay,
        bool IsValid,
        string? LicenseHolder,
        int TrialDaysRemaining,
        DateTime? ExpiresUtc,
        int MaxPlants,
        int MaxLines,
        bool RockwellDriverEnabled,
        bool PdfReportsEnabled,
        bool ScheduledReportsEnabled,
        int MaxKioskDashboards);

    public record ActivateLicenseRequest(string Key);

    [HttpGet]
    public ActionResult<LicenseStatusDto> GetStatus()
    {
        return Ok(new LicenseStatusDto(
            _license.Edition.ToString(),
            _license.EditionDisplay,
            _license.IsValid,
            _license.LicenseHolder,
            _license.TrialDaysRemaining,
            _license.ExpiresUtc,
            _license.MaxPlants,
            _license.MaxLines,
            _license.RockwellDriverEnabled,
            _license.PdfReportsEnabled,
            _license.ScheduledReportsEnabled,
            _license.MaxKioskDashboards));
    }

    [HttpPost("activate")]
    [HasPermission(PermissionKeys.ManageHierarchy)]
    public ActionResult<LicenseStatusDto> Activate([FromBody] ActivateLicenseRequest request)
    {
        if (!_license.ValidateAndActivate(request.Key))
            return BadRequest(new { message = "Invalid license key. Expected a CONNECT-OEE- key from Connect License Generator." });

        return GetStatus();
    }
}

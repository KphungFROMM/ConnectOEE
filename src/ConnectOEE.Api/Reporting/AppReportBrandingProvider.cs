using ConnectOEE.Reporting;

namespace ConnectOEE.Api.Reporting;

/// <summary>
/// Loads the ConnectOEE app icon from the API Assets folder once and supplies it as
/// the PDF header logo. A configurable plant logo can be layered in later.
/// </summary>
public class AppReportBrandingProvider : IReportBrandingProvider
{
    private readonly ReportBranding _branding;

    public AppReportBrandingProvider(IWebHostEnvironment env)
    {
        byte[]? logo = null;
        var path = Path.Combine(env.ContentRootPath, "Assets", "app-icon.png");
        if (File.Exists(path))
        {
            try { logo = File.ReadAllBytes(path); }
            catch { /* branding is best-effort; render without a logo on failure */ }
        }
        _branding = new ReportBranding(AppLogo: logo, PlantLogo: null);
    }

    public ReportBranding Get() => _branding;
}

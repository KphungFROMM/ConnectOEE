using ConnectOEE.Core.Licensing;

namespace ConnectOEE.Tests;

public class LicenseValidatorTests
{
    [Fact]
    public void GeneratedKey_Validates()
    {
        var key = LicenseValidator.GenerateKey("Test Holder");
        Assert.True(LicenseValidator.TryValidate(key, out var payload));
        Assert.NotNull(payload);
        Assert.Equal("ConnectOEE", payload.Product);
        Assert.Equal("Full", payload.Edition);
        Assert.Equal("Test Holder", payload.Holder);
    }

    [Fact]
    public void WrongPrefix_IsRejected()
    {
        var mbtStyle = LicenseValidator.GenerateKey("Test").Replace("CONNECT-OEE-", "CONNECT-MBT-");
        Assert.False(LicenseValidator.TryValidate(mbtStyle, out _));
    }

    [Fact]
    public void TamperedKey_IsRejected()
    {
        Assert.False(LicenseValidator.TryValidate("CONNECT-OEE-invalid.sig", out _));
    }

    [Fact]
    public void HashKey_MatchesExpectedFormat()
    {
        var hash = LicenseValidator.HashKey("CONNECT-OEE-test");
        Assert.Matches("^[0-9A-F]+$", hash);
        Assert.True(hash.Length >= 32);
    }

    [Fact]
    public void TermKey_IncludesExpires()
    {
        var key = LicenseValidator.GenerateKey("Term User", TimeSpan.FromDays(365));
        Assert.True(LicenseValidator.TryValidate(key, out var payload));
        Assert.NotNull(payload!.Expires);
        Assert.False(LicenseValidator.IsExpired(payload.Expires));
    }
}

public class LicenseServiceTests : IDisposable
{
    private readonly string _tempDir;

    public LicenseServiceTests()
    {
        _tempDir = Path.Combine(Path.GetTempPath(), "ConnectOeeLicenseTests", Guid.NewGuid().ToString("N"));
        LicenseStore.Configure(_tempDir);
    }

    public void Dispose()
    {
        if (Directory.Exists(_tempDir))
            Directory.Delete(_tempDir, recursive: true);
    }

    [Fact]
    public void FreshInstall_StartsTrial()
    {
        var svc = new LicenseService();
        Assert.Equal(LicenseEdition.Trial, svc.Edition);
        Assert.True(svc.IsValid);
        Assert.Equal(1, svc.MaxPlants);
        Assert.Equal(2, svc.MaxLines);
        Assert.False(svc.RockwellDriverEnabled);
        Assert.False(svc.PdfReportsEnabled);
        Assert.Equal(1, svc.MaxKioskDashboards);
    }

    [Fact]
    public void ActivateValidKey_GrantsFullFeatures()
    {
        var key = LicenseValidator.GenerateKey("Acme Corp");
        var svc = new LicenseService();
        Assert.True(svc.ValidateAndActivate(key));
        Assert.Equal(LicenseEdition.Full, svc.Edition);
        Assert.True(svc.RockwellDriverEnabled);
        Assert.Equal(int.MaxValue, svc.MaxPlants);
    }

    [Fact]
    public void InvalidKey_IsRejected()
    {
        var svc = new LicenseService();
        Assert.False(svc.ValidateAndActivate("CONNECT-OEE-bad.key"));
        Assert.Equal(LicenseEdition.Trial, svc.Edition);
    }

    [Fact]
    public void PersonalLicenseService_HasFullFeatures()
    {
        var svc = new PersonalLicenseService();
        Assert.Equal(LicenseEdition.Personal, svc.Edition);
        Assert.True(svc.RockwellDriverEnabled);
        Assert.Equal(int.MaxValue, svc.MaxLines);
    }
}

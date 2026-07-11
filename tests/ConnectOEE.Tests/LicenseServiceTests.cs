using Connect.Licensing.Core;
using ConnectOEE.Core.Licensing;

namespace ConnectOEE.Tests;

public class LicenseValidatorTests
{
    [Fact]
    public void GeneratedKey_Validates()
    {
        var key = LicenseValidator.GenerateKey(ConnectProduct.Oee, "Test Holder", machineId: null);
        Assert.True(LicenseValidator.TryValidate(ConnectProduct.Oee, key, out var payload, checkMachineBinding: false));
        Assert.NotNull(payload);
        Assert.Equal("ConnectOEE", payload.Product);
        Assert.Equal("Full", payload.Edition);
        Assert.Equal("Test Holder", payload.Holder);
    }

    [Fact]
    public void WrongPrefix_IsRejected()
    {
        var mbtStyle = LicenseValidator.GenerateKey(ConnectProduct.Oee, "Test", machineId: null).Replace("CONNECT-OEE-", "CONNECT-MBT-");
        Assert.False(LicenseValidator.TryValidate(ConnectProduct.Oee, mbtStyle, out _));
    }

    [Fact]
    public void TamperedKey_IsRejected()
    {
        Assert.False(LicenseValidator.TryValidate(ConnectProduct.Oee, "CONNECT-OEE-invalid.sig", out _));
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
        var key = LicenseValidator.GenerateKey(ConnectProduct.Oee, "Term User", TimeSpan.FromDays(365), machineId: null);
        Assert.True(LicenseValidator.TryValidate(ConnectProduct.Oee, key, out var payload, checkMachineBinding: false));
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
        Assert.False(svc.PlcDriversEnabled);
        Assert.False(svc.PdfReportsEnabled);
        Assert.Equal(1, svc.MaxKioskDashboards);
    }

    [Fact]
    public void ActivateValidKey_GrantsFullFeatures()
    {
        var key = LicenseValidator.GenerateKey(ConnectProduct.Oee, "Acme Corp", machineId: null);
        var svc = new LicenseService();
        Assert.True(svc.ValidateAndActivate(key));
        Assert.Equal(LicenseEdition.Full, svc.Edition);
        Assert.True(svc.PlcDriversEnabled);
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
        Assert.True(svc.PlcDriversEnabled);
        Assert.Equal(int.MaxValue, svc.MaxLines);
    }
}

using System.Runtime.Versioning;
using System.Security.Cryptography;
using System.Text;

namespace ConnectOEE.Infrastructure.Security;

/// <summary>Protects secrets at rest on Windows using DPAPI (machine scope).</summary>
public static class WindowsSecretProtector
{
    [SupportedOSPlatform("windows")]
    public static string Protect(string plaintext)
    {
        if (string.IsNullOrEmpty(plaintext)) return plaintext;
        var bytes = Encoding.UTF8.GetBytes(plaintext);
        var protectedBytes = ProtectedData.Protect(bytes, optionalEntropy: null, DataProtectionScope.LocalMachine);
        return Convert.ToBase64String(protectedBytes);
    }

    [SupportedOSPlatform("windows")]
    public static string Unprotect(string protectedBase64)
    {
        if (string.IsNullOrEmpty(protectedBase64)) return protectedBase64;
        var bytes = Convert.FromBase64String(protectedBase64);
        var plain = ProtectedData.Unprotect(bytes, optionalEntropy: null, DataProtectionScope.LocalMachine);
        return Encoding.UTF8.GetString(plain);
    }

    /// <summary>Returns plaintext on non-Windows or when value is not DPAPI-wrapped.</summary>
    public static string Resolve(string? value)
    {
        if (string.IsNullOrEmpty(value)) return value ?? string.Empty;
        if (!OperatingSystem.IsWindows() || !value.StartsWith("dpapi:", StringComparison.OrdinalIgnoreCase))
            return value;
        try
        {
            return Unprotect(value["dpapi:".Length..]);
        }
        catch
        {
            return value;
        }
    }
}

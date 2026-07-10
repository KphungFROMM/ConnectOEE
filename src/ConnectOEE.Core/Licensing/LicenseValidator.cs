using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace ConnectOEE.Core.Licensing;

public static class LicenseValidator
{
    private const string Prefix = "CONNECT-OEE-";
    private const string ProductId = "ConnectOEE";

    private static readonly JsonSerializerOptions SerializerOptions = new()
    {
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

    public sealed record LicensePayload(
        string Product,
        string Edition,
        string Holder,
        string Issued,
        string? Expires = null);

    public static bool TryValidate(string? licenseKey, out LicensePayload? payload)
    {
        payload = null;
        if (string.IsNullOrWhiteSpace(licenseKey))
            return false;

        var key = licenseKey.Trim();
        if (!key.StartsWith(Prefix, StringComparison.OrdinalIgnoreCase))
            return false;

        var body = key[Prefix.Length..];
        var dot = body.LastIndexOf('.');
        if (dot <= 0 || dot >= body.Length - 1)
            return false;

        var payloadB64 = body[..dot];
        var sigB64 = body[(dot + 1)..];

        try
        {
            var payloadBytes = Base64UrlDecode(payloadB64);
            var expectedSig = ComputeSignature(payloadBytes);
            var actualSig = Base64UrlDecode(sigB64);
            if (!CryptographicOperations.FixedTimeEquals(expectedSig, actualSig))
                return false;

            payload = JsonSerializer.Deserialize<LicensePayload>(payloadBytes);
            return payload is not null
                   && string.Equals(payload.Product, ProductId, StringComparison.OrdinalIgnoreCase)
                   && string.Equals(payload.Edition, "Full", StringComparison.OrdinalIgnoreCase)
                   && !IsExpired(payload.Expires);
        }
        catch
        {
            return false;
        }
    }

    public static string GenerateKey(string holder, TimeSpan? term = null)
    {
        var issuedUtc = DateTime.UtcNow;
        var issued = issuedUtc.ToString("yyyy-MM-dd");
        var expires = term.HasValue ? issuedUtc.Date.Add(term.Value).ToString("yyyy-MM-dd") : null;

        var payload = new LicensePayload(ProductId, "Full", holder, issued, expires);
        var payloadBytes = JsonSerializer.SerializeToUtf8Bytes(payload, SerializerOptions);
        var payloadB64 = Base64UrlEncode(payloadBytes);
        var sigB64 = Base64UrlEncode(ComputeSignature(payloadBytes));
        return $"{Prefix}{payloadB64}.{sigB64}";
    }

    public static string HashKey(string key)
    {
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(key.Trim()));
        return Convert.ToHexString(hash);
    }

    public static DateTime? ParseExpiresUtc(string? expires)
    {
        if (string.IsNullOrWhiteSpace(expires))
            return null;

        return DateTime.TryParseExact(
            expires.Trim(),
            "yyyy-MM-dd",
            CultureInfo.InvariantCulture,
            DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal,
            out var parsed)
            ? parsed
            : null;
    }

    public static bool IsExpired(string? expires)
    {
        var expiresUtc = ParseExpiresUtc(expires);
        return expiresUtc is not null && DateTime.UtcNow.Date > expiresUtc.Value.Date;
    }

    private static byte[] ComputeSignature(byte[] payloadBytes)
    {
        using var hmac = new HMACSHA256(LicenseSigningKey.GetHmacKeyBytes());
        return hmac.ComputeHash(payloadBytes);
    }

    private static string Base64UrlEncode(byte[] data) =>
        Convert.ToBase64String(data).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    private static byte[] Base64UrlDecode(string input)
    {
        var s = input.Replace('-', '+').Replace('_', '/');
        switch (s.Length % 4)
        {
            case 2: s += "=="; break;
            case 3: s += "="; break;
        }
        return Convert.FromBase64String(s);
    }
}

using System.Security.Cryptography;

namespace ConnectOEE.Infrastructure.Security;

/// <summary>AES-256-GCM encryption for pg_dump backup files at rest.</summary>
public static class BackupEncryption
{
    private const int NonceSize = 12;
    private const int TagSize = 16;

    public static async Task EncryptFileAsync(string sourcePath, string destPath, byte[] key, CancellationToken ct = default)
    {
        await using var input = File.OpenRead(sourcePath);
        var plain = new MemoryStream();
        await input.CopyToAsync(plain, ct);
        var plainBytes = plain.ToArray();

        await using var output = File.Create(destPath);
        var nonce = RandomNumberGenerator.GetBytes(NonceSize);
        await output.WriteAsync(nonce, ct);
        using var aes = new AesGcm(key, TagSize);
        var cipher = new byte[plainBytes.Length];
        var tag = new byte[TagSize];
        aes.Encrypt(nonce, plainBytes, cipher, tag);
        await output.WriteAsync(cipher, ct);
        await output.WriteAsync(tag, ct);
    }

    public static byte[]? TryParseKey(string? base64)
    {
        if (string.IsNullOrWhiteSpace(base64)) return null;
        try
        {
            var key = Convert.FromBase64String(base64.Trim());
            return key.Length == 32 ? key : null;
        }
        catch
        {
            return null;
        }
    }
}

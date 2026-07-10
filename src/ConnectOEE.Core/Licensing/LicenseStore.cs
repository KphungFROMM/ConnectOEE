using System.Text.Json;

namespace ConnectOEE.Core.Licensing;

public static class LicenseStore
{
    private static readonly JsonSerializerOptions JsonOptions = new() { WriteIndented = true };

    private static string? _dataDirectory;

    public static void Configure(string dataDirectory) =>
        _dataDirectory = dataDirectory;

    public static string FolderPath =>
        _dataDirectory ?? throw new InvalidOperationException("LicenseStore is not configured.");

    public static string FilePath => Path.Combine(FolderPath, "license.json");

    public static LicenseState Load()
    {
        try
        {
            if (!File.Exists(FilePath))
                return new LicenseState();

            var json = File.ReadAllText(FilePath);
            return JsonSerializer.Deserialize<LicenseState>(json) ?? new LicenseState();
        }
        catch
        {
            return new LicenseState();
        }
    }

    public static void Save(LicenseState state)
    {
        Directory.CreateDirectory(FolderPath);
        File.WriteAllText(FilePath, JsonSerializer.Serialize(state, JsonOptions));
    }
}

namespace ConnectOEE.Api.Auth;

/// <summary>Custom claim types used by ConnectOEE authorization.</summary>
public static class ConnectClaimTypes
{
    /// <summary>A granted permission key (see PermissionKeys). One claim per permission.</summary>
    public const string Permission = "perm";
    /// <summary>A plant id the user is scoped to (one claim per plant).</summary>
    public const string PlantScope = "plant_scope";
    /// <summary>A line id the user is scoped to (one claim per line).</summary>
    public const string LineScope = "line_scope";
}

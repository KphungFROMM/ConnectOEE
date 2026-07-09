namespace ConnectOEE.Api.Auth;

public class JwtOptions
{
    public const string SectionName = "Jwt";
    public string Issuer { get; set; } = "ConnectOEE";
    public string Audience { get; set; } = "ConnectOEE";
    public string SigningKey { get; set; } = string.Empty;
    public int AccessTokenMinutes { get; set; } = 60;
}

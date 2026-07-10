namespace ConnectOEE.Core.Licensing;

public sealed class LicenseException : Exception
{
    public string Code { get; }

    public LicenseException(string code, string message) : base(message)
    {
        Code = code;
    }
}

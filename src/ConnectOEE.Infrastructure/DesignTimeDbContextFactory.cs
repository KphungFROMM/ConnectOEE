using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace ConnectOEE.Infrastructure;

/// <summary>
/// Lets `dotnet ef migrations` build the context at design time without booting the
/// full Api host. Reads CONNECTOEE_CONNECTION if set, else a localhost dev default.
/// </summary>
public class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<ConnectOeeDbContext>
{
    public ConnectOeeDbContext CreateDbContext(string[] args)
    {
        var conn = Environment.GetEnvironmentVariable("CONNECTOEE_CONNECTION")
                   ?? "Host=localhost;Port=5433;Database=connectoee;Username=connectoee;Password=connectoee_dev_pw";

        var options = new DbContextOptionsBuilder<ConnectOeeDbContext>()
            .UseNpgsql(conn, npgsql => npgsql.MigrationsAssembly(typeof(ConnectOeeDbContext).Assembly.FullName))
            .Options;

        return new ConnectOeeDbContext(options);
    }
}

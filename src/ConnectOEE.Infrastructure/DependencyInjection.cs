using ConnectOEE.Core.Entities.Security;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace ConnectOEE.Infrastructure;

public static class DependencyInjection
{
    public const string ConnectionStringName = "ConnectOee";

    /// <summary>Registers the DbContext + Identity stores against PostgreSQL.</summary>
    public static IServiceCollection AddConnectOeeInfrastructure(
        this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString =
            configuration.GetConnectionString(ConnectionStringName)
            ?? Environment.GetEnvironmentVariable("CONNECTOEE_CONNECTION")
            ?? "Host=localhost;Port=5433;Database=connectoee;Username=connectoee;Password=connectoee_dev_pw";

        services.AddDbContext<ConnectOeeDbContext>(options =>
            options.UseNpgsql(connectionString, npgsql =>
                npgsql.MigrationsAssembly(typeof(ConnectOeeDbContext).Assembly.FullName)));

        services.AddIdentityCore<AppUser>(options =>
            {
                options.Password.RequiredLength = 8;
                options.Password.RequireNonAlphanumeric = false;
                options.Password.RequireDigit = true;
                options.Password.RequireUppercase = true;
                options.Password.RequireLowercase = true;
                options.User.RequireUniqueEmail = false;
                options.Lockout.MaxFailedAccessAttempts = 5;
                options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
                options.Lockout.AllowedForNewUsers = true;
            })
            .AddRoles<AppRole>()
            .AddEntityFrameworkStores<ConnectOeeDbContext>()
            .AddTokenProvider<AuthenticatorTokenProvider<AppUser>>(
                TokenOptions.DefaultAuthenticatorProvider);

        return services;
    }
}

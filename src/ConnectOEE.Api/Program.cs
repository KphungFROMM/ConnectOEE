using System.Text;
using System.Threading.RateLimiting;
using ConnectOEE.Api.Auth;
using ConnectOEE.Api.Json;
using ConnectOEE.Api.Middleware;
using ConnectOEE.Api.Services;
using ConnectOEE.Api.Live;
using ConnectOEE.Core.Abstractions;
using ConnectOEE.Infrastructure;
using ConnectOEE.Infrastructure.Auditing;
using ConnectOEE.Infrastructure.Security;
using ConnectOEE.Infrastructure.Seeding;
using ConnectOEE.Infrastructure.Shifts;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Serilog;

Log.Logger = new LoggerConfiguration()
    .WriteTo.Console()
    .CreateBootstrapLogger();

try
{
    var builder = WebApplication.CreateBuilder(args);

    // Optional local override for secrets/connection (gitignored).
    builder.Configuration.AddJsonFile("appsettings.Development.local.json", optional: true, reloadOnChange: true);

    // Allow running as a Windows Service in production (no-op when run as console).
    builder.Host.UseWindowsService(o => o.ServiceName = "ConnectOEE");

    builder.Host.UseSerilog((context, services, configuration) => configuration
        .ReadFrom.Configuration(context.Configuration)
        .ReadFrom.Services(services)
        .Enrich.FromLogContext()
        .WriteTo.Console()
        .WriteTo.File("logs/connectoee-.log", rollingInterval: Serilog.RollingInterval.Day));

    var services = builder.Services;
    var config = builder.Configuration;

    var securitySection = config.GetSection(SecurityOptions.SectionName);
    services.Configure<SecurityOptions>(securitySection);
    var securityOptions = securitySection.Get<SecurityOptions>() ?? new SecurityOptions();

    if (!string.IsNullOrWhiteSpace(securityOptions.AllowedHosts))
        builder.Configuration["AllowedHosts"] = securityOptions.AllowedHosts;

    // Optional Kestrel TLS certificate for factory deployments.
    if (!string.IsNullOrWhiteSpace(securityOptions.CertificatePath) && File.Exists(securityOptions.CertificatePath))
    {
        builder.WebHost.ConfigureKestrel(o =>
        {
            o.ListenAnyIP(443, listen =>
                listen.UseHttps(securityOptions.CertificatePath, securityOptions.CertificatePassword));
        });
    }

    services.AddConnectOeeInfrastructure(config);

    // ----- Auth (JWT) + RBAC + audit -----
    var jwtSection = config.GetSection(JwtOptions.SectionName);
    services.Configure<JwtOptions>(jwtSection);
    var jwtOptions = jwtSection.Get<JwtOptions>() ?? new JwtOptions();
    jwtOptions.SigningKey = WindowsSecretProtector.Resolve(jwtOptions.SigningKey);

    if (builder.Environment.IsProduction())
    {
        var key = jwtOptions.SigningKey ?? string.Empty;
        if (string.IsNullOrWhiteSpace(key)
            || key.Contains("dev-only", StringComparison.OrdinalIgnoreCase)
            || key.Contains("change-me", StringComparison.OrdinalIgnoreCase)
            || key.Contains("REPLACE_IN_LOCAL", StringComparison.OrdinalIgnoreCase))
        {
            Log.Warning(
                "Production JWT signing key is missing or still a development placeholder. " +
                "Set Jwt__SigningKey (32+ random chars) via secure configuration before go-live.");
        }
    }

    services.AddScoped<TokenService>();
    services.AddScoped<RefreshTokenService>();
    services.AddSingleton<KioskTokenService>();
    services.AddScoped<IScopeAccessService, ScopeAccessService>();
    services.AddScoped<HierarchyDeleteGuardService>();
    services.AddScoped<IAuditService, AuditService>();

    services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
        .AddJwtBearer(options =>
        {
            options.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuer = true,
                ValidIssuer = jwtOptions.Issuer,
                ValidateAudience = true,
                ValidAudiences = new[] { jwtOptions.Audience, $"{jwtOptions.Audience}-Kiosk" },
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtOptions.SigningKey)),
                ValidateLifetime = true,
                ClockSkew = TimeSpan.FromSeconds(30),
            };
            // Allow SignalR clients to authenticate via access_token query string or kiosk cookie.
            options.Events = new JwtBearerEvents
            {
                OnMessageReceived = ctx =>
                {
                    var path = ctx.HttpContext.Request.Path;
                    if (!path.StartsWithSegments("/hubs")) return Task.CompletedTask;

                    var accessToken = ctx.Request.Query["access_token"];
                    if (string.IsNullOrEmpty(accessToken))
                        accessToken = ctx.Request.Cookies[securityOptions.KioskCookieName];
                    if (!string.IsNullOrEmpty(accessToken))
                        ctx.Token = accessToken;
                    return Task.CompletedTask;
                }
            };
        });

    services.AddScoped<ISetupStateService, SetupStateService>();

    services.AddAuthorization(options =>
    {
        options.DefaultPolicy = new AuthorizationPolicyBuilder()
            .AddRequirements(new SetupOrAuthenticatedRequirement())
            .Build();
    });
    services.AddSingleton<IAuthorizationPolicyProvider, PermissionPolicyProvider>();
    services.AddScoped<IAuthorizationHandler, PermissionHandler>();
    services.AddScoped<IAuthorizationHandler, SetupOrAuthenticatedHandler>();

    services.AddControllers()
        // Serialize enums as their names so the SPA can switch on stable string values
        // (e.g. EntityLevel "Line", Granularity "Hour") instead of magic numbers.
        .AddJsonOptions(o =>
        {
            o.JsonSerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter());
            // HTML time inputs send HH:mm; shift admin/wizard DTOs use TimeOnly.
            o.JsonSerializerOptions.Converters.Add(new TimeOnlyJsonConverter());
            o.JsonSerializerOptions.Converters.Add(new NullableTimeOnlyJsonConverter());
        });
    services.AddEndpointsApiExplorer();
    services.AddSwaggerGen();
    services.AddSignalR();

    // ----- Real-time driver pipeline (Phase 3) + OEE engine (Phase 4) -----
    services.AddSingleton<SnapshotCache>();
    services.AddSingleton<ProductionCounterService>();
    services.AddSingleton<RecipeResolverService>();
    services.AddSingleton<DowntimeReasonResolverService>();
    services.AddSingleton<ChangeoverService>();
    services.AddSingleton<DriverRegistry>();
    services.AddSingleton<MachineRuntimeTracker>();
    services.AddScoped<IShiftResolver, ShiftResolver>();
    services.AddScoped<IShiftScheduleService, ShiftScheduleService>();
    services.AddScoped<ConnectOEE.Historian.IHistorianQueryService, ConnectOEE.Historian.HistorianQueryService>();
    services.AddScoped<IngestionService>();
    services.AddScoped<LineAttainmentLoader>();
    services.AddScoped<TagBrowseService>();
    services.AddSingleton<TagPreviewRegistry>();
    services.AddSingleton<ClientPresenceRegistry>();
    services.AddSingleton<LiveHubConnectionCounter>();
    services.AddHostedService<TagPreviewWorker>();
    services.AddHostedService<DriverManager>();
    services.AddHostedService<ShiftBoundaryWorker>();

    // ----- Reporting (Phase 8): data builder, PDF/CSV renderers, delivery, scheduler -----
    services.AddSingleton(new ConnectOEE.Reporting.ReportingOptions
    {
        OutputDirectory = Path.Combine(builder.Environment.ContentRootPath, "reports"),
        ContentRootPath = builder.Environment.ContentRootPath,
    });
    services.AddSingleton<ConnectOEE.Reporting.PdfReportRenderer>();
    services.AddSingleton<ConnectOEE.Reporting.CsvReportExporter>();
    services.AddSingleton<ConnectOEE.Reporting.ReportChartRenderer>();
    services.AddSingleton<ConnectOEE.Reporting.IReportBrandingProvider, ConnectOEE.Api.Reporting.AppReportBrandingProvider>();
    services.AddScoped<ConnectOEE.Reporting.ReportRangeResolver>();
    services.AddScoped<ConnectOEE.Reporting.ReportDataService>();
    services.AddScoped<ConnectOEE.Reporting.ReportService>();
    services.AddScoped<ConnectOEE.Reporting.ReportDeliveryService>();
    services.AddHostedService<ConnectOEE.Api.Reporting.ReportSchedulerWorker>();

    // Liveness vs readiness: readiness verifies the database is reachable.
    var connString = config.GetConnectionString(DependencyInjection.ConnectionStringName)
        ?? Environment.GetEnvironmentVariable("CONNECTOEE_CONNECTION")
        ?? "Host=localhost;Port=5432;Database=connectoee;Username=connectoee;Password=connectoee_dev_pw";
    services.AddHealthChecks()
        .AddNpgSql(connString, name: "postgres", tags: new[] { "ready" });

    services.AddRateLimiter(options =>
    {
        options.AddFixedWindowLimiter("auth", o =>
        {
            o.Window = TimeSpan.FromMinutes(1);
            o.PermitLimit = 20;
            o.QueueLimit = 0;
        });
        options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    });

    const string DevCors = "connectoee-dev";
    services.AddCors(options => options.AddPolicy(DevCors, policy => policy
        .WithOrigins("http://localhost:5173", "http://localhost:4173")
        .AllowAnyHeader()
        .AllowAnyMethod()
        .AllowCredentials()));

    var app = builder.Build();

    // Apply migrations and seed on startup so a fresh clone is immediately usable.
    using (var scope = app.Services.CreateScope())
    {
        var db = scope.ServiceProvider.GetRequiredService<ConnectOeeDbContext>();
        await db.Database.MigrateAsync();
        await DbSeeder.SeedAsync(app.Services, seedSampleData: config.GetValue("ConnectOEE:SeedSampleData", false));
    }

    app.UseSerilogRequestLogging();
    app.UseMiddleware<SecurityHeadersMiddleware>();

    var requireHttps = securityOptions.RequireHttps && !app.Environment.IsDevelopment();
    if (requireHttps)
    {
        app.UseHttpsRedirection();
        app.UseHsts();
    }

    if (app.Environment.IsDevelopment())
    {
        app.UseSwagger();
        app.UseSwaggerUI();
        app.UseCors(DevCors);
    }

    app.UseRateLimiter();

    // Serve the built SPA (single-port production deployment) when present.
    app.UseDefaultFiles();
    app.UseStaticFiles();

    app.UseAuthentication();
    app.UseAuthorization();
    app.UseMiddleware<AuditMiddleware>();

    app.MapControllers();
    app.MapHub<LiveHub>("/hubs/live").RequireAuthorization();

    // Liveness: process is up and serving.
    app.MapHealthChecks("/health", new Microsoft.AspNetCore.Diagnostics.HealthChecks.HealthCheckOptions
    {
        Predicate = _ => false
    });

    // Readiness: dependencies (DB) are reachable.
    app.MapHealthChecks("/health/ready", new Microsoft.AspNetCore.Diagnostics.HealthChecks.HealthCheckOptions
    {
        Predicate = check => check.Tags.Contains("ready")
    });

    // SPA fallback: any non-API route serves index.html so client routing works.
    app.MapFallbackToFile("index.html");

    Log.Information("ConnectOEE API starting");
    app.Run();
}
catch (Exception ex)
{
    Log.Fatal(ex, "ConnectOEE API terminated unexpectedly");
}
finally
{
    Log.CloseAndFlush();
}

/// <summary>Exposed for WebApplicationFactory-based integration tests.</summary>
public partial class Program { }

using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using ConnectOEE.Core.Entities;
using ConnectOEE.Core.Entities.Security;

namespace ConnectOEE.Infrastructure;

/// <summary>
/// Primary EF Core context. Inherits Identity so app users/roles live in the same
/// database. Entity sets are added per build phase; time-series tables (ts_*) are
/// promoted to TimescaleDB hypertables via raw SQL in migrations (see Phase 1).
/// </summary>
public class ConnectOeeDbContext : IdentityDbContext<AppUser, AppRole, Guid>
{
    public ConnectOeeDbContext(DbContextOptions<ConnectOeeDbContext> options) : base(options)
    {
    }

    // ----- Hierarchy -----
    public DbSet<Plant> Plants => Set<Plant>();
    public DbSet<Department> Departments => Set<Department>();
    public DbSet<Line> Lines => Set<Line>();
    public DbSet<Machine> Machines => Set<Machine>();

    // ----- Connectivity -----
    public DbSet<PlcConnection> PlcConnections => Set<PlcConnection>();
    public DbSet<TagDefinition> TagDefinitions => Set<TagDefinition>();
    public DbSet<TagMapping> TagMappings => Set<TagMapping>();
    public DbSet<UdtType> UdtTypes => Set<UdtType>();
    public DbSet<UdtMember> UdtMembers => Set<UdtMember>();
    public DbSet<MachineControlMap> MachineControlMaps => Set<MachineControlMap>();

    // ----- Signals / OEE config -----
    public DbSet<LogicalSignal> LogicalSignals => Set<LogicalSignal>();
    public DbSet<OeeConfig> OeeConfigs => Set<OeeConfig>();
    public DbSet<FaultCodeMap> FaultCodeMaps => Set<FaultCodeMap>();
    public DbSet<ProductRecipe> ProductRecipes => Set<ProductRecipe>();
    public DbSet<LineProductRate> LineProductRates => Set<LineProductRate>();
    public DbSet<ProductionSchedule> ProductionSchedules => Set<ProductionSchedule>();
    public DbSet<Crew> Crews => Set<Crew>();
    public DbSet<ShiftCrew> ShiftCrews => Set<ShiftCrew>();

    // ----- Time / scheduling -----
    public DbSet<ShiftPattern> ShiftPatterns => Set<ShiftPattern>();
    public DbSet<ShiftDefinition> ShiftDefinitions => Set<ShiftDefinition>();
    public DbSet<ShiftAssignment> ShiftAssignments => Set<ShiftAssignment>();
    public DbSet<ShiftCalendar> ShiftCalendars => Set<ShiftCalendar>();
    public DbSet<ShiftInstance> ShiftInstances => Set<ShiftInstance>();

    // ----- Security (extra to Identity) -----
    public DbSet<Permission> Permissions => Set<Permission>();
    public DbSet<RolePermission> RolePermissions => Set<RolePermission>();
    public DbSet<UserPlantScope> UserPlantScopes => Set<UserPlantScope>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();

    // ----- Events -----
    public DbSet<MachineProductionState> MachineProductionStates => Set<MachineProductionState>();
    public DbSet<ProductionRun> ProductionRuns => Set<ProductionRun>();
    public DbSet<DowntimeEvent> DowntimeEvents => Set<DowntimeEvent>();
    public DbSet<FaultOccurrence> FaultOccurrences => Set<FaultOccurrence>();
    public DbSet<StateTransition> StateTransitions => Set<StateTransition>();

    // ----- Time-series (TimescaleDB hypertables) -----
    public DbSet<TsCount> TsCounts => Set<TsCount>();
    public DbSet<TsState> TsStates => Set<TsState>();
    public DbSet<TsSpeed> TsSpeeds => Set<TsSpeed>();

    // ----- Dashboards -----
    public DbSet<Dashboard> Dashboards => Set<Dashboard>();
    public DbSet<DashboardVersion> DashboardVersions => Set<DashboardVersion>();
    public DbSet<Widget> Widgets => Set<Widget>();
    public DbSet<DashboardTemplate> DashboardTemplates => Set<DashboardTemplate>();

    // ----- Reporting -----
    public DbSet<ReportTemplate> ReportTemplates => Set<ReportTemplate>();
    public DbSet<ReportSchedule> ReportSchedules => Set<ReportSchedule>();
    public DbSet<ReportRun> ReportRuns => Set<ReportRun>();
    public DbSet<SmtpSetting> SmtpSettings => Set<SmtpSetting>();

    // ----- Site appearance -----
    public DbSet<AppearanceSetting> AppearanceSettings => Set<AppearanceSetting>();

    // ----- Audit -----
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);
        builder.ApplyConfigurationsFromAssembly(typeof(ConnectOeeDbContext).Assembly);
    }
}

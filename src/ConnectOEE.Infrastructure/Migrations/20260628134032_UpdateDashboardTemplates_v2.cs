using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ConnectOEE.Infrastructure.Migrations
{
    /// <inheritdoc />
    /// <summary>
    /// Dashboard template layout v2 (richer widgets). No schema change — layouts are upserted
    /// via <see cref="Seeding.DashboardTemplateLayouts.UpsertAsync"/> on startup and via
    /// POST /api/dashboards/refresh-system-layouts for wizard-generated dashboards.
    /// </summary>
    public partial class UpdateDashboardTemplates_v2 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {

        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {

        }
    }
}

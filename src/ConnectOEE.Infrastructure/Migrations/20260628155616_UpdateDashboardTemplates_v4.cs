using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ConnectOEE.Infrastructure.Migrations
{
    /// <summary>
    /// Dashboard template layout v4 (reliability &amp; loss analytics widgets). No schema change — layouts
    /// upserted via <see cref="Seeding.DashboardTemplateLayouts.UpsertAsync"/> on startup and via
    /// POST /api/dashboards/refresh-system-layouts for wizard-generated dashboards.
    /// </summary>
    public partial class UpdateDashboardTemplates_v4 : Migration
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

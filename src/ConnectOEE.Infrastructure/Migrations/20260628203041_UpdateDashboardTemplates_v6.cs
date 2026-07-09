using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ConnectOEE.Infrastructure.Migrations
{
    /// <summary>
    /// Dashboard template layout v6 (Multi-Line Overview template + machine-grid widget).
    /// No schema change — layouts upserted via <see cref="Seeding.DashboardTemplateLayouts.UpsertAsync"/>
    /// on startup and via POST /api/dashboards/refresh-system-layouts.
    /// </summary>
    public partial class UpdateDashboardTemplates_v6 : Migration
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

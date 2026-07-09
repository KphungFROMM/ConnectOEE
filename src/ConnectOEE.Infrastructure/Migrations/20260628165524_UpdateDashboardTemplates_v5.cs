using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ConnectOEE.Infrastructure.Migrations
{
    /// <summary>
    /// Dashboard template layout v5 (expanded widget library, 5 new templates, section headers).
    /// No schema change — layouts upserted via <see cref="Seeding.DashboardTemplateLayouts.UpsertAsync"/>
    /// on startup and via POST /api/dashboards/refresh-system-layouts.
    /// </summary>
    public partial class UpdateDashboardTemplates_v5 : Migration
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

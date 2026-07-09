using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ConnectOEE.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class ExtendedKpiOeeConfig : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "ReworkTracking",
                table: "OeeConfigs",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<double>(
                name: "TargetAvailabilityPct",
                table: "OeeConfigs",
                type: "double precision",
                nullable: false,
                defaultValue: 0.0);

            migrationBuilder.AddColumn<double>(
                name: "TargetPerformancePct",
                table: "OeeConfigs",
                type: "double precision",
                nullable: false,
                defaultValue: 0.0);

            migrationBuilder.AddColumn<double>(
                name: "TargetQualityPct",
                table: "OeeConfigs",
                type: "double precision",
                nullable: false,
                defaultValue: 0.0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ReworkTracking",
                table: "OeeConfigs");

            migrationBuilder.DropColumn(
                name: "TargetAvailabilityPct",
                table: "OeeConfigs");

            migrationBuilder.DropColumn(
                name: "TargetPerformancePct",
                table: "OeeConfigs");

            migrationBuilder.DropColumn(
                name: "TargetQualityPct",
                table: "OeeConfigs");
        }
    }
}

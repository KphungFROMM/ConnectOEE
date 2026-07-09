using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ConnectOEE.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class DowntimeReasonCatalog : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsAutoCreated",
                table: "FaultCodeMaps",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "NeedsReview",
                table: "FaultCodeMaps",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.Sql("""
                UPDATE "LogicalSignals"
                SET "Name" = 'Downtime Reason'
                WHERE "Role" = 5 AND ("Name" = 'Fault Code' OR "Name" ILIKE '%fault%code%');
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IsAutoCreated",
                table: "FaultCodeMaps");

            migrationBuilder.DropColumn(
                name: "NeedsReview",
                table: "FaultCodeMaps");
        }
    }
}

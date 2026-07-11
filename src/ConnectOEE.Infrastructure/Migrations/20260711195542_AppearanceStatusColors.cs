using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ConnectOEE.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AppearanceStatusColors : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "FaultHex",
                table: "AppearanceSettings",
                type: "character varying(7)",
                maxLength: 7,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "IdleHex",
                table: "AppearanceSettings",
                type: "character varying(7)",
                maxLength: 7,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "RunningHex",
                table: "AppearanceSettings",
                type: "character varying(7)",
                maxLength: 7,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "WarningHex",
                table: "AppearanceSettings",
                type: "character varying(7)",
                maxLength: 7,
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "FaultHex",
                table: "AppearanceSettings");

            migrationBuilder.DropColumn(
                name: "IdleHex",
                table: "AppearanceSettings");

            migrationBuilder.DropColumn(
                name: "RunningHex",
                table: "AppearanceSettings");

            migrationBuilder.DropColumn(
                name: "WarningHex",
                table: "AppearanceSettings");
        }
    }
}

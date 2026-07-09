using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ConnectOEE.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class ChangeoverMode : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "ChangeoverMode",
                table: "OeeConfigs",
                type: "integer",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ChangeoverMode",
                table: "OeeConfigs");
        }
    }
}

using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ConnectOEE.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class LineTopology : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "LineOutputMachineId",
                table: "OeeConfigs",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "PacingMachineId",
                table: "OeeConfigs",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Topology",
                table: "OeeConfigs",
                type: "integer",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "LineOutputMachineId",
                table: "OeeConfigs");

            migrationBuilder.DropColumn(
                name: "PacingMachineId",
                table: "OeeConfigs");

            migrationBuilder.DropColumn(
                name: "Topology",
                table: "OeeConfigs");
        }
    }
}

using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ConnectOEE.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddShiftReworkCounters : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "LastPulseRework",
                table: "MachineProductionStates",
                type: "boolean",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "LastRawRework",
                table: "MachineProductionStates",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "LifetimeRework",
                table: "MachineProductionStates",
                type: "bigint",
                nullable: false,
                defaultValue: 0L);

            migrationBuilder.AddColumn<long>(
                name: "ShiftRework",
                table: "MachineProductionStates",
                type: "bigint",
                nullable: false,
                defaultValue: 0L);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "LastPulseRework",
                table: "MachineProductionStates");

            migrationBuilder.DropColumn(
                name: "LastRawRework",
                table: "MachineProductionStates");

            migrationBuilder.DropColumn(
                name: "LifetimeRework",
                table: "MachineProductionStates");

            migrationBuilder.DropColumn(
                name: "ShiftRework",
                table: "MachineProductionStates");
        }
    }
}

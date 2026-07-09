using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ConnectOEE.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class SoftwareOwnedProductionCounts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "CountIngestMode",
                table: "LogicalSignals",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateTable(
                name: "MachineProductionStates",
                columns: table => new
                {
                    MachineId = table.Column<Guid>(type: "uuid", nullable: false),
                    LineId = table.Column<Guid>(type: "uuid", nullable: false),
                    ShiftInstanceId = table.Column<Guid>(type: "uuid", nullable: false),
                    ShiftGood = table.Column<long>(type: "bigint", nullable: false),
                    ShiftReject = table.Column<long>(type: "bigint", nullable: false),
                    LifetimeGood = table.Column<long>(type: "bigint", nullable: false),
                    LifetimeReject = table.Column<long>(type: "bigint", nullable: false),
                    LastRawGood = table.Column<long>(type: "bigint", nullable: true),
                    LastRawReject = table.Column<long>(type: "bigint", nullable: true),
                    LastPulseGood = table.Column<bool>(type: "boolean", nullable: true),
                    LastPulseReject = table.Column<bool>(type: "boolean", nullable: true),
                    UpdatedUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MachineProductionStates", x => x.MachineId);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "MachineProductionStates");

            migrationBuilder.DropColumn(
                name: "CountIngestMode",
                table: "LogicalSignals");
        }
    }
}

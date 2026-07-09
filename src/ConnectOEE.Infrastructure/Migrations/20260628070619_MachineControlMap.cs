using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ConnectOEE.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class MachineControlMap : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "MachineControlMaps",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    MachineId = table.Column<Guid>(type: "uuid", nullable: false),
                    PlcConnectionId = table.Column<Guid>(type: "uuid", nullable: false),
                    Command = table.Column<int>(type: "integer", nullable: false),
                    TagPath = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    DataType = table.Column<int>(type: "integer", nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MachineControlMaps", x => x.Id);
                    table.ForeignKey(
                        name: "FK_MachineControlMaps_Machines_MachineId",
                        column: x => x.MachineId,
                        principalTable: "Machines",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_MachineControlMaps_PlcConnections_PlcConnectionId",
                        column: x => x.PlcConnectionId,
                        principalTable: "PlcConnections",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_MachineControlMaps_MachineId",
                table: "MachineControlMaps",
                column: "MachineId");

            migrationBuilder.CreateIndex(
                name: "IX_MachineControlMaps_PlcConnectionId",
                table: "MachineControlMaps",
                column: "PlcConnectionId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "MachineControlMaps");
        }
    }
}

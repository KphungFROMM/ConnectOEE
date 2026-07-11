using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ConnectOEE.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class WidgetNestingParentTab : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "ParentId",
                table: "Widgets",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TabKey",
                table: "Widgets",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ParentId",
                table: "Widgets");

            migrationBuilder.DropColumn(
                name: "TabKey",
                table: "Widgets");
        }
    }
}

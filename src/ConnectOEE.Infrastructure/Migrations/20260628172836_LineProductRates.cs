using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ConnectOEE.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class LineProductRates : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "LineProductRates",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    LineId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProductRecipeId = table.Column<Guid>(type: "uuid", nullable: false),
                    IdealCycleTimeSec = table.Column<double>(type: "double precision", nullable: false),
                    TargetQuantity = table.Column<double>(type: "double precision", nullable: true),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LineProductRates", x => x.Id);
                    table.ForeignKey(
                        name: "FK_LineProductRates_Lines_LineId",
                        column: x => x.LineId,
                        principalTable: "Lines",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_LineProductRates_ProductRecipes_ProductRecipeId",
                        column: x => x.ProductRecipeId,
                        principalTable: "ProductRecipes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_LineProductRates_LineId_ProductRecipeId",
                table: "LineProductRates",
                columns: new[] { "LineId", "ProductRecipeId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_LineProductRates_ProductRecipeId",
                table: "LineProductRates",
                column: "ProductRecipeId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "LineProductRates");
        }
    }
}

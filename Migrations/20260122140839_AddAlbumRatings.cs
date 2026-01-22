using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace BluesoundWeb.Migrations
{
    /// <inheritdoc />
    public partial class AddAlbumRatings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AlbumRatings",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    AlbumId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Artist = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    Title = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    UserScore = table.Column<int>(type: "integer", nullable: true),
                    CriticsScore = table.Column<int>(type: "integer", nullable: true),
                    FetchedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AlbumRatings", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AlbumRatings_AlbumId",
                table: "AlbumRatings",
                column: "AlbumId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AlbumRatings");
        }
    }
}

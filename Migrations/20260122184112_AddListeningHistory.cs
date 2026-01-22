using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace BluesoundWeb.Migrations
{
    /// <inheritdoc />
    public partial class AddListeningHistory : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "QobuzAlbumHistory",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    AlbumId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    AlbumName = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    Artist = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    CoverUrl = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    PlayedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_QobuzAlbumHistory", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "QobuzPlaylistHistory",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    PlaylistId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    PlaylistName = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    CoverUrl = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    PlayedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_QobuzPlaylistHistory", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "RadioParadiseHistory",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Title = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    ImageUrl = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    ActionUrl = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    Quality = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    PlayedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RadioParadiseHistory", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "TuneInHistory",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Title = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    ImageUrl = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    ActionUrl = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    PlayedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TuneInHistory", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "QobuzPlaylistTracks",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    PlaylistHistoryEntryId = table.Column<int>(type: "integer", nullable: false),
                    TrackId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Title = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    Artist = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    Position = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_QobuzPlaylistTracks", x => x.Id);
                    table.ForeignKey(
                        name: "FK_QobuzPlaylistTracks_QobuzPlaylistHistory_PlaylistHistoryEnt~",
                        column: x => x.PlaylistHistoryEntryId,
                        principalTable: "QobuzPlaylistHistory",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_QobuzAlbumHistory_AlbumId",
                table: "QobuzAlbumHistory",
                column: "AlbumId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_QobuzPlaylistHistory_PlaylistId",
                table: "QobuzPlaylistHistory",
                column: "PlaylistId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_QobuzPlaylistTracks_PlaylistHistoryEntryId_Position",
                table: "QobuzPlaylistTracks",
                columns: new[] { "PlaylistHistoryEntryId", "Position" });

            migrationBuilder.CreateIndex(
                name: "IX_RadioParadiseHistory_ActionUrl",
                table: "RadioParadiseHistory",
                column: "ActionUrl",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TuneInHistory_ActionUrl",
                table: "TuneInHistory",
                column: "ActionUrl",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "QobuzAlbumHistory");

            migrationBuilder.DropTable(
                name: "QobuzPlaylistTracks");

            migrationBuilder.DropTable(
                name: "RadioParadiseHistory");

            migrationBuilder.DropTable(
                name: "TuneInHistory");

            migrationBuilder.DropTable(
                name: "QobuzPlaylistHistory");
        }
    }
}

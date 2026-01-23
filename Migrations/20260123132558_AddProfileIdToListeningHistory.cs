using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BluesoundWeb.Migrations
{
    /// <inheritdoc />
    public partial class AddProfileIdToListeningHistory : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_TuneInHistory_ActionUrl",
                table: "TuneInHistory");

            migrationBuilder.DropIndex(
                name: "IX_RadioParadiseHistory_ActionUrl",
                table: "RadioParadiseHistory");

            migrationBuilder.DropIndex(
                name: "IX_QobuzPlaylistHistory_PlaylistId",
                table: "QobuzPlaylistHistory");

            migrationBuilder.DropIndex(
                name: "IX_QobuzAlbumHistory_AlbumId",
                table: "QobuzAlbumHistory");

            migrationBuilder.AddColumn<string>(
                name: "ProfileId",
                table: "TuneInHistory",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "ProfileId",
                table: "RadioParadiseHistory",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "ProfileId",
                table: "QobuzPlaylistHistory",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "ProfileId",
                table: "QobuzAlbumHistory",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateIndex(
                name: "IX_TuneInHistory_ProfileId",
                table: "TuneInHistory",
                column: "ProfileId");

            migrationBuilder.CreateIndex(
                name: "IX_TuneInHistory_ProfileId_ActionUrl",
                table: "TuneInHistory",
                columns: new[] { "ProfileId", "ActionUrl" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_RadioParadiseHistory_ProfileId",
                table: "RadioParadiseHistory",
                column: "ProfileId");

            migrationBuilder.CreateIndex(
                name: "IX_RadioParadiseHistory_ProfileId_ActionUrl",
                table: "RadioParadiseHistory",
                columns: new[] { "ProfileId", "ActionUrl" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_QobuzPlaylistHistory_ProfileId",
                table: "QobuzPlaylistHistory",
                column: "ProfileId");

            migrationBuilder.CreateIndex(
                name: "IX_QobuzPlaylistHistory_ProfileId_PlaylistId",
                table: "QobuzPlaylistHistory",
                columns: new[] { "ProfileId", "PlaylistId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_QobuzAlbumHistory_ProfileId",
                table: "QobuzAlbumHistory",
                column: "ProfileId");

            migrationBuilder.CreateIndex(
                name: "IX_QobuzAlbumHistory_ProfileId_AlbumId",
                table: "QobuzAlbumHistory",
                columns: new[] { "ProfileId", "AlbumId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_TuneInHistory_ProfileId",
                table: "TuneInHistory");

            migrationBuilder.DropIndex(
                name: "IX_TuneInHistory_ProfileId_ActionUrl",
                table: "TuneInHistory");

            migrationBuilder.DropIndex(
                name: "IX_RadioParadiseHistory_ProfileId",
                table: "RadioParadiseHistory");

            migrationBuilder.DropIndex(
                name: "IX_RadioParadiseHistory_ProfileId_ActionUrl",
                table: "RadioParadiseHistory");

            migrationBuilder.DropIndex(
                name: "IX_QobuzPlaylistHistory_ProfileId",
                table: "QobuzPlaylistHistory");

            migrationBuilder.DropIndex(
                name: "IX_QobuzPlaylistHistory_ProfileId_PlaylistId",
                table: "QobuzPlaylistHistory");

            migrationBuilder.DropIndex(
                name: "IX_QobuzAlbumHistory_ProfileId",
                table: "QobuzAlbumHistory");

            migrationBuilder.DropIndex(
                name: "IX_QobuzAlbumHistory_ProfileId_AlbumId",
                table: "QobuzAlbumHistory");

            migrationBuilder.DropColumn(
                name: "ProfileId",
                table: "TuneInHistory");

            migrationBuilder.DropColumn(
                name: "ProfileId",
                table: "RadioParadiseHistory");

            migrationBuilder.DropColumn(
                name: "ProfileId",
                table: "QobuzPlaylistHistory");

            migrationBuilder.DropColumn(
                name: "ProfileId",
                table: "QobuzAlbumHistory");

            migrationBuilder.CreateIndex(
                name: "IX_TuneInHistory_ActionUrl",
                table: "TuneInHistory",
                column: "ActionUrl",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_RadioParadiseHistory_ActionUrl",
                table: "RadioParadiseHistory",
                column: "ActionUrl",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_QobuzPlaylistHistory_PlaylistId",
                table: "QobuzPlaylistHistory",
                column: "PlaylistId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_QobuzAlbumHistory_AlbumId",
                table: "QobuzAlbumHistory",
                column: "AlbumId",
                unique: true);
        }
    }
}

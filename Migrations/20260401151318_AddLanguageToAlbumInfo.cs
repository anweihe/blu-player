using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BluesoundWeb.Migrations
{
    /// <inheritdoc />
    public partial class AddLanguageToAlbumInfo : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_AlbumInfos_AlbumId",
                table: "AlbumInfos");

            migrationBuilder.AddColumn<string>(
                name: "Language",
                table: "AlbumInfos",
                type: "character varying(10)",
                maxLength: 10,
                nullable: false,
                defaultValue: "de");

            migrationBuilder.CreateIndex(
                name: "IX_AlbumInfos_AlbumId_Language",
                table: "AlbumInfos",
                columns: new[] { "AlbumId", "Language" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_AlbumInfos_AlbumId_Language",
                table: "AlbumInfos");

            migrationBuilder.DropColumn(
                name: "Language",
                table: "AlbumInfos");

            migrationBuilder.CreateIndex(
                name: "IX_AlbumInfos_AlbumId",
                table: "AlbumInfos",
                column: "AlbumId",
                unique: true);
        }
    }
}

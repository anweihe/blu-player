using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BluesoundWeb.Migrations
{
    /// <inheritdoc />
    public partial class RemoveActiveProfileId : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ActiveProfileId",
                table: "GlobalSettings");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ActiveProfileId",
                table: "GlobalSettings",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.UpdateData(
                table: "GlobalSettings",
                keyColumn: "Id",
                keyValue: 1,
                column: "ActiveProfileId",
                value: null);
        }
    }
}

using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BluesoundWeb.Migrations
{
    /// <inheritdoc />
    public partial class AddMistralApiKey : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "MistralApiKeyEncrypted",
                table: "GlobalSettings",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "MistralApiKeyUpdatedAt",
                table: "GlobalSettings",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.UpdateData(
                table: "GlobalSettings",
                keyColumn: "Id",
                keyValue: 1,
                columns: new[] { "MistralApiKeyEncrypted", "MistralApiKeyUpdatedAt" },
                values: new object[] { null, null });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "MistralApiKeyEncrypted",
                table: "GlobalSettings");

            migrationBuilder.DropColumn(
                name: "MistralApiKeyUpdatedAt",
                table: "GlobalSettings");
        }
    }
}

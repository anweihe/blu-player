using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BluesoundWeb.Migrations
{
    /// <inheritdoc />
    public partial class AddMultiProviderAiKeys : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ActiveAiProvider",
                table: "GlobalSettings",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "AnthropicApiKeyEncrypted",
                table: "GlobalSettings",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "AnthropicApiKeyUpdatedAt",
                table: "GlobalSettings",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "OpenAiApiKeyEncrypted",
                table: "GlobalSettings",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "OpenAiApiKeyUpdatedAt",
                table: "GlobalSettings",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.UpdateData(
                table: "GlobalSettings",
                keyColumn: "Id",
                keyValue: 1,
                columns: new[] { "ActiveAiProvider", "AnthropicApiKeyEncrypted", "AnthropicApiKeyUpdatedAt", "OpenAiApiKeyEncrypted", "OpenAiApiKeyUpdatedAt" },
                values: new object[] { "mistral", null, null, null, null });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ActiveAiProvider",
                table: "GlobalSettings");

            migrationBuilder.DropColumn(
                name: "AnthropicApiKeyEncrypted",
                table: "GlobalSettings");

            migrationBuilder.DropColumn(
                name: "AnthropicApiKeyUpdatedAt",
                table: "GlobalSettings");

            migrationBuilder.DropColumn(
                name: "OpenAiApiKeyEncrypted",
                table: "GlobalSettings");

            migrationBuilder.DropColumn(
                name: "OpenAiApiKeyUpdatedAt",
                table: "GlobalSettings");
        }
    }
}

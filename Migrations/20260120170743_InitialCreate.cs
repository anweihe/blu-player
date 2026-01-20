using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BluesoundWeb.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "GlobalSettings",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    ActiveProfileId = table.Column<string>(type: "TEXT", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GlobalSettings", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "UserProfiles",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    ProfileId = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
                    Name = table.Column<string>(type: "TEXT", maxLength: 200, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserProfiles", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "PlaybackQueues",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    UserProfileId = table.Column<int>(type: "INTEGER", nullable: false),
                    SourceType = table.Column<string>(type: "TEXT", maxLength: 50, nullable: true),
                    SourceId = table.Column<string>(type: "TEXT", maxLength: 100, nullable: true),
                    SourceName = table.Column<string>(type: "TEXT", maxLength: 500, nullable: true),
                    CurrentIndex = table.Column<int>(type: "INTEGER", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PlaybackQueues", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PlaybackQueues_UserProfiles_UserProfileId",
                        column: x => x.UserProfileId,
                        principalTable: "UserProfiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ProfileSettings",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    UserProfileId = table.Column<int>(type: "INTEGER", nullable: false),
                    StreamingQualityFormatId = table.Column<int>(type: "INTEGER", nullable: false),
                    SelectedPlayerType = table.Column<string>(type: "TEXT", maxLength: 50, nullable: true),
                    SelectedPlayerName = table.Column<string>(type: "TEXT", maxLength: 200, nullable: true),
                    SelectedPlayerIp = table.Column<string>(type: "TEXT", maxLength: 50, nullable: true),
                    SelectedPlayerPort = table.Column<int>(type: "INTEGER", nullable: true),
                    SelectedPlayerModel = table.Column<string>(type: "TEXT", maxLength: 200, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProfileSettings", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ProfileSettings_UserProfiles_UserProfileId",
                        column: x => x.UserProfileId,
                        principalTable: "UserProfiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "QobuzCredentials",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    UserProfileId = table.Column<int>(type: "INTEGER", nullable: false),
                    QobuzUserId = table.Column<long>(type: "INTEGER", nullable: false),
                    AuthToken = table.Column<string>(type: "TEXT", maxLength: 500, nullable: false),
                    DisplayName = table.Column<string>(type: "TEXT", maxLength: 200, nullable: true),
                    Avatar = table.Column<string>(type: "TEXT", maxLength: 1000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_QobuzCredentials", x => x.Id);
                    table.ForeignKey(
                        name: "FK_QobuzCredentials_UserProfiles_UserProfileId",
                        column: x => x.UserProfileId,
                        principalTable: "UserProfiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "QueueTracks",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    PlaybackQueueId = table.Column<int>(type: "INTEGER", nullable: false),
                    Position = table.Column<int>(type: "INTEGER", nullable: false),
                    QobuzTrackId = table.Column<long>(type: "INTEGER", nullable: false),
                    Title = table.Column<string>(type: "TEXT", maxLength: 500, nullable: false),
                    ArtistName = table.Column<string>(type: "TEXT", maxLength: 500, nullable: true),
                    AlbumTitle = table.Column<string>(type: "TEXT", maxLength: 500, nullable: true),
                    AlbumCover = table.Column<string>(type: "TEXT", maxLength: 1000, nullable: true),
                    Duration = table.Column<int>(type: "INTEGER", nullable: false),
                    FormattedDuration = table.Column<string>(type: "TEXT", maxLength: 20, nullable: true),
                    IsHiRes = table.Column<bool>(type: "INTEGER", nullable: false),
                    QualityLabel = table.Column<string>(type: "TEXT", maxLength: 50, nullable: true),
                    IsStreamable = table.Column<bool>(type: "INTEGER", nullable: false),
                    TrackNumber = table.Column<int>(type: "INTEGER", nullable: false),
                    MediaNumber = table.Column<int>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_QueueTracks", x => x.Id);
                    table.ForeignKey(
                        name: "FK_QueueTracks_PlaybackQueues_PlaybackQueueId",
                        column: x => x.PlaybackQueueId,
                        principalTable: "PlaybackQueues",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.InsertData(
                table: "GlobalSettings",
                columns: new[] { "Id", "ActiveProfileId" },
                values: new object[] { 1, null });

            migrationBuilder.CreateIndex(
                name: "IX_PlaybackQueues_UserProfileId",
                table: "PlaybackQueues",
                column: "UserProfileId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ProfileSettings_UserProfileId",
                table: "ProfileSettings",
                column: "UserProfileId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_QobuzCredentials_UserProfileId",
                table: "QobuzCredentials",
                column: "UserProfileId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_QueueTracks_PlaybackQueueId_Position",
                table: "QueueTracks",
                columns: new[] { "PlaybackQueueId", "Position" });

            migrationBuilder.CreateIndex(
                name: "IX_UserProfiles_ProfileId",
                table: "UserProfiles",
                column: "ProfileId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "GlobalSettings");

            migrationBuilder.DropTable(
                name: "ProfileSettings");

            migrationBuilder.DropTable(
                name: "QobuzCredentials");

            migrationBuilder.DropTable(
                name: "QueueTracks");

            migrationBuilder.DropTable(
                name: "PlaybackQueues");

            migrationBuilder.DropTable(
                name: "UserProfiles");
        }
    }
}

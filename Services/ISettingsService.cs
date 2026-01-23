using BluesoundWeb.Models;

namespace BluesoundWeb.Services;

public interface ISettingsService
{
    // Profile operations
    Task<List<ProfileDto>> GetAllProfilesAsync();
    Task<ProfileDto?> GetProfileByIdAsync(string profileId);
    Task<ProfileDto> CreateProfileAsync(string name);
    Task<ProfileDto?> UpdateProfileAsync(string profileId, string name);
    Task<bool> DeleteProfileAsync(string profileId);

    // Note: Active profile is now stored per-device in browser localStorage

    // Qobuz credentials
    Task<ProfileDto?> UpdateQobuzCredentialsAsync(string profileId, UpdateQobuzCredentialsRequest request);
    Task<bool> DeleteQobuzCredentialsAsync(string profileId);

    // Settings
    Task<ProfileDto?> UpdateStreamingQualityAsync(string profileId, int formatId);
    Task<ProfileDto?> UpdatePlayerSelectionAsync(string profileId, UpdatePlayerRequest request);

    // Migration
    Task<bool> MigrateFromLocalStorageAsync(MigrateRequest request);

    // API Keys (global, user-independent)
    Task<bool> HasMistralApiKeyAsync();
    Task<bool> SetMistralApiKeyAsync(string apiKey);
    Task<bool> DeleteMistralApiKeyAsync();
    Task<string?> GetMistralApiKeyAsync(); // For internal use only, never expose via API
}

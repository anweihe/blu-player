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
    Task<ProfileDto?> UpdateLanguageAsync(string profileId, string? language);

    // Migration
    Task<bool> MigrateFromLocalStorageAsync(MigrateRequest request);

    // API Keys (global, user-independent)
    Task<bool> HasMistralApiKeyAsync();
    Task<bool> SetMistralApiKeyAsync(string apiKey);
    Task<bool> DeleteMistralApiKeyAsync();
    Task<string?> GetMistralApiKeyAsync(); // For internal use only, never expose via API

    // Multi-Provider AI API Keys
    Task<bool> HasApiKeyAsync(string provider);
    Task<bool> SetApiKeyAsync(string provider, string apiKey);
    Task<bool> DeleteApiKeyAsync(string provider);
    Task<string?> GetApiKeyAsync(string provider);

    // Active AI Provider
    Task<string> GetActiveAiProviderAsync();
    Task<bool> SetActiveAiProviderAsync(string provider);
    Task<List<AiProviderStatusDto>> GetAllAiProviderStatusesAsync();
}

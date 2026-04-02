using Microsoft.EntityFrameworkCore;
using BluesoundWeb.Data;
using BluesoundWeb.Models;

namespace BluesoundWeb.Services;

public class SettingsService : ISettingsService
{
    private readonly BluesoundDbContext _context;
    private readonly IEncryptionService _encryptionService;

    public SettingsService(BluesoundDbContext context, IEncryptionService encryptionService)
    {
        _context = context;
        _encryptionService = encryptionService;
    }

    #region Profile Operations

    public async Task<List<ProfileDto>> GetAllProfilesAsync()
    {
        var profiles = await _context.UserProfiles
            .Include(p => p.QobuzCredential)
            .Include(p => p.Settings)
            .OrderBy(p => p.CreatedAt)
            .ToListAsync();

        return profiles.Select(ToDto).ToList();
    }

    public async Task<ProfileDto?> GetProfileByIdAsync(string profileId)
    {
        var profile = await _context.UserProfiles
            .Include(p => p.QobuzCredential)
            .Include(p => p.Settings)
            .FirstOrDefaultAsync(p => p.ProfileId == profileId);

        return profile != null ? ToDto(profile) : null;
    }

    public async Task<ProfileDto> CreateProfileAsync(string name)
    {
        var profileId = GenerateProfileId();

        var profile = new UserProfile
        {
            ProfileId = profileId,
            Name = string.IsNullOrWhiteSpace(name) ? "Neuer Benutzer" : name,
            CreatedAt = DateTime.UtcNow,
            Settings = new ProfileSettings
            {
                StreamingQualityFormatId = 27
            }
        };

        _context.UserProfiles.Add(profile);
        await _context.SaveChangesAsync();

        return ToDto(profile);
    }

    public async Task<ProfileDto?> UpdateProfileAsync(string profileId, string name)
    {
        var profile = await _context.UserProfiles
            .Include(p => p.QobuzCredential)
            .Include(p => p.Settings)
            .FirstOrDefaultAsync(p => p.ProfileId == profileId);

        if (profile == null) return null;

        profile.Name = name;
        await _context.SaveChangesAsync();

        return ToDto(profile);
    }

    public async Task<bool> DeleteProfileAsync(string profileId)
    {
        var profile = await _context.UserProfiles
            .FirstOrDefaultAsync(p => p.ProfileId == profileId);

        if (profile == null) return false;

        // Note: Active profile cleanup is handled on the client side (localStorage)

        _context.UserProfiles.Remove(profile);
        await _context.SaveChangesAsync();

        return true;
    }

    #endregion

    // Note: Active profile is now stored per-device in browser localStorage

    #region Qobuz Credentials

    public async Task<ProfileDto?> UpdateQobuzCredentialsAsync(string profileId, UpdateQobuzCredentialsRequest request)
    {
        var profile = await _context.UserProfiles
            .Include(p => p.QobuzCredential)
            .Include(p => p.Settings)
            .FirstOrDefaultAsync(p => p.ProfileId == profileId);

        if (profile == null) return null;

        if (profile.QobuzCredential == null)
        {
            profile.QobuzCredential = new UserQobuzCredential
            {
                UserProfileId = profile.Id
            };
        }

        profile.QobuzCredential.QobuzUserId = request.UserId;
        profile.QobuzCredential.AuthToken = request.AuthToken;
        profile.QobuzCredential.DisplayName = request.DisplayName;
        profile.QobuzCredential.Avatar = request.Avatar;

        await _context.SaveChangesAsync();

        return ToDto(profile);
    }

    public async Task<bool> DeleteQobuzCredentialsAsync(string profileId)
    {
        var profile = await _context.UserProfiles
            .Include(p => p.QobuzCredential)
            .FirstOrDefaultAsync(p => p.ProfileId == profileId);

        if (profile == null) return false;

        if (profile.QobuzCredential != null)
        {
            _context.QobuzCredentials.Remove(profile.QobuzCredential);
            await _context.SaveChangesAsync();
        }

        return true;
    }

    #endregion

    #region Settings

    public async Task<ProfileDto?> UpdateStreamingQualityAsync(string profileId, int formatId)
    {
        var profile = await _context.UserProfiles
            .Include(p => p.QobuzCredential)
            .Include(p => p.Settings)
            .FirstOrDefaultAsync(p => p.ProfileId == profileId);

        if (profile == null) return null;

        if (profile.Settings == null)
        {
            profile.Settings = new ProfileSettings
            {
                UserProfileId = profile.Id
            };
        }

        profile.Settings.StreamingQualityFormatId = formatId;
        await _context.SaveChangesAsync();

        return ToDto(profile);
    }

    public async Task<ProfileDto?> UpdatePlayerSelectionAsync(string profileId, UpdatePlayerRequest request)
    {
        var profile = await _context.UserProfiles
            .Include(p => p.QobuzCredential)
            .Include(p => p.Settings)
            .FirstOrDefaultAsync(p => p.ProfileId == profileId);

        if (profile == null) return null;

        if (profile.Settings == null)
        {
            profile.Settings = new ProfileSettings
            {
                UserProfileId = profile.Id
            };
        }

        profile.Settings.SelectedPlayerType = request.Type;
        profile.Settings.SelectedPlayerName = request.Name;
        profile.Settings.SelectedPlayerIp = request.Ip;
        profile.Settings.SelectedPlayerPort = request.Port;
        profile.Settings.SelectedPlayerModel = request.Model;

        await _context.SaveChangesAsync();

        return ToDto(profile);
    }

    public async Task<ProfileDto?> UpdateLanguageAsync(string profileId, string? language)
    {
        var profile = await _context.UserProfiles
            .Include(p => p.QobuzCredential)
            .Include(p => p.Settings)
            .FirstOrDefaultAsync(p => p.ProfileId == profileId);

        if (profile == null) return null;

        if (profile.Settings == null)
        {
            profile.Settings = new ProfileSettings
            {
                UserProfileId = profile.Id
            };
        }

        profile.Settings.Language = language;
        await _context.SaveChangesAsync();

        return ToDto(profile);
    }

    #endregion

    #region Migration

    public async Task<bool> MigrateFromLocalStorageAsync(MigrateRequest request)
    {
        // Check if we already have profiles (skip migration)
        var existingCount = await _context.UserProfiles.CountAsync();
        if (existingCount > 0)
        {
            return false; // Already migrated
        }

        using var transaction = await _context.Database.BeginTransactionAsync();

        try
        {
            foreach (var migrateProfile in request.Profiles)
            {
                var profile = new UserProfile
                {
                    ProfileId = migrateProfile.Id,
                    Name = migrateProfile.Name,
                    CreatedAt = migrateProfile.CreatedAt ?? DateTime.UtcNow
                };

                // Add Qobuz credentials if present
                if (migrateProfile.Qobuz != null)
                {
                    profile.QobuzCredential = new UserQobuzCredential
                    {
                        QobuzUserId = migrateProfile.Qobuz.UserId,
                        AuthToken = migrateProfile.Qobuz.AuthToken,
                        DisplayName = migrateProfile.Qobuz.DisplayName,
                        Avatar = migrateProfile.Qobuz.Avatar
                    };
                }

                // Add settings
                profile.Settings = new ProfileSettings
                {
                    StreamingQualityFormatId = migrateProfile.Settings?.StreamingQualityFormatId ?? 27,
                    SelectedPlayerType = migrateProfile.Settings?.SelectedPlayerType,
                    SelectedPlayerName = migrateProfile.Settings?.SelectedPlayerName,
                    SelectedPlayerIp = migrateProfile.Settings?.SelectedPlayerIp,
                    SelectedPlayerPort = migrateProfile.Settings?.SelectedPlayerPort,
                    SelectedPlayerModel = migrateProfile.Settings?.SelectedPlayerModel,
                    Language = migrateProfile.Settings?.Language
                };

                _context.UserProfiles.Add(profile);
            }

            // Note: Active profile is now stored per-device in browser localStorage
            // The frontend handles setting the active profile during migration

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();

            return true;
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    #endregion

    #region Helpers

    private async Task<GlobalSettings> GetOrCreateGlobalSettingsAsync()
    {
        var settings = await _context.GlobalSettings.FirstOrDefaultAsync(s => s.Id == 1);

        if (settings == null)
        {
            settings = new GlobalSettings { Id = 1 };
            _context.GlobalSettings.Add(settings);
            await _context.SaveChangesAsync();
        }

        return settings;
    }

    private static string GenerateProfileId()
    {
        return $"profile_{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}_{Guid.NewGuid().ToString("N")[..9]}";
    }

    private static ProfileDto ToDto(UserProfile profile)
    {
        return new ProfileDto
        {
            Id = profile.ProfileId,
            Name = profile.Name,
            CreatedAt = profile.CreatedAt,
            Qobuz = profile.QobuzCredential != null
                ? new QobuzCredentialDto
                {
                    UserId = profile.QobuzCredential.QobuzUserId,
                    AuthToken = profile.QobuzCredential.AuthToken,
                    DisplayName = profile.QobuzCredential.DisplayName,
                    Avatar = profile.QobuzCredential.Avatar
                }
                : null,
            Settings = profile.Settings != null
                ? new ProfileSettingsDto
                {
                    StreamingQualityFormatId = profile.Settings.StreamingQualityFormatId,
                    SelectedPlayerType = profile.Settings.SelectedPlayerType,
                    SelectedPlayerName = profile.Settings.SelectedPlayerName,
                    SelectedPlayerIp = profile.Settings.SelectedPlayerIp,
                    SelectedPlayerPort = profile.Settings.SelectedPlayerPort,
                    SelectedPlayerModel = profile.Settings.SelectedPlayerModel,
                    Language = profile.Settings.Language
                }
                : null
        };
    }

    #endregion

    #region API Keys

    private static readonly string[] ValidProviders = ["mistral", "anthropic", "openai"];

    public Task<bool> HasMistralApiKeyAsync() => HasApiKeyAsync("mistral");
    public Task<bool> SetMistralApiKeyAsync(string apiKey) => SetApiKeyAsync("mistral", apiKey);
    public Task<bool> DeleteMistralApiKeyAsync() => DeleteApiKeyAsync("mistral");
    public Task<string?> GetMistralApiKeyAsync() => GetApiKeyAsync("mistral");

    public async Task<bool> HasApiKeyAsync(string provider)
    {
        var settings = await GetOrCreateGlobalSettingsAsync();
        var encrypted = GetEncryptedKey(settings, provider);
        return !string.IsNullOrEmpty(encrypted);
    }

    public async Task<bool> SetApiKeyAsync(string provider, string apiKey)
    {
        if (string.IsNullOrWhiteSpace(apiKey) || !ValidProviders.Contains(provider))
            return false;

        var settings = await GetOrCreateGlobalSettingsAsync();
        var encrypted = _encryptionService.Encrypt(apiKey.Trim());
        var now = DateTime.UtcNow;

        switch (provider)
        {
            case "mistral":
                settings.MistralApiKeyEncrypted = encrypted;
                settings.MistralApiKeyUpdatedAt = now;
                break;
            case "anthropic":
                settings.AnthropicApiKeyEncrypted = encrypted;
                settings.AnthropicApiKeyUpdatedAt = now;
                break;
            case "openai":
                settings.OpenAiApiKeyEncrypted = encrypted;
                settings.OpenAiApiKeyUpdatedAt = now;
                break;
        }

        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> DeleteApiKeyAsync(string provider)
    {
        if (!ValidProviders.Contains(provider))
            return false;

        var settings = await GetOrCreateGlobalSettingsAsync();

        switch (provider)
        {
            case "mistral":
                settings.MistralApiKeyEncrypted = null;
                settings.MistralApiKeyUpdatedAt = null;
                break;
            case "anthropic":
                settings.AnthropicApiKeyEncrypted = null;
                settings.AnthropicApiKeyUpdatedAt = null;
                break;
            case "openai":
                settings.OpenAiApiKeyEncrypted = null;
                settings.OpenAiApiKeyUpdatedAt = null;
                break;
        }

        // If deleting the active provider, reset to first available or mistral
        if (settings.ActiveAiProvider == provider)
        {
            settings.ActiveAiProvider = "mistral";
        }

        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<string?> GetApiKeyAsync(string provider)
    {
        var settings = await GetOrCreateGlobalSettingsAsync();
        var encrypted = GetEncryptedKey(settings, provider);
        if (string.IsNullOrEmpty(encrypted))
            return null;

        return _encryptionService.Decrypt(encrypted);
    }

    public async Task<string> GetActiveAiProviderAsync()
    {
        var settings = await GetOrCreateGlobalSettingsAsync();
        return settings.ActiveAiProvider;
    }

    public async Task<bool> SetActiveAiProviderAsync(string provider)
    {
        if (!ValidProviders.Contains(provider))
            return false;

        var settings = await GetOrCreateGlobalSettingsAsync();

        // Only allow activating a provider that has a configured key
        var encrypted = GetEncryptedKey(settings, provider);
        if (string.IsNullOrEmpty(encrypted))
            return false;

        settings.ActiveAiProvider = provider;
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<List<AiProviderStatusDto>> GetAllAiProviderStatusesAsync()
    {
        var settings = await GetOrCreateGlobalSettingsAsync();
        var active = settings.ActiveAiProvider;

        return
        [
            new AiProviderStatusDto
            {
                Provider = "mistral",
                Name = "Mistral AI",
                IsConfigured = !string.IsNullOrEmpty(settings.MistralApiKeyEncrypted),
                IsActive = active == "mistral"
            },
            new AiProviderStatusDto
            {
                Provider = "anthropic",
                Name = "Anthropic",
                IsConfigured = !string.IsNullOrEmpty(settings.AnthropicApiKeyEncrypted),
                IsActive = active == "anthropic"
            },
            new AiProviderStatusDto
            {
                Provider = "openai",
                Name = "OpenAI",
                IsConfigured = !string.IsNullOrEmpty(settings.OpenAiApiKeyEncrypted),
                IsActive = active == "openai"
            }
        ];
    }

    private static string? GetEncryptedKey(GlobalSettings settings, string provider) => provider switch
    {
        "mistral" => settings.MistralApiKeyEncrypted,
        "anthropic" => settings.AnthropicApiKeyEncrypted,
        "openai" => settings.OpenAiApiKeyEncrypted,
        _ => null
    };

    #endregion
}

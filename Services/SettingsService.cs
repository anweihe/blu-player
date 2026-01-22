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

        // Check if this is the active profile
        var globalSettings = await GetOrCreateGlobalSettingsAsync();
        if (globalSettings.ActiveProfileId == profileId)
        {
            globalSettings.ActiveProfileId = null;
        }

        _context.UserProfiles.Remove(profile);
        await _context.SaveChangesAsync();

        return true;
    }

    #endregion

    #region Active Profile

    public async Task<string?> GetActiveProfileIdAsync()
    {
        var settings = await GetOrCreateGlobalSettingsAsync();
        return settings.ActiveProfileId;
    }

    public async Task<bool> SetActiveProfileIdAsync(string? profileId)
    {
        var settings = await GetOrCreateGlobalSettingsAsync();

        if (profileId != null)
        {
            // Verify profile exists
            var profileExists = await _context.UserProfiles.AnyAsync(p => p.ProfileId == profileId);
            if (!profileExists) return false;
        }

        settings.ActiveProfileId = profileId;
        await _context.SaveChangesAsync();

        return true;
    }

    #endregion

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
                    SelectedPlayerModel = migrateProfile.Settings?.SelectedPlayerModel
                };

                _context.UserProfiles.Add(profile);
            }

            // Set active profile
            if (!string.IsNullOrEmpty(request.ActiveProfileId))
            {
                var globalSettings = await GetOrCreateGlobalSettingsAsync();
                globalSettings.ActiveProfileId = request.ActiveProfileId;
            }

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
                    SelectedPlayerModel = profile.Settings.SelectedPlayerModel
                }
                : null
        };
    }

    #endregion

    #region API Keys

    public async Task<bool> HasMistralApiKeyAsync()
    {
        var settings = await GetOrCreateGlobalSettingsAsync();
        return !string.IsNullOrEmpty(settings.MistralApiKeyEncrypted);
    }

    public async Task<bool> SetMistralApiKeyAsync(string apiKey)
    {
        if (string.IsNullOrWhiteSpace(apiKey))
            return false;

        var settings = await GetOrCreateGlobalSettingsAsync();
        settings.MistralApiKeyEncrypted = _encryptionService.Encrypt(apiKey.Trim());
        settings.MistralApiKeyUpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> DeleteMistralApiKeyAsync()
    {
        var settings = await GetOrCreateGlobalSettingsAsync();
        settings.MistralApiKeyEncrypted = null;
        settings.MistralApiKeyUpdatedAt = null;
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<string?> GetMistralApiKeyAsync()
    {
        var settings = await GetOrCreateGlobalSettingsAsync();
        if (string.IsNullOrEmpty(settings.MistralApiKeyEncrypted))
            return null;

        return _encryptionService.Decrypt(settings.MistralApiKeyEncrypted);
    }

    #endregion
}

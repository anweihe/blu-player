namespace BluesoundWeb.Models;

/// <summary>
/// DTO for profile data returned by API
/// </summary>
public class ProfileDto
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public QobuzCredentialDto? Qobuz { get; set; }
    public ProfileSettingsDto? Settings { get; set; }
}

/// <summary>
/// DTO for Qobuz credentials
/// </summary>
public class QobuzCredentialDto
{
    public long UserId { get; set; }
    public string AuthToken { get; set; } = string.Empty;
    public string? DisplayName { get; set; }
    public string? Avatar { get; set; }
}

/// <summary>
/// DTO for profile settings
/// </summary>
public class ProfileSettingsDto
{
    public int StreamingQualityFormatId { get; set; } = 27;
    public string? SelectedPlayerType { get; set; }
    public string? SelectedPlayerName { get; set; }
    public string? SelectedPlayerIp { get; set; }
    public int? SelectedPlayerPort { get; set; }
    public string? SelectedPlayerModel { get; set; }
}

/// <summary>
/// Request DTO for creating a new profile
/// </summary>
public class CreateProfileRequest
{
    public string Name { get; set; } = string.Empty;
}

/// <summary>
/// Request DTO for updating a profile
/// </summary>
public class UpdateProfileRequest
{
    public string? Name { get; set; }
}

// Note: SetActiveProfileRequest removed - active profile is now stored per-device in browser localStorage

/// <summary>
/// Request DTO for updating Qobuz credentials
/// </summary>
public class UpdateQobuzCredentialsRequest
{
    public long UserId { get; set; }
    public string AuthToken { get; set; } = string.Empty;
    public string? DisplayName { get; set; }
    public string? Avatar { get; set; }
}

/// <summary>
/// Request DTO for updating streaming quality
/// </summary>
public class UpdateQualityRequest
{
    public int FormatId { get; set; }
}

/// <summary>
/// Request DTO for updating player selection
/// </summary>
public class UpdatePlayerRequest
{
    public string? Type { get; set; }
    public string? Name { get; set; }
    public string? Ip { get; set; }
    public int? Port { get; set; }
    public string? Model { get; set; }
}

/// <summary>
/// Request DTO for migrating localStorage data to the database
/// </summary>
public class MigrateRequest
{
    public List<MigrateProfileData> Profiles { get; set; } = new();

    /// <summary>
    /// Deprecated: Active profile is now stored per-device in browser localStorage.
    /// This property is kept for backwards compatibility but is no longer used.
    /// </summary>
    public string? ActiveProfileId { get; set; }
}

/// <summary>
/// Profile data from localStorage for migration
/// </summary>
public class MigrateProfileData
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public DateTime? CreatedAt { get; set; }
    public QobuzCredentialDto? Qobuz { get; set; }
    public ProfileSettingsDto? Settings { get; set; }
}

/// <summary>
/// Generic API response
/// </summary>
public class ApiResponse<T>
{
    public bool Success { get; set; }
    public T? Data { get; set; }
    public string? Error { get; set; }

    public static ApiResponse<T> Ok(T data) => new() { Success = true, Data = data };
    public static ApiResponse<T> Fail(string error) => new() { Success = false, Error = error };
}

/// <summary>
/// Simple success/failure response
/// </summary>
public class ApiResponse
{
    public bool Success { get; set; }
    public string? Error { get; set; }

    public static ApiResponse Ok() => new() { Success = true };
    public static ApiResponse Fail(string error) => new() { Success = false, Error = error };
}

// ==================== Queue DTOs ====================

/// <summary>
/// DTO for playback queue data
/// </summary>
public class PlaybackQueueDto
{
    public string? SourceType { get; set; }
    public string? SourceId { get; set; }
    public string? SourceName { get; set; }
    public int CurrentIndex { get; set; }
    public DateTime UpdatedAt { get; set; }
    public List<QueueTrackDto> Tracks { get; set; } = new();
}

/// <summary>
/// DTO for a track in the queue
/// </summary>
public class QueueTrackDto
{
    public int Position { get; set; }
    public long Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? ArtistName { get; set; }
    public string? AlbumTitle { get; set; }
    public string? AlbumCover { get; set; }
    public int Duration { get; set; }
    public string? FormattedDuration { get; set; }
    public bool IsHiRes { get; set; }
    public string? QualityLabel { get; set; }
    public bool IsStreamable { get; set; }
    public int TrackNumber { get; set; }
    public int MediaNumber { get; set; }
}

/// <summary>
/// Request DTO for setting the playback queue
/// </summary>
public class SetQueueRequest
{
    public string? SourceType { get; set; }
    public string? SourceId { get; set; }
    public string? SourceName { get; set; }
    public int CurrentIndex { get; set; }
    public List<QueueTrackDto> Tracks { get; set; } = new();
}

/// <summary>
/// Request DTO for updating the queue index
/// </summary>
public class UpdateQueueIndexRequest
{
    public int CurrentIndex { get; set; }
}

// ==================== API Key DTOs ====================

/// <summary>
/// DTO for API key status (never exposes the actual key)
/// </summary>
public class ApiKeyStatusDto
{
    public bool IsConfigured { get; set; }
    public DateTime? UpdatedAt { get; set; }
}

/// <summary>
/// Request DTO for setting an API key
/// </summary>
public class SetApiKeyRequest
{
    public string ApiKey { get; set; } = string.Empty;
}

// ==================== Album Info DTOs ====================

/// <summary>
/// DTO for album info response
/// </summary>
public class AlbumInfoDto
{
    public string? Summary { get; set; }
    public string? Style { get; set; }
}

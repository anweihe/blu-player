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

/// <summary>
/// Request DTO for setting active profile
/// </summary>
public class SetActiveProfileRequest
{
    public string? ProfileId { get; set; }
}

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

using System.Text.Json.Serialization;

namespace BluesoundWeb.Models;

/// <summary>
/// Qobuz user profile
/// </summary>
public class QobuzUser
{
    [JsonPropertyName("id")]
    public long Id { get; set; }

    [JsonPropertyName("publicId")]
    public string? PublicId { get; set; }

    [JsonPropertyName("email")]
    public string? Email { get; set; }

    [JsonPropertyName("login")]
    public string? Login { get; set; }

    [JsonPropertyName("firstname")]
    public string? Firstname { get; set; }

    [JsonPropertyName("lastname")]
    public string? Lastname { get; set; }

    [JsonPropertyName("display_name")]
    public string? DisplayName { get; set; }

    [JsonPropertyName("country_code")]
    public string? CountryCode { get; set; }

    [JsonPropertyName("language_code")]
    public string? LanguageCode { get; set; }

    [JsonPropertyName("avatar")]
    public string? Avatar { get; set; }

    [JsonPropertyName("credential")]
    public QobuzCredential? Credential { get; set; }

    [JsonPropertyName("subscription")]
    public QobuzSubscription? Subscription { get; set; }
}

/// <summary>
/// Qobuz user credential/subscription type
/// </summary>
public class QobuzCredential
{
    [JsonPropertyName("id")]
    public long? Id { get; set; }

    [JsonPropertyName("label")]
    public string? Label { get; set; }

    [JsonPropertyName("description")]
    public string? Description { get; set; }
}

/// <summary>
/// Qobuz subscription info
/// </summary>
public class QobuzSubscription
{
    [JsonPropertyName("offer")]
    public string? Offer { get; set; }

    [JsonPropertyName("end_date")]
    public string? EndDate { get; set; }

    [JsonPropertyName("is_canceled")]
    public bool? IsCanceled { get; set; }
}

/// <summary>
/// Login response from Qobuz API
/// </summary>
public class QobuzLoginResponse
{
    [JsonPropertyName("user")]
    public QobuzUser? User { get; set; }

    [JsonPropertyName("user_auth_token")]
    public string? UserAuthToken { get; set; }
}

/// <summary>
/// Playlist owner info
/// </summary>
public class QobuzPlaylistOwner
{
    [JsonPropertyName("id")]
    public long Id { get; set; }

    [JsonPropertyName("name")]
    public string? Name { get; set; }
}

/// <summary>
/// Qobuz playlist
/// </summary>
public class QobuzPlaylist
{
    [JsonPropertyName("id")]
    public long Id { get; set; }

    [JsonPropertyName("name")]
    public string? Name { get; set; }

    [JsonPropertyName("description")]
    public string? Description { get; set; }

    [JsonPropertyName("tracks_count")]
    public int TracksCount { get; set; }

    [JsonPropertyName("duration")]
    public int Duration { get; set; }

    [JsonPropertyName("is_public")]
    public bool IsPublic { get; set; }

    [JsonPropertyName("is_collaborative")]
    public bool IsCollaborative { get; set; }

    [JsonPropertyName("created_at")]
    public long? CreatedAt { get; set; }

    [JsonPropertyName("updated_at")]
    public long? UpdatedAt { get; set; }

    [JsonPropertyName("owner")]
    public QobuzPlaylistOwner? Owner { get; set; }

    [JsonPropertyName("images")]
    public List<string>? Images { get; set; }

    [JsonPropertyName("images150")]
    public List<string>? Images150 { get; set; }

    [JsonPropertyName("images300")]
    public List<string>? Images300 { get; set; }

    [JsonPropertyName("image_rectangle")]
    public List<string>? ImageRectangle { get; set; }

    /// <summary>
    /// Get the best available cover image URL
    /// </summary>
    public string? CoverUrl =>
        Images300?.FirstOrDefault() ??
        Images150?.FirstOrDefault() ??
        Images?.FirstOrDefault() ??
        ImageRectangle?.FirstOrDefault();

    /// <summary>
    /// Formatted duration string
    /// </summary>
    public string FormattedDuration
    {
        get
        {
            var ts = TimeSpan.FromSeconds(Duration);
            if (ts.TotalHours >= 1)
                return $"{(int)ts.TotalHours}:{ts.Minutes:D2}:{ts.Seconds:D2}";
            return $"{ts.Minutes}:{ts.Seconds:D2}";
        }
    }
}

/// <summary>
/// Response containing user playlists
/// </summary>
public class QobuzPlaylistsContainer
{
    [JsonPropertyName("items")]
    public List<QobuzPlaylist>? Items { get; set; }

    [JsonPropertyName("total")]
    public int Total { get; set; }

    [JsonPropertyName("offset")]
    public int Offset { get; set; }

    [JsonPropertyName("limit")]
    public int Limit { get; set; }
}

/// <summary>
/// Root response for getUserPlaylists
/// </summary>
public class QobuzPlaylistsResponse
{
    [JsonPropertyName("playlists")]
    public QobuzPlaylistsContainer? Playlists { get; set; }
}

/// <summary>
/// App credentials extracted from Qobuz web player
/// </summary>
public class QobuzAppCredentials
{
    public string AppId { get; set; } = string.Empty;
    public string AppSecret { get; set; } = string.Empty;
}

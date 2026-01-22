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
    public List<string>? AlternativeSecrets { get; set; }
}

/// <summary>
/// Qobuz artist
/// </summary>
public class QobuzArtist
{
    [JsonPropertyName("id")]
    public long Id { get; set; }

    [JsonPropertyName("name")]
    public string? Name { get; set; }

    [JsonPropertyName("image")]
    public QobuzImage? Image { get; set; }
}

/// <summary>
/// Qobuz image with multiple sizes
/// </summary>
public class QobuzImage
{
    [JsonPropertyName("small")]
    public string? Small { get; set; }

    [JsonPropertyName("thumbnail")]
    public string? Thumbnail { get; set; }

    [JsonPropertyName("large")]
    public string? Large { get; set; }
}

/// <summary>
/// Qobuz album
/// </summary>
public class QobuzAlbum
{
    [JsonPropertyName("id")]
    public string? Id { get; set; }

    [JsonPropertyName("title")]
    public string? Title { get; set; }

    [JsonPropertyName("artist")]
    public QobuzArtist? Artist { get; set; }

    [JsonPropertyName("image")]
    public QobuzImage? Image { get; set; }

    [JsonPropertyName("duration")]
    public int Duration { get; set; }

    [JsonPropertyName("tracks_count")]
    public int TracksCount { get; set; }

    [JsonPropertyName("released_at")]
    public long? ReleasedAt { get; set; }

    [JsonPropertyName("product_type")]
    public string? ProductType { get; set; }

    [JsonPropertyName("maximum_bit_depth")]
    public int? MaxBitDepth { get; set; }

    [JsonPropertyName("maximum_sampling_rate")]
    public double? MaxSamplingRate { get; set; }

    /// <summary>
    /// Get the best available cover image URL
    /// </summary>
    public string? CoverUrl =>
        Image?.Large ?? Image?.Small ?? Image?.Thumbnail;

    /// <summary>
    /// Determine if this is a single (1-3 tracks)
    /// </summary>
    public bool IsSingle => ProductType?.Equals("single", StringComparison.OrdinalIgnoreCase) == true
                            || (TracksCount <= 3 && Duration < 1200);

    /// <summary>
    /// Get localized type label
    /// </summary>
    public string TypeLabel
    {
        get
        {
            if (ProductType?.Equals("single", StringComparison.OrdinalIgnoreCase) == true || TracksCount == 1)
                return "Single";
            if (ProductType?.Equals("ep", StringComparison.OrdinalIgnoreCase) == true || (TracksCount >= 2 && TracksCount <= 6 && Duration < 1800))
                return "EP";
            return "Album";
        }
    }
}

/// <summary>
/// Qobuz track
/// </summary>
public class QobuzTrack
{
    [JsonPropertyName("id")]
    public long Id { get; set; }

    [JsonPropertyName("title")]
    public string? Title { get; set; }

    [JsonPropertyName("duration")]
    public int Duration { get; set; }

    [JsonPropertyName("track_number")]
    public int TrackNumber { get; set; }

    [JsonPropertyName("media_number")]
    public int MediaNumber { get; set; }

    [JsonPropertyName("performer")]
    public QobuzArtist? Performer { get; set; }

    [JsonPropertyName("album")]
    public QobuzAlbum? Album { get; set; }

    [JsonPropertyName("hires")]
    public bool IsHiRes { get; set; }

    [JsonPropertyName("hires_streamable")]
    public bool IsHiResStreamable { get; set; }

    [JsonPropertyName("streamable")]
    public bool IsStreamable { get; set; }

    [JsonPropertyName("maximum_bit_depth")]
    public int? MaxBitDepth { get; set; }

    [JsonPropertyName("maximum_sampling_rate")]
    public double? MaxSamplingRate { get; set; }

    /// <summary>
    /// Formatted duration string (m:ss)
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

    /// <summary>
    /// Quality label (e.g., "24-Bit / 96kHz")
    /// </summary>
    public string? QualityLabel
    {
        get
        {
            if (MaxBitDepth.HasValue && MaxSamplingRate.HasValue && MaxBitDepth > 16)
                return $"{MaxBitDepth}-Bit / {MaxSamplingRate}kHz";
            return null;
        }
    }
}

/// <summary>
/// Container for tracks in a playlist
/// </summary>
public class QobuzTracksContainer
{
    [JsonPropertyName("items")]
    public List<QobuzTrack>? Items { get; set; }

    [JsonPropertyName("total")]
    public int Total { get; set; }

    [JsonPropertyName("offset")]
    public int Offset { get; set; }

    [JsonPropertyName("limit")]
    public int Limit { get; set; }
}

/// <summary>
/// Full playlist response with tracks
/// </summary>
public class QobuzPlaylistWithTracks : QobuzPlaylist
{
    [JsonPropertyName("tracks")]
    public QobuzTracksContainer? Tracks { get; set; }
}

/// <summary>
/// Container for albums
/// </summary>
public class QobuzAlbumsContainer
{
    [JsonPropertyName("items")]
    public List<QobuzAlbum>? Items { get; set; }

    [JsonPropertyName("total")]
    public int Total { get; set; }

    [JsonPropertyName("offset")]
    public int Offset { get; set; }

    [JsonPropertyName("limit")]
    public int Limit { get; set; }
}

/// <summary>
/// Response for featured albums endpoint
/// </summary>
public class QobuzFeaturedAlbumsResponse
{
    [JsonPropertyName("albums")]
    public QobuzAlbumsContainer? Albums { get; set; }
}

/// <summary>
/// Response for featured playlists endpoint
/// </summary>
public class QobuzFeaturedPlaylistsResponse
{
    [JsonPropertyName("playlists")]
    public QobuzPlaylistsContainer? Playlists { get; set; }
}

/// <summary>
/// Full album response with tracks
/// </summary>
public class QobuzAlbumWithTracks : QobuzAlbum
{
    [JsonPropertyName("tracks")]
    public QobuzTracksContainer? Tracks { get; set; }

    [JsonPropertyName("label")]
    public QobuzLabel? Label { get; set; }

    [JsonPropertyName("genre")]
    public QobuzGenre? Genre { get; set; }

    [JsonPropertyName("description")]
    public string? Description { get; set; }

    [JsonPropertyName("hires")]
    public bool IsHiRes { get; set; }

    [JsonPropertyName("hires_streamable")]
    public bool IsHiResStreamable { get; set; }
}

/// <summary>
/// Qobuz label info
/// </summary>
public class QobuzLabel
{
    [JsonPropertyName("id")]
    public long Id { get; set; }

    [JsonPropertyName("name")]
    public string? Name { get; set; }
}

/// <summary>
/// Qobuz genre info
/// </summary>
public class QobuzGenre
{
    [JsonPropertyName("id")]
    public long Id { get; set; }

    [JsonPropertyName("name")]
    public string? Name { get; set; }

    [JsonPropertyName("slug")]
    public string? Slug { get; set; }
}

/// <summary>
/// Search response from Qobuz API
/// </summary>
public class QobuzSearchResponse
{
    [JsonPropertyName("albums")]
    public QobuzAlbumsContainer? Albums { get; set; }

    [JsonPropertyName("playlists")]
    public QobuzPlaylistsContainer? Playlists { get; set; }

    [JsonPropertyName("tracks")]
    public QobuzTracksContainer? Tracks { get; set; }
}

/// <summary>
/// Combined search result
/// </summary>
public class QobuzSearchResult
{
    public List<QobuzAlbum> Albums { get; set; } = new();
    public List<QobuzPlaylist> Playlists { get; set; } = new();
    public List<QobuzTrack> Tracks { get; set; } = new();
}

/// <summary>
/// Response from userRecommendation/get endpoint
/// </summary>
public class QobuzRecommendationsResponse
{
    [JsonPropertyName("albums")]
    public QobuzAlbumsContainer? Albums { get; set; }

    [JsonPropertyName("playlists")]
    public QobuzPlaylistsContainer? Playlists { get; set; }

    [JsonPropertyName("tracks")]
    public QobuzTracksContainer? Tracks { get; set; }
}

/// <summary>
/// Combined recommendations result
/// </summary>
public class QobuzRecommendationsResult
{
    public List<QobuzAlbum> Albums { get; set; } = new();
    public List<QobuzPlaylist> Playlists { get; set; } = new();
    public List<QobuzTrack> Tracks { get; set; } = new();
}

/// <summary>
/// Response from favorite/getUserFavorites?type=albums
/// </summary>
public class QobuzFavoriteAlbumsResponse
{
    [JsonPropertyName("albums")]
    public QobuzAlbumsContainer? Albums { get; set; }
}

/// <summary>
/// Response from favorite/getUserFavorites?type=tracks
/// </summary>
public class QobuzFavoriteTracksResponse
{
    [JsonPropertyName("tracks")]
    public QobuzTracksContainer? Tracks { get; set; }
}

/// <summary>
/// Extended artist info for favorites with additional fields
/// </summary>
public class QobuzFavoriteArtist
{
    [JsonPropertyName("id")]
    public long Id { get; set; }

    [JsonPropertyName("name")]
    public string? Name { get; set; }

    [JsonPropertyName("picture")]
    public string? Picture { get; set; }

    [JsonPropertyName("image")]
    public QobuzImage? Image { get; set; }

    [JsonPropertyName("albums_count")]
    public int AlbumsCount { get; set; }

    /// <summary>
    /// Get the best available image URL
    /// </summary>
    public string? ImageUrl =>
        Picture ??
        Image?.Large ??
        Image?.Small ??
        Image?.Thumbnail;
}

/// <summary>
/// Container for favorite artists
/// </summary>
public class QobuzArtistsContainer
{
    [JsonPropertyName("items")]
    public List<QobuzFavoriteArtist>? Items { get; set; }

    [JsonPropertyName("total")]
    public int Total { get; set; }

    [JsonPropertyName("offset")]
    public int Offset { get; set; }

    [JsonPropertyName("limit")]
    public int Limit { get; set; }
}

/// <summary>
/// Response from favorite/getUserFavorites?type=artists
/// </summary>
public class QobuzFavoriteArtistsResponse
{
    [JsonPropertyName("artists")]
    public QobuzArtistsContainer? Artists { get; set; }
}

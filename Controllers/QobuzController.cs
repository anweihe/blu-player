using Microsoft.AspNetCore.Mvc;
using BluesoundWeb.Services;
using BluesoundWeb.Models;
using System.Xml.Linq;

namespace BluesoundWeb.Controllers;

/// <summary>
/// REST API Controller for Qobuz integration.
/// Replaces the Razor Pages handlers from Qobuz.cshtml.cs
/// </summary>
[ApiController]
[Route("api/qobuz")]
public class QobuzController : ControllerBase
{
    private readonly IQobuzApiService _qobuzService;
    private readonly IBluesoundPlayerService _playerService;
    private readonly IBluesoundApiService _bluesoundService;
    private readonly IListeningHistoryService _historyService;
    private readonly IAlbumInfoService _albumInfoService;
    private readonly ILogger<QobuzController> _logger;
    private readonly HttpClient _httpClient;

    public QobuzController(
        IQobuzApiService qobuzService,
        IBluesoundPlayerService playerService,
        IBluesoundApiService bluesoundService,
        IListeningHistoryService historyService,
        IAlbumInfoService albumInfoService,
        ILogger<QobuzController> logger,
        IHttpClientFactory httpClientFactory)
    {
        _qobuzService = qobuzService;
        _playerService = playerService;
        _bluesoundService = bluesoundService;
        _historyService = historyService;
        _albumInfoService = albumInfoService;
        _logger = logger;
        _httpClient = httpClientFactory.CreateClient();
    }

    /// <summary>
    /// Extracts auth token and user ID from HTTP headers.
    /// Angular sends these as X-Auth-Token and X-User-Id headers.
    /// </summary>
    private (string? authToken, long? userId) GetAuthFromHeaders()
    {
        var authToken = Request.Headers["X-Auth-Token"].FirstOrDefault();
        var userIdStr = Request.Headers["X-User-Id"].FirstOrDefault();
        long? userId = long.TryParse(userIdStr, out var id) ? id : null;
        return (authToken, userId);
    }

    // ==================== Authentication ====================

    /// <summary>
    /// Login with email and password
    /// </summary>
    [HttpPost("login")]
    public async Task<ActionResult> Login([FromBody] LoginRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
        {
            return BadRequest(new { success = false, message = "E-Mail und Passwort erforderlich" });
        }

        _logger.LogInformation("API Login attempt for {Email}", request.Email);

        // Ensure app credentials are loaded
        if (!_qobuzService.HasAppCredentials)
        {
            var credentials = await _qobuzService.ExtractAppCredentialsAsync();
            if (credentials == null)
            {
                return StatusCode(503, new { success = false, message = "Qobuz-Dienst nicht verfügbar" });
            }
        }

        var loginResponse = await _qobuzService.LoginAsync(request.Email, request.Password);

        if (loginResponse?.User == null || string.IsNullOrEmpty(loginResponse.UserAuthToken))
        {
            return Unauthorized(new { success = false, message = "Login fehlgeschlagen" });
        }

        return Ok(new
        {
            user_auth_token = loginResponse.UserAuthToken,
            user = new
            {
                id = loginResponse.User.Id,
                login = loginResponse.User.Login,
                email = loginResponse.User.Email,
                display_name = loginResponse.User.DisplayName,
                avatar = loginResponse.User.Avatar,
                credential = loginResponse.User.Credential != null ? new
                {
                    label = loginResponse.User.Credential.Label,
                    description = loginResponse.User.Credential.Description
                } : null
            }
        });
    }

    /// <summary>
    /// Verify existing token
    /// </summary>
    [HttpGet("user")]
    public async Task<ActionResult> GetUser(
        [FromHeader(Name = "X-Auth-Token")] string? authToken,
        [FromHeader(Name = "X-User-Id")] string? userIdStr)
    {
        if (string.IsNullOrEmpty(authToken) || string.IsNullOrEmpty(userIdStr) || !long.TryParse(userIdStr, out var userId))
        {
            return Unauthorized(new { success = false, message = "Auth-Token erforderlich" });
        }

        _logger.LogInformation("API Token verification for user {UserId}", userId);

        // Ensure app credentials are loaded
        if (!_qobuzService.HasAppCredentials)
        {
            var credentials = await _qobuzService.ExtractAppCredentialsAsync();
            if (credentials == null)
            {
                return StatusCode(503, new { success = false, message = "Qobuz-Dienst nicht verfügbar" });
            }
        }

        var loginResponse = await _qobuzService.LoginWithTokenAsync(userId, authToken);

        if (loginResponse?.User == null)
        {
            return Unauthorized(new { success = false, message = "Token ungültig" });
        }

        return Ok(new
        {
            id = loginResponse.User.Id,
            login = loginResponse.User.Login,
            email = loginResponse.User.Email,
            display_name = loginResponse.User.DisplayName,
            avatar = loginResponse.User.Avatar,
            credential = loginResponse.User.Credential != null ? new
            {
                label = loginResponse.User.Credential.Label,
                description = loginResponse.User.Credential.Description
            } : null
        });
    }

    // ==================== Browse - New Releases ====================

    /// <summary>
    /// Get new releases from Qobuz
    /// </summary>
    [HttpGet("new-releases")]
    public async Task<ActionResult> GetNewReleases(int offset = 0, int limit = 50)
    {
        var (authToken, _) = GetAuthFromHeaders();

        _logger.LogInformation("Fetching new releases (offset={Offset}, limit={Limit})", offset, limit);

        var (albums, hasMore) = await _qobuzService.GetNewReleasesAsync(authToken, offset, limit);
        var albumItems = albums.ToList();

        return Ok(new
        {
            success = true,
            albums = new
            {
                items = albumItems.Select(a => new
                {
                    id = a.Id,
                    title = a.Title,
                    artist = new { id = a.Artist?.Id, name = a.Artist?.Name },
                    image = new { large = a.CoverUrl, small = a.CoverUrl },
                    tracks_count = a.TracksCount,
                    duration = a.Duration,
                    released_at = a.ReleasedAt
                }),
                total = hasMore ? offset + albumItems.Count + 1 : offset + albumItems.Count,
                offset,
                limit
            }
        });
    }

    // ==================== Browse - Album Charts ====================

    /// <summary>
    /// Get album charts (most streamed)
    /// </summary>
    [HttpGet("album-charts")]
    public async Task<ActionResult> GetAlbumCharts(int offset = 0, int limit = 50)
    {
        var (authToken, _) = GetAuthFromHeaders();

        _logger.LogInformation("Fetching most streamed albums (offset={Offset}, limit={Limit})", offset, limit);

        var (albums, hasMore) = await _qobuzService.GetMostStreamedAlbumsAsync(authToken, offset, limit);
        var albumItems = albums.ToList();

        return Ok(new
        {
            success = true,
            albums = new
            {
                items = albumItems.Select(a => new
                {
                    id = a.Id,
                    title = a.Title,
                    artist = new { id = a.Artist?.Id, name = a.Artist?.Name },
                    image = new { large = a.CoverUrl, small = a.CoverUrl },
                    tracks_count = a.TracksCount,
                    duration = a.Duration,
                    released_at = a.ReleasedAt
                }),
                total = hasMore ? offset + albumItems.Count + 1 : offset + albumItems.Count,
                offset,
                limit
            }
        });
    }

    // ==================== Browse - Playlists ====================

    /// <summary>
    /// Get featured/editorial playlists
    /// </summary>
    [HttpGet("featured-playlists")]
    public async Task<ActionResult> GetFeaturedPlaylists(string? tags = null, string? genreIds = null, int offset = 0, int limit = 50)
    {
        var (authToken, _) = GetAuthFromHeaders();

        _logger.LogInformation("Fetching featured playlists (offset={Offset}, limit={Limit}, tags={Tags}, genreIds={GenreIds})",
            offset, limit, tags ?? "(all)", genreIds ?? "(all)");

        var (playlists, hasMore) = await _qobuzService.GetDiscoverPlaylistsAsync(authToken, offset, limit, tags, genreIds);
        var playlistItems = playlists.ToList();

        return Ok(new
        {
            success = true,
            playlists = new
            {
                items = playlistItems.Select(p => new
                {
                    id = p.Id,
                    name = p.Name,
                    description = p.Description,
                    tracks_count = p.TracksCount,
                    duration = p.Duration,
                    is_public = true,
                    is_collaborative = false,
                    owner = new { id = 0, name = p.Owner?.Name },
                    images300 = !string.IsNullOrEmpty(p.CoverUrl) ? new[] { p.CoverUrl } : Array.Empty<string>()
                }),
                total = hasMore ? offset + playlistItems.Count + 1 : offset + playlistItems.Count,
                offset,
                limit,
                hasMore
            }
        });
    }

    /// <summary>
    /// Get user playlists
    /// </summary>
    [HttpGet("user-playlists")]
    public async Task<ActionResult> GetUserPlaylists()
    {
        var (authToken, userId) = GetAuthFromHeaders();
        if (userId == null || string.IsNullOrEmpty(authToken))
        {
            return Unauthorized(new { success = false, error = "Authentifizierung erforderlich" });
        }

        _logger.LogInformation("Fetching playlists for user {UserId}", userId);

        var playlists = await _qobuzService.GetUserPlaylistsAsync(userId.Value, authToken);

        return Ok(new
        {
            success = true,
            playlists = playlists.Select(p => new
            {
                id = p.Id,
                name = p.Name,
                description = p.Description,
                tracksCount = p.TracksCount,
                duration = p.Duration,
                formattedDuration = p.FormattedDuration,
                coverUrl = p.CoverUrl,
                isPublic = p.IsPublic,
                ownerName = p.Owner?.Name
            })
        });
    }

    /// <summary>
    /// Get playlist with tracks
    /// </summary>
    [HttpGet("playlist/{playlistId}")]
    public async Task<ActionResult> GetPlaylist(long playlistId)
    {
        var (authToken, _) = GetAuthFromHeaders();
        if (string.IsNullOrEmpty(authToken))
        {
            return Unauthorized(new { success = false, error = "Authentifizierung erforderlich" });
        }

        _logger.LogInformation("Fetching tracks for playlist {PlaylistId}", playlistId);

        var playlist = await _qobuzService.GetPlaylistAsync(playlistId, authToken);

        if (playlist == null)
        {
            return NotFound(new { success = false, error = "Playlist nicht gefunden" });
        }

        return Ok(new
        {
            success = true,
            playlist = new
            {
                id = playlist.Id,
                name = playlist.Name,
                description = playlist.Description,
                tracksCount = playlist.TracksCount,
                duration = playlist.Duration,
                formattedDuration = playlist.FormattedDuration,
                coverUrl = playlist.CoverUrl
            },
            tracks = playlist.Tracks?.Items?.Select(t => new
            {
                id = t.Id,
                title = t.Title,
                duration = t.Duration,
                formattedDuration = t.FormattedDuration,
                artistName = t.Performer?.Name,
                artistId = t.Performer?.Id,
                albumTitle = t.Album?.Title,
                albumId = t.Album?.Id,
                albumCover = t.Album?.CoverUrl,
                isHiRes = t.IsHiRes,
                qualityLabel = t.QualityLabel,
                isStreamable = t.IsStreamable
            }) ?? []
        });
    }

    // ==================== Albums ====================

    /// <summary>
    /// Get album with tracks
    /// </summary>
    [HttpGet("album/{albumId}")]
    public async Task<ActionResult> GetAlbum(string albumId)
    {
        var (authToken, _) = GetAuthFromHeaders();
        if (string.IsNullOrEmpty(authToken))
        {
            return Unauthorized(new { success = false, error = "Authentifizierung erforderlich" });
        }

        _logger.LogInformation("Fetching tracks for album {AlbumId}", albumId);

        var album = await _qobuzService.GetAlbumAsync(albumId, authToken);

        if (album == null)
        {
            return NotFound(new { success = false, error = "Album nicht gefunden" });
        }

        var trackItemsList = album.Tracks?.Items ?? new List<QobuzTrack>();
        var trackItems = trackItemsList.Select(t => new
        {
            id = t.Id,
            title = t.Title,
            duration = t.Duration,
            track_number = t.TrackNumber,
            media_number = t.MediaNumber,
            performer = new { id = t.Performer?.Id ?? album.Artist?.Id, name = t.Performer?.Name ?? album.Artist?.Name },
            album = new
            {
                id = album.Id,
                title = album.Title,
                image = new { large = album.CoverUrl, small = album.CoverUrl }
            },
            hires = t.IsHiRes,
            hires_streamable = t.IsHiRes,
            streamable = t.IsStreamable,
            maximum_bit_depth = t.MaxBitDepth,
            maximum_sampling_rate = t.MaxSamplingRate
        }).ToList();

        return Ok(new
        {
            id = album.Id,
            title = album.Title,
            artist = new { id = album.Artist?.Id, name = album.Artist?.Name },
            image = new { large = album.CoverUrl, small = album.CoverUrl },
            duration = album.Duration,
            tracks_count = album.TracksCount,
            released_at = album.ReleasedAt,
            product_type = album.TypeLabel,
            maximum_bit_depth = album.MaxBitDepth,
            maximum_sampling_rate = album.MaxSamplingRate,
            hires = album.IsHiRes,
            hires_streamable = album.IsHiRes,
            label = album.Label != null ? new { id = album.Label.Id, name = album.Label.Name } : null,
            genre = album.Genre != null ? new { id = album.Genre.Id, name = album.Genre.Name } : null,
            description = album.Description,
            tracks = new
            {
                items = trackItems,
                total = trackItems.Count,
                offset = 0,
                limit = trackItems.Count
            }
        });
    }

    // ==================== Artists ====================

    /// <summary>
    /// Get artist page with biography, top tracks, discography
    /// </summary>
    [HttpGet("artist/{artistId}")]
    public async Task<ActionResult> GetArtistPage(long artistId)
    {
        var (authToken, _) = GetAuthFromHeaders();

        _logger.LogInformation("Fetching artist page for artist {ArtistId}", artistId);

        var artistPage = await _qobuzService.GetArtistPageAsync(artistId, authToken);

        if (artistPage == null)
        {
            return NotFound(new { success = false, error = "Künstler nicht gefunden" });
        }

        return Ok(new
        {
            success = true,
            artist = new
            {
                id = artistPage.Id,
                name = artistPage.Name?.Display,
                category = artistPage.ArtistCategory,
                biography = artistPage.Biography?.Content,
                biographySource = artistPage.Biography?.Source,
                portraitUrl = artistPage.GetBestImageUrl()
            },
            topTracks = artistPage.TopTracks?.Take(10).Select(t => new
            {
                id = t.Id,
                title = t.Title,
                duration = t.Duration,
                formattedDuration = t.FormattedDuration,
                artistName = t.Performer?.Name,
                artistId = t.Performer?.Id,
                albumTitle = t.Album?.Title,
                albumId = t.Album?.Id,
                coverUrl = t.Album?.CoverUrl,
                isHiRes = t.IsHiRes,
                isStreamable = t.IsStreamable
            }),
            releases = artistPage.Releases?
                .Where(r => r.Type != "download" && r.Type != "next")
                .Select(r => new
                {
                    type = r.Type,
                    hasMore = r.HasMore,
                    items = r.Items?.Take(20).Select(a => new
                    {
                        id = a.Id,
                        title = a.Title,
                        artistName = a.Artist?.Name,
                        coverUrl = a.CoverUrl,
                        releasedAt = a.ReleasedAt,
                        tracksCount = a.TracksCount,
                        typeLabel = a.TypeLabel
                    })
                }),
            similarArtists = artistPage.SimilarArtists?.Items?.Take(12).Select(a => new
            {
                id = a.Id,
                name = a.DisplayName,
                imageUrl = a.ImageUrl
            }),
            appearsOn = artistPage.TracksAppearsOn?.Take(20).Select(t => new
            {
                id = t.Id,
                title = t.Title,
                albumTitle = t.Album?.Title,
                albumId = t.Album?.Id,
                coverUrl = t.Album?.CoverUrl,
                artistName = t.Performer?.Name,
                artistId = t.Performer?.Id
            })
        });
    }

    /// <summary>
    /// Get artist discography with pagination
    /// </summary>
    [HttpGet("artist/{artistId}/discography")]
    public async Task<ActionResult> GetArtistDiscography(
        long artistId,
        string? releaseType = null,
        string sort = "release_date",
        int offset = 0,
        int limit = 20)
    {
        var (authToken, _) = GetAuthFromHeaders();

        _logger.LogInformation("Fetching artist discography for artist {ArtistId} (type={Type}, sort={Sort}, offset={Offset})",
            artistId, releaseType ?? "all", sort, offset);

        var (albums, hasMore) = await _qobuzService.GetArtistReleasesListAsync(
            artistId, releaseType, sort, offset, limit, authToken);

        return Ok(new
        {
            success = true,
            hasMore,
            offset,
            albums = albums.Select(a => new
            {
                id = a.Id,
                title = a.Title,
                coverUrl = a.CoverUrl,
                releasedAt = a.ReleasedAt,
                tracksCount = a.TracksCount,
                isHiRes = a.IsHiRes,
                artistName = a.Artist?.Name,
                releaseType = a.ReleaseType
            })
        });
    }

    // ==================== Favorites ====================

    /// <summary>
    /// Get user's favorite albums
    /// </summary>
    [HttpGet("favorites/albums")]
    public async Task<ActionResult> GetFavoriteAlbums(int limit = 500)
    {
        var (authToken, _) = GetAuthFromHeaders();
        if (string.IsNullOrEmpty(authToken))
        {
            return Unauthorized(new { success = false, error = "Authentifizierung erforderlich" });
        }

        _logger.LogInformation("Fetching favorite albums (limit: {Limit})", limit);

        var albums = await _qobuzService.GetFavoriteAlbumsAsync(authToken, limit);
        var albumItems = albums.ToList();

        return Ok(new
        {
            success = true,
            albums = new
            {
                items = albumItems.Select(a => new
                {
                    id = a.Id,
                    title = a.Title,
                    artist = new { id = a.Artist?.Id, name = a.Artist?.Name },
                    image = new { large = a.CoverUrl, small = a.CoverUrl },
                    tracks_count = a.TracksCount,
                    duration = a.Duration,
                    product_type = a.TypeLabel
                }),
                total = albumItems.Count,
                offset = 0,
                limit
            }
        });
    }

    /// <summary>
    /// Get user's favorite tracks
    /// </summary>
    [HttpGet("favorites/tracks")]
    public async Task<ActionResult> GetFavoriteTracks(int limit = 500)
    {
        var (authToken, _) = GetAuthFromHeaders();
        if (string.IsNullOrEmpty(authToken))
        {
            return Unauthorized(new { success = false, error = "Authentifizierung erforderlich" });
        }

        _logger.LogInformation("Fetching favorite tracks (limit: {Limit})", limit);

        var tracks = await _qobuzService.GetFavoriteTracksAsync(authToken, limit);
        var trackItems = tracks.ToList();

        return Ok(new
        {
            success = true,
            tracks = new
            {
                items = trackItems.Select(t => new
                {
                    id = t.Id,
                    title = t.Title,
                    duration = t.Duration,
                    track_number = t.TrackNumber,
                    performer = new { id = t.Performer?.Id, name = t.Performer?.Name },
                    album = new
                    {
                        id = t.Album?.Id,
                        title = t.Album?.Title,
                        image = new { large = t.Album?.CoverUrl, small = t.Album?.CoverUrl }
                    },
                    hires = t.IsHiRes,
                    maximum_bit_depth = t.MaxBitDepth,
                    maximum_sampling_rate = t.MaxSamplingRate
                }),
                total = trackItems.Count,
                offset = 0,
                limit
            }
        });
    }

    /// <summary>
    /// Get user's favorite artists
    /// </summary>
    [HttpGet("favorites/artists")]
    public async Task<ActionResult> GetFavoriteArtists(int limit = 100)
    {
        var (authToken, _) = GetAuthFromHeaders();
        if (string.IsNullOrEmpty(authToken))
        {
            return Unauthorized(new { success = false, error = "Authentifizierung erforderlich" });
        }

        _logger.LogInformation("Fetching favorite artists (limit: {Limit})", limit);

        var artists = await _qobuzService.GetFavoriteArtistsAsync(authToken, limit);
        var artistItems = artists.ToList();

        return Ok(new
        {
            success = true,
            artists = new
            {
                items = artistItems.Select(a => new
                {
                    id = a.Id,
                    name = a.Name,
                    picture = a.ImageUrl,
                    albums_count = a.AlbumsCount
                }),
                total = artistItems.Count,
                offset = 0,
                limit
            }
        });
    }

    // ==================== Search ====================

    /// <summary>
    /// Search for albums, tracks, artists, playlists
    /// </summary>
    [HttpGet("search")]
    public async Task<ActionResult> Search(string query, int limit = 20, int offset = 0)
    {
        if (string.IsNullOrWhiteSpace(query))
        {
            return BadRequest(new { success = false, error = "Suchbegriff erforderlich" });
        }

        _logger.LogInformation("Searching for: {Query} (offset={Offset}, limit={Limit})", query, offset, limit);

        var result = await _qobuzService.SearchAsync(query, limit, offset);
        var albumItems = result.Albums.ToList();
        var artistItems = result.Artists.ToList();
        var playlistItems = result.Playlists.ToList();
        var trackItems = result.Tracks.ToList();

        return Ok(new
        {
            success = true,
            albums = new
            {
                items = albumItems.Select(a => new
                {
                    id = a.Id,
                    title = a.Title,
                    artist = new { id = a.Artist?.Id, name = a.Artist?.Name },
                    image = new { large = a.CoverUrl, small = a.CoverUrl },
                    tracks_count = a.TracksCount,
                    duration = a.Duration,
                    product_type = a.TypeLabel
                }),
                total = result.AlbumsTotal,
                offset,
                limit
            },
            artists = new
            {
                items = artistItems.Select(a => new
                {
                    id = a.Id,
                    name = a.Name,
                    picture = a.ImageUrl,
                    albums_count = a.AlbumsCount
                }),
                total = result.ArtistsTotal,
                offset,
                limit
            },
            playlists = new
            {
                items = playlistItems.Select(p => new
                {
                    id = p.Id,
                    name = p.Name,
                    description = p.Description,
                    tracks_count = p.TracksCount,
                    duration = p.Duration,
                    is_public = true,
                    is_collaborative = false,
                    owner = new { id = 0, name = p.Owner?.Name },
                    images300 = !string.IsNullOrEmpty(p.CoverUrl) ? new[] { p.CoverUrl } : Array.Empty<string>()
                }),
                total = result.PlaylistsTotal,
                offset,
                limit
            },
            tracks = new
            {
                items = trackItems.Select(t => new
                {
                    id = t.Id,
                    title = t.Title,
                    duration = t.Duration,
                    track_number = t.TrackNumber,
                    performer = new { id = t.Performer?.Id, name = t.Performer?.Name },
                    album = new
                    {
                        id = t.Album?.Id,
                        title = t.Album?.Title,
                        image = new { large = t.Album?.CoverUrl, small = t.Album?.CoverUrl }
                    },
                    hires = t.IsHiRes
                }),
                total = result.TracksTotal,
                offset,
                limit
            }
        });
    }

    // ==================== Streaming ====================

    /// <summary>
    /// Get stream URL for a track
    /// </summary>
    [HttpGet("track-stream-url")]
    public async Task<ActionResult> GetTrackStreamUrl(long trackId, int formatId = 27)
    {
        var (authToken, _) = GetAuthFromHeaders();
        if (string.IsNullOrEmpty(authToken))
        {
            return Unauthorized(new { success = false, error = "Authentifizierung erforderlich" });
        }

        _logger.LogInformation("Getting stream URL for track {TrackId} with format {FormatId}", trackId, formatId);

        var streamUrl = await _qobuzService.GetTrackStreamUrlAsync(trackId, authToken, formatId);

        if (string.IsNullOrEmpty(streamUrl))
        {
            return BadRequest(new { success = false, error = "Stream URL nicht verfügbar" });
        }

        return Ok(new
        {
            success = true,
            url = streamUrl
        });
    }

    // ==================== Players ====================

    /// <summary>
    /// Get available Bluesound players
    /// </summary>
    [HttpGet("players")]
    public async Task<ActionResult> GetPlayers(bool refresh = false, bool refreshStatus = false)
    {
        try
        {
            var players = await _playerService.DiscoverPlayersAsync(
                forceRefresh: refresh,
                skipCache: refreshStatus);

            var selectorItems = _playerService.GetPlayersForSelector(players);

            return Ok(new
            {
                success = true,
                players = selectorItems.Select(p => new
                {
                    id = p.Id,
                    name = p.Name,
                    ipAddress = p.IpAddress,
                    port = p.Port,
                    model = p.Model,
                    brand = p.Brand,
                    isGroup = p.IsGroup,
                    memberCount = p.MemberCount,
                    volume = p.Volume,
                    isFixedVolume = p.IsFixedVolume,
                    isStereoPaired = p.IsStereoPaired,
                    channelMode = p.ChannelMode,
                    members = p.Members.Select(m => new
                    {
                        ipAddress = m.IpAddress,
                        port = m.Port,
                        name = m.Name,
                        brand = m.Brand,
                        modelName = m.ModelName,
                        volume = m.Volume,
                        isFixedVolume = m.IsFixedVolume,
                        isStereoPaired = m.IsStereoPaired,
                        channelMode = m.ChannelMode
                    })
                })
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to discover players");

            var cachedPlayers = await _playerService.DiscoverPlayersAsync(forceRefresh: false, skipCache: false);
            var selectorItems = _playerService.GetPlayersForSelector(cachedPlayers);

            return Ok(new
            {
                success = false,
                error = "Player-Suche fehlgeschlagen",
                players = selectorItems.Select(p => new
                {
                    id = p.Id,
                    name = p.Name,
                    ipAddress = p.IpAddress,
                    port = p.Port,
                    model = p.Model,
                    brand = p.Brand,
                    isGroup = p.IsGroup,
                    memberCount = p.MemberCount,
                    volume = p.Volume,
                    isFixedVolume = p.IsFixedVolume,
                    isStereoPaired = p.IsStereoPaired,
                    channelMode = p.ChannelMode,
                    members = p.Members.Select(m => new
                    {
                        ipAddress = m.IpAddress,
                        port = m.Port,
                        name = m.Name,
                        brand = m.Brand,
                        modelName = m.ModelName,
                        volume = m.Volume,
                        isFixedVolume = m.IsFixedVolume,
                        isStereoPaired = m.IsStereoPaired,
                        channelMode = m.ChannelMode
                    })
                })
            });
        }
    }

    /// <summary>
    /// Get playback status from a Bluesound player
    /// </summary>
    [HttpGet("bluesound/status")]
    public async Task<ActionResult> GetBluesoundStatus(string ip, int port = 11000)
    {
        if (string.IsNullOrEmpty(ip))
        {
            return BadRequest(new { success = false, error = "Fehlende IP-Adresse" });
        }

        var status = await _playerService.GetPlaybackStatusAsync(ip, port);

        if (status == null)
        {
            return BadRequest(new { success = false, error = "Status konnte nicht abgerufen werden" });
        }

        // Convert direct Bluesound URL to proxy URL to avoid mixed content issues
        var imageUrl = status.ImageUrl;
        if (!string.IsNullOrEmpty(imageUrl) && imageUrl.StartsWith($"http://{ip}:{port}"))
        {
            var path = imageUrl.Substring($"http://{ip}:{port}".Length);
            imageUrl = $"/api/qobuz/bluesound/image?ip={ip}&port={port}&path={Uri.EscapeDataString(path)}";
        }

        return Ok(new
        {
            success = true,
            status = new
            {
                state = status.State,
                title = status.Title,
                artist = status.Artist,
                artistId = status.ArtistId,
                album = status.Album,
                imageUrl = imageUrl,
                currentSeconds = status.CurrentSeconds,
                totalSeconds = status.TotalSeconds,
                service = status.Service
            }
        });
    }

    /// <summary>
    /// Get queue from a Bluesound player
    /// </summary>
    [HttpGet("bluesound/queue")]
    public async Task<ActionResult> GetBluesoundQueue(string ip, int port = 11000)
    {
        if (string.IsNullOrEmpty(ip))
        {
            return BadRequest(new { success = false, error = "Fehlende IP-Adresse" });
        }

        _logger.LogInformation("Fetching queue from Bluesound player {Ip}:{Port}", ip, port);

        try
        {
            string? currentSongId = null;
            try
            {
                var statusUrl = $"http://{ip}:{port}/Status";
                var statusXml = await _httpClient.GetStringAsync(statusUrl);
                var statusDoc = XDocument.Parse(statusXml);
                currentSongId = statusDoc.Root?.Element("song")?.Value;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to get current song ID from Status endpoint");
            }

            var allItems = new List<BluesoundQueueItem>();
            int offset = 0;
            int total = 0;
            string? queueId = null;
            int? currentTrackIndex = null;

            do
            {
                var url = $"http://{ip}:{port}/ui/Queue?offset={offset}";
                var xml = await _httpClient.GetStringAsync(url);
                var doc = XDocument.Parse(xml);
                var queue = doc.Element("queue");

                if (queue == null)
                {
                    return BadRequest(new { success = false, error = "Ungültiges Queue-Format" });
                }

                total = int.Parse(queue.Attribute("total")?.Value ?? "0");
                queueId = queue.Attribute("id")?.Value;

                foreach (var item in queue.Elements("item"))
                {
                    var idx = allItems.Count;

                    var nowPlayingMatch = item.Element("nowPlayingMatch");
                    var matchValue = nowPlayingMatch?.Attribute("value")?.Value;
                    if (matchValue != null && matchValue == currentSongId)
                    {
                        currentTrackIndex = idx;
                    }

                    var queueItemId = nowPlayingMatch?.Attribute("value")?.Value;

                    allItems.Add(new BluesoundQueueItem
                    {
                        Index = idx,
                        QueueId = queueItemId,
                        Title = item.Attribute("title")?.Value,
                        Artist = item.Attribute("subTitle")?.Value,
                        Album = item.Attribute("subSubTitle")?.Value,
                        Duration = item.Attribute("duration")?.Value,
                        Quality = item.Attribute("quality")?.Value,
                        ImageUrl = ConvertToAbsoluteUrl(ip, port, item.Attribute("image")?.Value)
                    });
                }

                offset = allItems.Count;
            } while (offset < total);

            return Ok(new
            {
                success = true,
                queueId,
                total,
                currentIndex = currentTrackIndex,
                items = allItems.Select(i => new
                {
                    index = i.Index,
                    queueId = i.QueueId,
                    title = i.Title,
                    artist = i.Artist,
                    album = i.Album,
                    duration = i.Duration,
                    quality = i.Quality,
                    imageUrl = i.ImageUrl
                })
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to fetch queue from Bluesound player {Ip}:{Port}", ip, port);
            return BadRequest(new { success = false, error = "Queue konnte nicht abgerufen werden" });
        }
    }

    /// <summary>
    /// Proxy endpoint for Bluesound images (avoids mixed content issues)
    /// </summary>
    [HttpGet("bluesound/image")]
    public async Task<ActionResult> GetBluesoundImage(string ip, int port, string path)
    {
        if (string.IsNullOrEmpty(ip) || string.IsNullOrEmpty(path))
        {
            return NotFound();
        }

        try
        {
            var imageUrl = $"http://{ip}:{port}{path}";
            using var httpClient = new HttpClient();
            httpClient.Timeout = TimeSpan.FromSeconds(10);

            var response = await httpClient.GetAsync(imageUrl);
            if (!response.IsSuccessStatusCode)
            {
                return NotFound();
            }

            var contentType = response.Content.Headers.ContentType?.MediaType ?? "image/jpeg";
            var imageData = await response.Content.ReadAsByteArrayAsync();

            Response.Headers["Cache-Control"] = "public, max-age=3600";

            return File(imageData, contentType);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to proxy image from Bluesound {Ip}:{Port}{Path}", ip, port, path);
            return NotFound();
        }
    }

    /// <summary>
    /// Play a Qobuz track on a Bluesound player
    /// </summary>
    [HttpPost("play-on-bluesound")]
    public async Task<ActionResult> PlayOnBluesound([FromBody] PlayOnBluesoundRequest request)
    {
        if (string.IsNullOrEmpty(request.Ip) || request.TrackId <= 0 || string.IsNullOrEmpty(request.AuthToken))
        {
            return BadRequest(new { success = false, error = "Fehlende Parameter" });
        }

        _logger.LogInformation("Playing track {TrackId} on Bluesound player {Ip}:{Port} with format {FormatId}",
            request.TrackId, request.Ip, request.Port, request.FormatId);

        var streamUrl = await _qobuzService.GetTrackStreamUrlAsync(request.TrackId, request.AuthToken, request.FormatId);

        if (string.IsNullOrEmpty(streamUrl))
        {
            return BadRequest(new { success = false, error = "Stream URL nicht verfügbar" });
        }

        var success = await _bluesoundService.PlayUrlAsync(
            request.Ip,
            request.Port,
            streamUrl,
            request.Title,
            request.Artist,
            request.Album,
            request.ImageUrl);

        if (!success)
        {
            return BadRequest(new { success = false, error = "Wiedergabe auf Player fehlgeschlagen" });
        }

        return Ok(new { success = true });
    }

    /// <summary>
    /// Play a Qobuz album or playlist natively on a Bluesound player
    /// </summary>
    [HttpPost("play-native-on-bluesound")]
    public async Task<ActionResult> PlayNativeOnBluesound([FromBody] PlayNativeOnBluesoundRequest request)
    {
        if (string.IsNullOrEmpty(request.Ip))
        {
            return BadRequest(new { success = false, error = "Fehlende IP-Adresse" });
        }

        _logger.LogInformation("Native Qobuz playback on {Ip}:{Port} - Type: {Type}, Id: {Id}, TrackIndex: {TrackIndex}",
            request.Ip, request.Port, request.SourceType, request.SourceId, request.TrackIndex);

        bool success;

        if (request.SourceType == "album")
        {
            if (string.IsNullOrEmpty(request.AlbumId) || request.TrackId == null)
            {
                return BadRequest(new { success = false, error = "Fehlende Album-ID oder Track-ID" });
            }

            success = await _bluesoundService.PlayQobuzAlbumAsync(
                request.Ip,
                request.Port,
                request.AlbumId,
                request.TrackIndex ?? 0,
                request.TrackId.Value);
        }
        else if (request.SourceType == "playlist")
        {
            if (request.PlaylistId == null || request.TrackId == null)
            {
                return BadRequest(new { success = false, error = "Fehlende Playlist-ID oder Track-ID" });
            }

            success = await _bluesoundService.PlayQobuzPlaylistAsync(
                request.Ip,
                request.Port,
                request.PlaylistId.Value,
                request.TrackIndex ?? 0,
                request.TrackId.Value);
        }
        else
        {
            return BadRequest(new { success = false, error = "Unbekannter Quelltyp" });
        }

        if (!success)
        {
            return BadRequest(new { success = false, error = "Native Wiedergabe auf Player fehlgeschlagen" });
        }

        return Ok(new { success = true, native = true });
    }

    /// <summary>
    /// Get Qobuz streaming quality from a Bluesound player
    /// </summary>
    [HttpGet("bluesound/quality")]
    public async Task<ActionResult> GetBluesoundQobuzQuality(string playerIp)
    {
        if (string.IsNullOrEmpty(playerIp))
        {
            return BadRequest(new { success = false, error = "Fehlende IP-Adresse" });
        }

        _logger.LogInformation("Getting Qobuz quality from Bluesound player {Ip}", playerIp);

        var quality = await _bluesoundService.GetQobuzQualityAsync(playerIp);

        if (quality == null)
        {
            return BadRequest(new { success = false, error = "Qualitätseinstellung konnte nicht abgerufen werden" });
        }

        var formatId = MapBluesoundToFormatId(quality);

        return Ok(new
        {
            success = true,
            quality,
            formatId
        });
    }

    /// <summary>
    /// Set Qobuz streaming quality on a Bluesound player
    /// </summary>
    [HttpPost("bluesound/quality")]
    public async Task<ActionResult> SetBluesoundQobuzQuality([FromBody] SetQualityRequest request)
    {
        if (string.IsNullOrEmpty(request.PlayerIp))
        {
            return BadRequest(new { success = false, error = "Fehlende IP-Adresse" });
        }

        var quality = MapFormatIdToBluesound(request.FormatId);
        _logger.LogInformation("Setting Qobuz quality to {Quality} (formatId={FormatId}) on Bluesound player {Ip}:{Port}",
            quality, request.FormatId, request.PlayerIp, request.Port);

        var success = await _bluesoundService.SetQobuzQualityAsync(request.PlayerIp, quality);

        if (!success)
        {
            return BadRequest(new { success = false, error = "Qualitätseinstellung konnte nicht gesetzt werden" });
        }

        return Ok(new { success = true, quality, formatId = request.FormatId });
    }

    /// <summary>
    /// Maps BluOS quality string to Qobuz format ID
    /// </summary>
    private static int MapBluesoundToFormatId(string quality) => quality switch
    {
        "MP3" => 5,
        "CD" => 6,
        "HD" => 7,
        "UHD" => 27,
        _ => 27 // Default to highest quality
    };

    /// <summary>
    /// Maps Qobuz format ID to BluOS quality string
    /// </summary>
    private static string MapFormatIdToBluesound(int formatId) => formatId switch
    {
        5 => "MP3",
        6 => "CD",
        7 => "HD",
        27 => "UHD",
        _ => "UHD" // Default to highest quality
    };

    /// <summary>
    /// Control playback on a Bluesound player
    /// </summary>
    [HttpPost("bluesound/control")]
    public async Task<ActionResult> BluesoundControl([FromBody] BluesoundControlRequest request)
    {
        if (string.IsNullOrEmpty(request.Ip) || string.IsNullOrEmpty(request.Action))
        {
            return BadRequest(new { success = false, error = "Fehlende Parameter" });
        }

        _logger.LogInformation("Bluesound control: {Action} on {Ip}:{Port}", request.Action, request.Ip, request.Port);

        var action = request.Action.ToLower();
        bool success;

        if (action.StartsWith("play_id_"))
        {
            var idPart = action.Substring("play_id_".Length);
            if (int.TryParse(idPart, out var queueIndex))
            {
                success = await PlayQueueItemAsync(request.Ip, request.Port, queueIndex);
            }
            else
            {
                return BadRequest(new { success = false, error = "Ungültiger Queue-Index" });
            }
        }
        else
        {
            success = action switch
            {
                "play" => await _playerService.PlayAsync(request.Ip, request.Port),
                "pause" => await _playerService.PauseAsync(request.Ip, request.Port),
                "stop" => await _playerService.StopAsync(request.Ip, request.Port),
                "next" => await _playerService.NextTrackAsync(request.Ip, request.Port),
                "previous" => await _playerService.PreviousTrackAsync(request.Ip, request.Port),
                _ => false
            };
        }

        return Ok(new { success });
    }

    private async Task<bool> PlayQueueItemAsync(string ip, int port, int queueIndex)
    {
        try
        {
            var url = $"http://{ip}:{port}/Play?id={queueIndex}";
            var response = await _httpClient.GetAsync(url);
            return response.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to play queue item {Index} on {Ip}:{Port}", queueIndex, ip, port);
            return false;
        }
    }

    // ==================== Genres ====================

    /// <summary>
    /// Get available music genres
    /// </summary>
    [HttpGet("genres")]
    public ActionResult GetGenres()
    {
        var genres = new[]
        {
            new { id = 112, name = "Pop/Rock" },
            new { id = 80, name = "Jazz" },
            new { id = 10, name = "Klassik" },
            new { id = 160, name = "Deutsche Musik" },
            new { id = 64, name = "Electronic" },
            new { id = 127, name = "Soul/Funk/R&B" },
            new { id = 116, name = "Metal" },
            new { id = 133, name = "Hip-Hop/Rap" },
            new { id = 2, name = "Blues/Country/Folk" },
            new { id = 91, name = "Soundtracks" },
            new { id = 94, name = "World Music" },
            new { id = 167, name = "Kinder" },
            new { id = 59, name = "Hörbücher" }
        };

        return Ok(new { success = true, genres });
    }

    // ==================== Album Info ====================

    /// <summary>
    /// Get AI-generated album information
    /// </summary>
    [HttpGet("album-info")]
    public async Task<ActionResult> GetAlbumInfo(string albumId, string albumTitle, string artistName)
    {
        _logger.LogInformation("Getting album info for {AlbumTitle} by {ArtistName}", albumTitle, artistName);

        try
        {
            var albumInfo = await _albumInfoService.GetAlbumInfoAsync(albumId, artistName, albumTitle);

            if (albumInfo == null)
            {
                return Ok(new
                {
                    success = false,
                    error = "Album-Info nicht verfügbar. Bitte Mistral API Key in den Einstellungen konfigurieren."
                });
            }

            return Ok(new
            {
                success = true,
                style = albumInfo.Style ?? "",
                summary = albumInfo.Summary ?? ""
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting album info for {AlbumTitle}", albumTitle);
            return Ok(new
            {
                success = false,
                error = "Fehler beim Laden der Album-Info"
            });
        }
    }

    // ==================== History ====================

    /// <summary>
    /// Save a Qobuz album to listening history
    /// </summary>
    [HttpPost("history/album")]
    public async Task<ActionResult> SaveAlbumHistory([FromBody] Models.SaveQobuzAlbumHistoryRequest request)
    {
        if (string.IsNullOrEmpty(request.ProfileId))
        {
            return BadRequest(new { success = false, error = "Fehlende ProfileId" });
        }

        if (string.IsNullOrEmpty(request.AlbumId))
        {
            return BadRequest(new { success = false, error = "Fehlende AlbumId" });
        }

        await _historyService.SaveQobuzAlbumAsync(request.ProfileId, request.AlbumId, request.AlbumName, request.Artist, request.CoverUrl);

        return Ok(new { success = true });
    }

    /// <summary>
    /// Save a Qobuz playlist to listening history
    /// </summary>
    [HttpPost("history/playlist")]
    public async Task<ActionResult> SavePlaylistHistory([FromBody] Models.SaveQobuzPlaylistHistoryRequest request)
    {
        if (string.IsNullOrEmpty(request.ProfileId))
        {
            return BadRequest(new { success = false, error = "Fehlende ProfileId" });
        }

        if (string.IsNullOrEmpty(request.PlaylistId))
        {
            return BadRequest(new { success = false, error = "Fehlende PlaylistId" });
        }

        await _historyService.SaveQobuzPlaylistAsync(request.ProfileId, request.PlaylistId, request.PlaylistName, request.CoverUrl, request.Tracks);

        return Ok(new { success = true });
    }

    /// <summary>
    /// Get listening history for a profile
    /// </summary>
    [HttpGet("history")]
    public async Task<ActionResult> GetHistory(string? profileId)
    {
        if (string.IsNullOrEmpty(profileId))
        {
            return Ok(new
            {
                success = true,
                tuneIn = new List<object>(),
                radioParadise = new List<object>(),
                qobuzAlbums = new List<object>(),
                qobuzPlaylists = new List<object>()
            });
        }

        var history = await _historyService.GetAllHistoryAsync(profileId);

        return Ok(new
        {
            success = true,
            tuneIn = history.TuneIn,
            radioParadise = history.RadioParadise,
            qobuzAlbums = history.QobuzAlbums,
            qobuzPlaylists = history.QobuzPlaylists
        });
    }

    // ==================== Helper Methods ====================

    private static string? ConvertToAbsoluteUrl(string ip, int port, string? relativeUrl)
    {
        if (string.IsNullOrEmpty(relativeUrl))
            return null;

        if (relativeUrl.StartsWith($"http://{ip}:{port}"))
        {
            var path = relativeUrl.Substring($"http://{ip}:{port}".Length);
            return $"/api/qobuz/bluesound/image?ip={ip}&port={port}&path={Uri.EscapeDataString(path)}";
        }

        if (relativeUrl.StartsWith("http://") || relativeUrl.StartsWith("https://"))
            return relativeUrl;

        if (relativeUrl.StartsWith("/"))
            return $"/api/qobuz/bluesound/image?ip={ip}&port={port}&path={Uri.EscapeDataString(relativeUrl)}";

        return $"/api/qobuz/bluesound/image?ip={ip}&port={port}&path={Uri.EscapeDataString("/" + relativeUrl)}";
    }
}

// ==================== Request DTOs ====================

public record LoginRequest(string Email, string Password);

/// <summary>
/// Request model for playing a track on a Bluesound player
/// </summary>
public class PlayOnBluesoundRequest
{
    public string Ip { get; set; } = string.Empty;
    public int Port { get; set; } = 11000;
    public long TrackId { get; set; }
    public string AuthToken { get; set; } = string.Empty;
    public int FormatId { get; set; } = 27;
    public string? Title { get; set; }
    public string? Artist { get; set; }
    public string? Album { get; set; }
    public string? ImageUrl { get; set; }
}

/// <summary>
/// Request model for controlling Bluesound playback
/// </summary>
public class BluesoundControlRequest
{
    [System.Text.Json.Serialization.JsonPropertyName("ip")]
    public string Ip { get; set; } = string.Empty;

    [System.Text.Json.Serialization.JsonPropertyName("port")]
    public int Port { get; set; } = 11000;

    [System.Text.Json.Serialization.JsonPropertyName("action")]
    public string Action { get; set; } = string.Empty;
}

/// <summary>
/// Request model for native Qobuz playback on a Bluesound player
/// </summary>
public class PlayNativeOnBluesoundRequest
{
    [System.Text.Json.Serialization.JsonPropertyName("ip")]
    public string Ip { get; set; } = string.Empty;

    [System.Text.Json.Serialization.JsonPropertyName("port")]
    public int Port { get; set; } = 11000;

    [System.Text.Json.Serialization.JsonPropertyName("sourceType")]
    public string SourceType { get; set; } = string.Empty;

    [System.Text.Json.Serialization.JsonPropertyName("sourceId")]
    public string? SourceId { get; set; }

    [System.Text.Json.Serialization.JsonPropertyName("albumId")]
    public string? AlbumId { get; set; }

    [System.Text.Json.Serialization.JsonPropertyName("playlistId")]
    public long? PlaylistId { get; set; }

    [System.Text.Json.Serialization.JsonPropertyName("trackId")]
    public long? TrackId { get; set; }

    [System.Text.Json.Serialization.JsonPropertyName("trackIndex")]
    public int? TrackIndex { get; set; }
}

/// <summary>
/// Represents a track item in the Bluesound player queue
/// </summary>
public class BluesoundQueueItem
{
    public int Index { get; set; }
    public string? QueueId { get; set; }
    public string? Title { get; set; }
    public string? Artist { get; set; }
    public string? Album { get; set; }
    public string? Duration { get; set; }
    public string? Quality { get; set; }
    public string? ImageUrl { get; set; }
}

/// <summary>
/// Request model for setting Qobuz streaming quality on Bluesound
/// </summary>
public class SetQualityRequest
{
    [System.Text.Json.Serialization.JsonPropertyName("playerIp")]
    public string PlayerIp { get; set; } = string.Empty;

    [System.Text.Json.Serialization.JsonPropertyName("port")]
    public int Port { get; set; } = 11000;

    [System.Text.Json.Serialization.JsonPropertyName("formatId")]
    public int FormatId { get; set; } = 27;
}

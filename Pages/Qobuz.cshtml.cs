using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using BluesoundWeb.Models;
using BluesoundWeb.Services;
using System.Xml.Linq;

namespace BluesoundWeb.Pages;

public class QobuzModel : PageModel
{
    private readonly IQobuzApiService _qobuzService;
    private readonly IBluesoundPlayerService _playerService;
    private readonly IBluesoundApiService _bluesoundService;
    private readonly ILogger<QobuzModel> _logger;
    private readonly HttpClient _httpClient;

    public QobuzModel(
        IQobuzApiService qobuzService,
        IBluesoundPlayerService playerService,
        IBluesoundApiService bluesoundService,
        ILogger<QobuzModel> logger,
        IHttpClientFactory httpClientFactory)
    {
        _qobuzService = qobuzService;
        _playerService = playerService;
        _bluesoundService = bluesoundService;
        _logger = logger;
        _httpClient = httpClientFactory.CreateClient();
    }

    // Bound properties for the form
    [BindProperty]
    public string? Email { get; set; }

    [BindProperty]
    public string? Password { get; set; }

    // Display properties
    public QobuzUser? QobuzUser { get; set; }
    public List<QobuzPlaylist> Playlists { get; set; } = new();
    public string? ErrorMessage { get; set; }
    public string? SuccessMessage { get; set; }
    public bool IsLoggedIn { get; set; }
    public bool IsInitializing { get; set; }

    public async Task OnGetAsync()
    {
        // Check if we need to initialize app credentials
        if (!_qobuzService.HasAppCredentials)
        {
            IsInitializing = true;
            var credentials = await _qobuzService.ExtractAppCredentialsAsync();
            if (credentials == null)
            {
                ErrorMessage = "Konnte Qobuz App-Credentials nicht laden. Bitte versuche es später erneut.";
            }
            IsInitializing = false;
        }
    }

    /// <summary>
    /// Returns only the page content for SPA navigation
    /// </summary>
    public async Task<IActionResult> OnGetFragmentAsync()
    {
        // Initialize app credentials if needed
        if (!_qobuzService.HasAppCredentials)
        {
            IsInitializing = true;
            var credentials = await _qobuzService.ExtractAppCredentialsAsync();
            if (credentials == null)
            {
                ErrorMessage = "Konnte Qobuz App-Credentials nicht laden. Bitte versuche es später erneut.";
            }
            IsInitializing = false;
        }

        return Partial("_QobuzContent", this);
    }

    public async Task<IActionResult> OnPostLoginAsync()
    {
        if (string.IsNullOrWhiteSpace(Email) || string.IsNullOrWhiteSpace(Password))
        {
            ErrorMessage = "Bitte E-Mail und Passwort eingeben.";
            return Page();
        }

        _logger.LogInformation("Attempting login for {Email}", Email);

        var loginResponse = await _qobuzService.LoginAsync(Email, Password);

        if (loginResponse?.User == null || string.IsNullOrEmpty(loginResponse.UserAuthToken))
        {
            ErrorMessage = "Login fehlgeschlagen. Bitte überprüfe deine Zugangsdaten.";
            return Page();
        }

        QobuzUser = loginResponse.User;
        IsLoggedIn = true;
        SuccessMessage = $"Erfolgreich eingeloggt als {QobuzUser.DisplayName ?? QobuzUser.Email}";

        // Return login data as JSON for JavaScript to store in localStorage
        return new JsonResult(new
        {
            success = true,
            userId = QobuzUser.Id,
            authToken = loginResponse.UserAuthToken,
            displayName = QobuzUser.DisplayName ?? QobuzUser.Email,
            avatar = QobuzUser.Avatar
        });
    }

    public async Task<IActionResult> OnGetVerifyTokenAsync(long userId, string authToken)
    {
        _logger.LogInformation("Verifying token for user {UserId}", userId);

        var loginResponse = await _qobuzService.LoginWithTokenAsync(userId, authToken);

        if (loginResponse?.User == null)
        {
            return new JsonResult(new { success = false, error = "Token ungültig oder abgelaufen" });
        }

        return new JsonResult(new
        {
            success = true,
            userId = loginResponse.User.Id,
            authToken = loginResponse.UserAuthToken,
            displayName = loginResponse.User.DisplayName ?? loginResponse.User.Email,
            avatar = loginResponse.User.Avatar,
            subscription = loginResponse.User.Credential?.Label
        });
    }

    public async Task<IActionResult> OnGetPlaylistsAsync(long userId, string authToken)
    {
        _logger.LogInformation("Fetching playlists for user {UserId}", userId);

        var playlists = await _qobuzService.GetUserPlaylistsAsync(userId, authToken);

        return new JsonResult(new
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

    public async Task<IActionResult> OnGetPlaylistTracksAsync(long playlistId, string authToken)
    {
        _logger.LogInformation("Fetching tracks for playlist {PlaylistId}", playlistId);

        var playlist = await _qobuzService.GetPlaylistAsync(playlistId, authToken);

        if (playlist == null)
        {
            return new JsonResult(new { success = false, error = "Playlist nicht gefunden" });
        }

        return new JsonResult(new
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
                albumTitle = t.Album?.Title,
                albumCover = t.Album?.CoverUrl,
                isHiRes = t.IsHiRes,
                qualityLabel = t.QualityLabel,
                isStreamable = t.IsStreamable
            }) ?? []
        });
    }

    /// <summary>
    /// Get featured/new release albums from Qobuz
    /// </summary>
    public async Task<IActionResult> OnGetFeaturedAlbumsAsync(string type = "new-releases", int limit = 50)
    {
        _logger.LogInformation("Fetching featured albums: {Type}", type);

        var albums = await _qobuzService.GetFeaturedAlbumsAsync(type, limit);

        return new JsonResult(new
        {
            success = true,
            albums = albums.Select(a => new
            {
                id = a.Id,
                title = a.Title,
                artistName = a.Artist?.Name,
                coverUrl = a.CoverUrl,
                tracksCount = a.TracksCount,
                duration = a.Duration,
                releasedAt = a.ReleasedAt
            })
        });
    }

    /// <summary>
    /// Get most streamed albums from Qobuz discover endpoint with pagination
    /// </summary>
    public async Task<IActionResult> OnGetMostStreamedAlbumsAsync(string? authToken = null, int offset = 0, int limit = 50)
    {
        _logger.LogInformation("Fetching most streamed albums (offset={Offset}, limit={Limit})", offset, limit);

        var (albums, hasMore) = await _qobuzService.GetMostStreamedAlbumsAsync(authToken, offset, limit);

        return new JsonResult(new
        {
            success = true,
            hasMore,
            offset,
            albums = albums.Select(a => new
            {
                id = a.Id,
                title = a.Title,
                artistName = a.Artist?.Name,
                coverUrl = a.CoverUrl,
                tracksCount = a.TracksCount,
                duration = a.Duration,
                releasedAt = a.ReleasedAt
            })
        });
    }

    /// <summary>
    /// Get new releases from Qobuz discover endpoint with pagination
    /// </summary>
    public async Task<IActionResult> OnGetNewReleasesAsync(string? authToken = null, int offset = 0, int limit = 50)
    {
        _logger.LogInformation("Fetching new releases (offset={Offset}, limit={Limit})", offset, limit);

        var (albums, hasMore) = await _qobuzService.GetNewReleasesAsync(authToken, offset, limit);

        return new JsonResult(new
        {
            success = true,
            hasMore,
            offset,
            albums = albums.Select(a => new
            {
                id = a.Id,
                title = a.Title,
                artistName = a.Artist?.Name,
                coverUrl = a.CoverUrl,
                tracksCount = a.TracksCount,
                duration = a.Duration,
                releasedAt = a.ReleasedAt
            })
        });
    }

    /// <summary>
    /// Get discover playlists from Qobuz with pagination and optional tag/genre filters
    /// </summary>
    public async Task<IActionResult> OnGetDiscoverPlaylistsAsync(string? authToken = null, int offset = 0, int limit = 50, string? tags = null, string? genreIds = null)
    {
        _logger.LogInformation("Fetching discover playlists (offset={Offset}, limit={Limit}, tags={Tags}, genreIds={GenreIds})", offset, limit, tags ?? "(all)", genreIds ?? "(all)");

        var (playlists, hasMore) = await _qobuzService.GetDiscoverPlaylistsAsync(authToken, offset, limit, tags, genreIds);

        return new JsonResult(new
        {
            success = true,
            hasMore,
            offset,
            playlists = playlists.Select(p => new
            {
                id = p.Id,
                name = p.Name,
                description = p.Description,
                tracksCount = p.TracksCount,
                duration = p.Duration,
                formattedDuration = p.FormattedDuration,
                coverUrl = p.CoverUrl,
                ownerName = p.Owner?.Name
            })
        });
    }

    /// <summary>
    /// Get featured/editorial playlists from Qobuz
    /// </summary>
    public async Task<IActionResult> OnGetFeaturedPlaylistsAsync(int limit = 50)
    {
        _logger.LogInformation("Fetching featured playlists");

        var playlists = await _qobuzService.GetFeaturedPlaylistsAsync(limit);

        return new JsonResult(new
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
                ownerName = p.Owner?.Name
            })
        });
    }

    /// <summary>
    /// Search for albums, playlists, and tracks
    /// </summary>
    public async Task<IActionResult> OnGetSearchAsync(string query, int limit = 20)
    {
        if (string.IsNullOrWhiteSpace(query))
        {
            return new JsonResult(new { success = false, error = "Suchbegriff erforderlich" });
        }

        _logger.LogInformation("Searching for: {Query}", query);

        var result = await _qobuzService.SearchAsync(query, limit);

        return new JsonResult(new
        {
            success = true,
            albums = result.Albums.Select(a => new
            {
                id = a.Id,
                title = a.Title,
                artistName = a.Artist?.Name,
                coverUrl = a.CoverUrl,
                tracksCount = a.TracksCount,
                duration = a.Duration,
                typeLabel = a.TypeLabel,
                isSingle = a.IsSingle,
                type = "album"
            }),
            playlists = result.Playlists.Select(p => new
            {
                id = p.Id,
                name = p.Name,
                description = p.Description,
                tracksCount = p.TracksCount,
                coverUrl = p.CoverUrl,
                ownerName = p.Owner?.Name,
                type = "playlist"
            }),
            tracks = result.Tracks.Select(t => new
            {
                id = t.Id,
                title = t.Title,
                artistName = t.Performer?.Name,
                albumTitle = t.Album?.Title,
                albumId = t.Album?.Id,
                coverUrl = t.Album?.CoverUrl,
                duration = t.Duration,
                formattedDuration = t.FormattedDuration,
                isHiRes = t.IsHiRes,
                type = "track"
            })
        });
    }

    /// <summary>
    /// Get personalized recommendations for the user
    /// </summary>
    public async Task<IActionResult> OnGetRecommendationsAsync(string authToken, int limit = 50)
    {
        _logger.LogInformation("Fetching recommendations");

        var result = await _qobuzService.GetRecommendationsAsync(authToken, limit);

        return new JsonResult(new
        {
            success = true,
            albums = result.Albums.Select(a => new
            {
                id = a.Id,
                title = a.Title,
                artistName = a.Artist?.Name,
                coverUrl = a.CoverUrl,
                tracksCount = a.TracksCount,
                duration = a.Duration,
                typeLabel = a.TypeLabel,
                type = "album"
            }),
            playlists = result.Playlists.Select(p => new
            {
                id = p.Id,
                name = p.Name,
                description = p.Description,
                tracksCount = p.TracksCount,
                coverUrl = p.CoverUrl,
                ownerName = p.Owner?.Name,
                type = "playlist"
            }),
            tracks = result.Tracks.Select(t => new
            {
                id = t.Id,
                title = t.Title,
                artistName = t.Performer?.Name,
                albumTitle = t.Album?.Title,
                albumId = t.Album?.Id,
                coverUrl = t.Album?.CoverUrl,
                duration = t.Duration,
                formattedDuration = t.FormattedDuration,
                isHiRes = t.IsHiRes,
                type = "track"
            })
        });
    }

    /// <summary>
    /// Get user's favorite albums
    /// </summary>
    public async Task<IActionResult> OnGetFavoriteAlbumsAsync(string authToken, int limit = 500)
    {
        _logger.LogInformation("Fetching favorite albums (limit: {Limit})", limit);

        var albums = await _qobuzService.GetFavoriteAlbumsAsync(authToken, limit);

        return new JsonResult(new
        {
            success = true,
            albums = albums.Select(a => new
            {
                id = a.Id,
                title = a.Title,
                artistName = a.Artist?.Name,
                coverUrl = a.CoverUrl,
                tracksCount = a.TracksCount,
                duration = a.Duration,
                typeLabel = a.TypeLabel,
                type = "album"
            })
        });
    }

    /// <summary>
    /// Get user's favorite tracks
    /// </summary>
    public async Task<IActionResult> OnGetFavoriteTracksAsync(string authToken, int limit = 500)
    {
        _logger.LogInformation("Fetching favorite tracks (limit: {Limit})", limit);

        var tracks = await _qobuzService.GetFavoriteTracksAsync(authToken, limit);

        return new JsonResult(new
        {
            success = true,
            tracks = tracks.Select(t => new
            {
                id = t.Id,
                title = t.Title,
                artistName = t.Performer?.Name,
                albumTitle = t.Album?.Title,
                albumId = t.Album?.Id,
                coverUrl = t.Album?.CoverUrl,
                duration = t.Duration,
                formattedDuration = t.FormattedDuration,
                isHiRes = t.IsHiRes,
                type = "track"
            })
        });
    }

    /// <summary>
    /// Get user's favorite artists
    /// </summary>
    public async Task<IActionResult> OnGetFavoriteArtistsAsync(string authToken, int limit = 100)
    {
        _logger.LogInformation("Fetching favorite artists (limit: {Limit})", limit);

        var artists = await _qobuzService.GetFavoriteArtistsAsync(authToken, limit);

        return new JsonResult(new
        {
            success = true,
            artists = artists.Select(a => new
            {
                id = a.Id,
                name = a.Name,
                imageUrl = a.ImageUrl,
                albumsCount = a.AlbumsCount,
                type = "artist"
            })
        });
    }

    /// <summary>
    /// Get album with tracks
    /// </summary>
    public async Task<IActionResult> OnGetAlbumTracksAsync(string albumId, string authToken)
    {
        _logger.LogInformation("Fetching tracks for album {AlbumId}", albumId);

        var album = await _qobuzService.GetAlbumAsync(albumId, authToken);

        if (album == null)
        {
            return new JsonResult(new { success = false, error = "Album nicht gefunden" });
        }

        return new JsonResult(new
        {
            success = true,
            album = new
            {
                id = album.Id,
                title = album.Title,
                artistName = album.Artist?.Name,
                coverUrl = album.CoverUrl,
                tracksCount = album.TracksCount,
                duration = album.Duration,
                label = album.Label?.Name,
                genre = album.Genre?.Name,
                description = album.Description,
                isHiRes = album.IsHiRes
            },
            tracks = album.Tracks?.Items?.Select(t => new
            {
                id = t.Id,
                title = t.Title,
                trackNumber = t.TrackNumber,
                duration = t.Duration,
                formattedDuration = t.FormattedDuration,
                artistName = t.Performer?.Name ?? album.Artist?.Name,
                albumTitle = album.Title,
                albumCover = album.CoverUrl,
                isHiRes = t.IsHiRes,
                qualityLabel = t.QualityLabel,
                isStreamable = t.IsStreamable
            }) ?? []
        });
    }

    public async Task<IActionResult> OnGetTrackStreamUrlAsync(long trackId, string authToken, int formatId = 27)
    {
        _logger.LogInformation("Getting stream URL for track {TrackId} with format {FormatId}", trackId, formatId);

        var streamUrl = await _qobuzService.GetTrackStreamUrlAsync(trackId, authToken, formatId);

        if (string.IsNullOrEmpty(streamUrl))
        {
            return new JsonResult(new { success = false, error = "Stream URL nicht verfügbar" });
        }

        return new JsonResult(new
        {
            success = true,
            url = streamUrl
        });
    }

    /// <summary>
    /// Debug endpoint to check credential extraction status
    /// </summary>
    public async Task<IActionResult> OnGetDebugCredentialsAsync(bool refresh = false)
    {
        if (refresh)
        {
            _qobuzService.ClearCachedCredentials();
        }

        var credentials = await _qobuzService.ExtractAppCredentialsAsync();

        return new JsonResult(new
        {
            hasCredentials = credentials != null,
            appId = credentials?.AppId,
            secretLength = credentials?.AppSecret?.Length ?? 0,
            secretPreview = credentials?.AppSecret?.Length > 10
                ? credentials.AppSecret.Substring(0, 5) + "..." + credentials.AppSecret.Substring(credentials.AppSecret.Length - 5)
                : null,
            hasMixedCase = credentials?.AppSecret != null &&
                credentials.AppSecret.Any(char.IsUpper) &&
                credentials.AppSecret.Any(char.IsLower)
        });
    }

    /// <summary>
    /// Get available Bluesound players (grouped like on home page).
    /// Uses stored players from DB when available for faster response.
    /// </summary>
    public async Task<IActionResult> OnGetPlayersAsync(bool refresh = false, bool refreshStatus = false)
    {
        try
        {
            // Discover players using the consolidated service
            var players = await _playerService.DiscoverPlayersAsync(
                forceRefresh: refresh,
                skipCache: refreshStatus);

            // Get players formatted for the selector UI
            var selectorItems = _playerService.GetPlayersForSelector(players);

            return new JsonResult(new
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

            // Try to return cached players on error
            var cachedPlayers = await _playerService.DiscoverPlayersAsync(forceRefresh: false, skipCache: false);
            var selectorItems = _playerService.GetPlayersForSelector(cachedPlayers);

            return new JsonResult(new
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
    /// Play a Qobuz track on a Bluesound player
    /// </summary>
    public async Task<IActionResult> OnPostPlayOnBluesoundAsync(
        [FromBody] PlayOnBluesoundRequest request)
    {
        if (string.IsNullOrEmpty(request.Ip) || request.TrackId <= 0 || string.IsNullOrEmpty(request.AuthToken))
        {
            return new JsonResult(new { success = false, error = "Fehlende Parameter" });
        }

        _logger.LogInformation("Playing track {TrackId} on Bluesound player {Ip}:{Port} with format {FormatId}",
            request.TrackId, request.Ip, request.Port, request.FormatId);

        // Get the stream URL from Qobuz with specified quality
        var streamUrl = await _qobuzService.GetTrackStreamUrlAsync(request.TrackId, request.AuthToken, request.FormatId);

        if (string.IsNullOrEmpty(streamUrl))
        {
            return new JsonResult(new { success = false, error = "Stream URL nicht verfügbar" });
        }

        // Play the URL on the Bluesound player
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
            return new JsonResult(new { success = false, error = "Wiedergabe auf Player fehlgeschlagen" });
        }

        return new JsonResult(new { success = true });
    }

    /// <summary>
    /// Play a Qobuz album or playlist natively on a Bluesound player.
    /// Uses the built-in BluOS Qobuz integration - the player manages the queue itself.
    /// </summary>
    public async Task<IActionResult> OnPostPlayNativeOnBluesoundAsync(
        [FromBody] PlayNativeOnBluesoundRequest request)
    {
        if (string.IsNullOrEmpty(request.Ip))
        {
            return new JsonResult(new { success = false, error = "Fehlende IP-Adresse" });
        }

        _logger.LogInformation("Native Qobuz playback on {Ip}:{Port} - Type: {Type}, Id: {Id}, TrackIndex: {TrackIndex}",
            request.Ip, request.Port, request.SourceType, request.SourceId, request.TrackIndex);

        bool success;

        if (request.SourceType == "album")
        {
            if (string.IsNullOrEmpty(request.AlbumId) || request.TrackId == null)
            {
                return new JsonResult(new { success = false, error = "Fehlende Album-ID oder Track-ID" });
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
                return new JsonResult(new { success = false, error = "Fehlende Playlist-ID oder Track-ID" });
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
            return new JsonResult(new { success = false, error = "Unbekannter Quelltyp" });
        }

        if (!success)
        {
            return new JsonResult(new { success = false, error = "Native Wiedergabe auf Player fehlgeschlagen" });
        }

        return new JsonResult(new { success = true, native = true });
    }

    /// <summary>
    /// Control playback on a Bluesound player (play/pause/stop)
    /// </summary>
    public async Task<IActionResult> OnPostBluesoundControlAsync(
        [FromBody] BluesoundControlRequest request)
    {
        if (string.IsNullOrEmpty(request.Ip) || string.IsNullOrEmpty(request.Action))
        {
            return new JsonResult(new { success = false, error = "Fehlende Parameter" });
        }

        _logger.LogInformation("Bluesound control: {Action} on {Ip}:{Port}", request.Action, request.Ip, request.Port);

        var action = request.Action.ToLower();
        bool success;

        // Handle play_id_X action for playing a specific queue item
        if (action.StartsWith("play_id_"))
        {
            var idPart = action.Substring("play_id_".Length);
            if (int.TryParse(idPart, out var queueIndex))
            {
                success = await PlayQueueItemAsync(request.Ip, request.Port, queueIndex);
            }
            else
            {
                return new JsonResult(new { success = false, error = "Ungültiger Queue-Index" });
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

        return new JsonResult(new { success });
    }

    /// <summary>
    /// Play a specific item from the Bluesound queue by index
    /// </summary>
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

    /// <summary>
    /// Get playback status from a Bluesound player
    /// </summary>
    public async Task<IActionResult> OnGetBluesoundStatusAsync(string ip, int port = 11000)
    {
        if (string.IsNullOrEmpty(ip))
        {
            return new JsonResult(new { success = false, error = "Fehlende IP-Adresse" });
        }

        var status = await _playerService.GetPlaybackStatusAsync(ip, port);

        if (status == null)
        {
            return new JsonResult(new { success = false, error = "Status konnte nicht abgerufen werden" });
        }

        return new JsonResult(new
        {
            success = true,
            status = new
            {
                state = status.State,
                title = status.Title,
                artist = status.Artist,
                album = status.Album,
                imageUrl = status.ImageUrl,
                currentSeconds = status.CurrentSeconds,
                totalSeconds = status.TotalSeconds,
                service = status.Service
            }
        });
    }

    /// <summary>
    /// Get the Qobuz streaming quality setting from a Bluesound player
    /// </summary>
    public async Task<IActionResult> OnGetBluesoundQobuzQualityAsync(string playerIp)
    {
        if (string.IsNullOrEmpty(playerIp))
        {
            return new JsonResult(new { success = false, error = "Fehlende IP-Adresse" });
        }

        _logger.LogInformation("Getting Qobuz quality from Bluesound player {Ip}", playerIp);

        var quality = await _bluesoundService.GetQobuzQualityAsync(playerIp);

        if (quality == null)
        {
            return new JsonResult(new { success = false, error = "Qualitätseinstellung konnte nicht abgerufen werden" });
        }

        var formatId = MapBluesoundToFormatId(quality);

        return new JsonResult(new
        {
            success = true,
            quality,
            formatId
        });
    }

    /// <summary>
    /// Set the Qobuz streaming quality on a Bluesound player
    /// </summary>
    public async Task<IActionResult> OnPostSetBluesoundQobuzQualityAsync(string playerIp, int formatId, int port = 11000)
    {
        if (string.IsNullOrEmpty(playerIp))
        {
            return new JsonResult(new { success = false, error = "Fehlende IP-Adresse" });
        }

        var quality = MapFormatIdToBluesound(formatId);
        _logger.LogInformation("Setting Qobuz quality to {Quality} (formatId={FormatId}) on Bluesound player {Ip}:{Port}",
            quality, formatId, playerIp, port);

        var success = await _bluesoundService.SetQobuzQualityAsync(playerIp, quality);

        if (!success)
        {
            return new JsonResult(new { success = false, error = "Qualitätseinstellung konnte nicht gesetzt werden" });
        }

        return new JsonResult(new { success = true, quality, formatId });
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
    /// Get queue directly from a Bluesound player via /ui/Queue endpoint
    /// </summary>
    public async Task<IActionResult> OnGetBluesoundQueueAsync(string ip, int port = 11000)
    {
        if (string.IsNullOrEmpty(ip))
        {
            return new JsonResult(new { success = false, error = "Fehlende IP-Adresse" });
        }

        _logger.LogInformation("Fetching queue from Bluesound player {Ip}:{Port}", ip, port);

        try
        {
            // First, get the current song ID from /Status to know which track is playing
            string? currentSongId = null;
            try
            {
                var statusUrl = $"http://{ip}:{port}/Status";
                var statusXml = await _httpClient.GetStringAsync(statusUrl);
                var statusDoc = XDocument.Parse(statusXml);
                currentSongId = statusDoc.Root?.Element("song")?.Value;
                _logger.LogInformation("Current song ID from Status: {SongId}", currentSongId);
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
                    return new JsonResult(new { success = false, error = "Ungültiges Queue-Format" });
                }

                total = int.Parse(queue.Attribute("total")?.Value ?? "0");
                queueId = queue.Attribute("id")?.Value;

                foreach (var item in queue.Elements("item"))
                {
                    var idx = allItems.Count;

                    // The nowPlayingMatch element contains a "value" attribute with the queue position
                    // Compare it with the current song ID from /Status to find the playing track
                    var nowPlayingMatch = item.Element("nowPlayingMatch");
                    var matchValue = nowPlayingMatch?.Attribute("value")?.Value;
                    if (matchValue != null && matchValue == currentSongId)
                    {
                        _logger.LogInformation("Found current track at index {Index} (matchValue={MatchValue})", idx, matchValue);
                        currentTrackIndex = idx;
                    }

                    // Get the queue ID from nowPlayingMatch value (used for /Play?id=X)
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

            // Debug: Log the final currentTrackIndex
            _logger.LogInformation("Queue fetched: {Total} items, currentTrackIndex={Index}", total, currentTrackIndex);

            return new JsonResult(new
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
            return new JsonResult(new { success = false, error = "Queue konnte nicht abgerufen werden" });
        }
    }

    /// <summary>
    /// Converts a relative image URL to an absolute URL pointing to the Bluesound player
    /// </summary>
    private static string? ConvertToAbsoluteUrl(string ip, int port, string? relativeUrl)
    {
        if (string.IsNullOrEmpty(relativeUrl))
            return null;

        if (relativeUrl.StartsWith("http://") || relativeUrl.StartsWith("https://"))
            return relativeUrl;

        // Handle relative paths like /Artwork?...
        if (relativeUrl.StartsWith("/"))
            return $"http://{ip}:{port}{relativeUrl}";

        return $"http://{ip}:{port}/{relativeUrl}";
    }
}

/// <summary>
/// Request model for playing a track on a Bluesound player
/// </summary>
public class PlayOnBluesoundRequest
{
    public string Ip { get; set; } = string.Empty;
    public int Port { get; set; } = 11000;
    public long TrackId { get; set; }
    public string AuthToken { get; set; } = string.Empty;
    public int FormatId { get; set; } = 27; // Default: Hi-Res Max
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
    public string Ip { get; set; } = string.Empty;
    public int Port { get; set; } = 11000;
    public string Action { get; set; } = string.Empty;
}

/// <summary>
/// Request model for native Qobuz playback on a Bluesound player.
/// Uses the built-in BluOS Qobuz integration.
/// </summary>
public class PlayNativeOnBluesoundRequest
{
    public string Ip { get; set; } = string.Empty;
    public int Port { get; set; } = 11000;

    /// <summary>
    /// Type of source: "album" or "playlist"
    /// </summary>
    public string SourceType { get; set; } = string.Empty;

    /// <summary>
    /// Source ID (album ID or playlist ID as string)
    /// </summary>
    public string? SourceId { get; set; }

    /// <summary>
    /// Album ID (for album playback)
    /// </summary>
    public string? AlbumId { get; set; }

    /// <summary>
    /// Playlist ID (for playlist playback)
    /// </summary>
    public long? PlaylistId { get; set; }

    /// <summary>
    /// Track ID within playlist (required for playlist playback)
    /// </summary>
    public long? TrackId { get; set; }

    /// <summary>
    /// Index of track to start from (0-based)
    /// </summary>
    public int? TrackIndex { get; set; }
}

/// <summary>
/// Represents a track item in the Bluesound player queue
/// </summary>
public class BluesoundQueueItem
{
    public int Index { get; set; }
    /// <summary>
    /// The Bluesound queue ID for this item (used for /Play?id=X)
    /// </summary>
    public string? QueueId { get; set; }
    public string? Title { get; set; }
    public string? Artist { get; set; }
    public string? Album { get; set; }
    public string? Duration { get; set; }
    public string? Quality { get; set; }
    public string? ImageUrl { get; set; }
}

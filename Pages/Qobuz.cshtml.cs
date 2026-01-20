using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using BluesoundWeb.Models;
using BluesoundWeb.Services;

namespace BluesoundWeb.Pages;

public class QobuzModel : PageModel
{
    private readonly IQobuzApiService _qobuzService;
    private readonly IPlayerDiscoveryService _discoveryService;
    private readonly IBluesoundApiService _bluesoundService;
    private readonly ILogger<QobuzModel> _logger;

    // Cache for discovered players
    private static List<BluesoundPlayer> _cachedPlayers = new();
    private static DateTime _lastDiscovery = DateTime.MinValue;

    public QobuzModel(
        IQobuzApiService qobuzService,
        IPlayerDiscoveryService discoveryService,
        IBluesoundApiService bluesoundService,
        ILogger<QobuzModel> logger)
    {
        _qobuzService = qobuzService;
        _discoveryService = discoveryService;
        _bluesoundService = bluesoundService;
        _logger = logger;
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

    public async Task<IActionResult> OnGetTrackStreamUrlAsync(long trackId, string authToken)
    {
        _logger.LogInformation("Getting stream URL for track {TrackId}", trackId);

        var streamUrl = await _qobuzService.GetTrackStreamUrlAsync(trackId, authToken);

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
    /// Get available Bluesound players
    /// </summary>
    public async Task<IActionResult> OnGetPlayersAsync(bool refresh = false)
    {
        // Use cached players if recent (within 30 seconds) and not forcing refresh
        if (!refresh && _cachedPlayers.Count > 0 && DateTime.Now - _lastDiscovery < TimeSpan.FromSeconds(30))
        {
            return new JsonResult(new
            {
                success = true,
                players = FormatPlayersForJson(_cachedPlayers)
            });
        }

        _logger.LogInformation("Discovering Bluesound players...");

        try
        {
            // Discover players on the network
            var players = await _discoveryService.DiscoverPlayersAsync(TimeSpan.FromSeconds(3));

            // Filter out secondary stereo pair speakers
            players = players.Where(p => !p.IsSecondaryStereoPairSpeaker).ToList();

            _cachedPlayers = players;
            _lastDiscovery = DateTime.Now;

            _logger.LogInformation("Discovered {Count} Bluesound players", players.Count);

            return new JsonResult(new
            {
                success = true,
                players = FormatPlayersForJson(players)
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to discover players");
            return new JsonResult(new
            {
                success = false,
                error = "Player-Suche fehlgeschlagen",
                players = FormatPlayersForJson(_cachedPlayers)
            });
        }
    }

    private static object FormatPlayersForJson(List<BluesoundPlayer> players)
    {
        return players.Select(p => new
        {
            id = p.Id,
            name = p.Name,
            ip = p.IpAddress,
            port = p.Port,
            model = p.ModelName,
            brand = p.Brand,
            isGrouped = p.IsGrouped,
            isMaster = p.IsMaster,
            groupName = p.GroupName
        });
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

        _logger.LogInformation("Playing track {TrackId} on Bluesound player {Ip}:{Port}",
            request.TrackId, request.Ip, request.Port);

        // Get the stream URL from Qobuz
        var streamUrl = await _qobuzService.GetTrackStreamUrlAsync(request.TrackId, request.AuthToken);

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

        bool success = request.Action.ToLower() switch
        {
            "play" => await _bluesoundService.PlayAsync(request.Ip, request.Port),
            "pause" => await _bluesoundService.PauseAsync(request.Ip, request.Port),
            "stop" => await _bluesoundService.StopAsync(request.Ip, request.Port),
            "next" => await _bluesoundService.NextTrackAsync(request.Ip, request.Port),
            "previous" => await _bluesoundService.PreviousTrackAsync(request.Ip, request.Port),
            _ => false
        };

        return new JsonResult(new { success });
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

        var status = await _bluesoundService.GetPlaybackStatusAsync(ip, port);

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

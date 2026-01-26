using Microsoft.AspNetCore.Mvc;
using BluesoundWeb.Services;
using BluesoundWeb.Models;

namespace BluesoundWeb.Controllers;

/// <summary>
/// REST API Controller for Bluesound player management.
/// Used by the Angular frontend.
/// </summary>
[ApiController]
[Route("api")]
public class PlayersController : ControllerBase
{
    private readonly IBluesoundPlayerService _playerService;
    private readonly IBluesoundApiService _bluesoundApi;

    public PlayersController(
        IBluesoundPlayerService playerService,
        IBluesoundApiService bluesoundApi)
    {
        _playerService = playerService;
        _bluesoundApi = bluesoundApi;
    }

    // ==================== Player Discovery ====================

    /// <summary>
    /// Get all discovered players
    /// </summary>
    [HttpGet("players")]
    public async Task<ActionResult<List<BluesoundPlayer>>> GetPlayers()
    {
        var players = await _playerService.DiscoverPlayersAsync();
        return Ok(players);
    }

    /// <summary>
    /// Force refresh player discovery
    /// </summary>
    [HttpPost("players/refresh")]
    public async Task<ActionResult<List<BluesoundPlayer>>> RefreshPlayers()
    {
        var players = await _playerService.DiscoverPlayersAsync(forceRefresh: true);
        return Ok(players);
    }

    // ==================== Player Status ====================

    /// <summary>
    /// Get player sync status
    /// </summary>
    [HttpGet("player/{ip}/sync")]
    public async Task<ActionResult<BluesoundPlayer>> GetSyncStatus(string ip)
    {
        var player = await _bluesoundApi.GetPlayerStatusAsync(ip);
        if (player == null)
            return NotFound();

        return Ok(player);
    }

    /// <summary>
    /// Get playback status
    /// </summary>
    [HttpGet("player/{ip}/status")]
    public async Task<ActionResult<PlaybackStatus>> GetStatus(string ip, int port = 11000)
    {
        var status = await _playerService.GetPlaybackStatusAsync(ip, port);
        if (status == null)
            return NotFound();

        return Ok(status);
    }

    // ==================== Playback Control ====================

    /// <summary>
    /// Play
    /// </summary>
    [HttpPost("player/{ip}/play")]
    public async Task<ActionResult> Play(string ip, int port = 11000)
    {
        var success = await _playerService.PlayAsync(ip, port);
        return success ? Ok() : BadRequest();
    }

    /// <summary>
    /// Pause
    /// </summary>
    [HttpPost("player/{ip}/pause")]
    public async Task<ActionResult> Pause(string ip, int port = 11000)
    {
        var success = await _playerService.PauseAsync(ip, port);
        return success ? Ok() : BadRequest();
    }

    /// <summary>
    /// Stop
    /// </summary>
    [HttpPost("player/{ip}/stop")]
    public async Task<ActionResult> Stop(string ip, int port = 11000)
    {
        var success = await _playerService.StopAsync(ip, port);
        return success ? Ok() : BadRequest();
    }

    /// <summary>
    /// Skip to next track
    /// </summary>
    [HttpPost("player/{ip}/skip")]
    public async Task<ActionResult> Skip(string ip, int port = 11000)
    {
        var success = await _playerService.NextTrackAsync(ip, port);
        return success ? Ok() : BadRequest();
    }

    /// <summary>
    /// Go back to previous track
    /// </summary>
    [HttpPost("player/{ip}/back")]
    public async Task<ActionResult> Back(string ip, int port = 11000)
    {
        var success = await _playerService.PreviousTrackAsync(ip, port);
        return success ? Ok() : BadRequest();
    }

    // ==================== Volume Control ====================

    /// <summary>
    /// Set volume
    /// </summary>
    [HttpPost("player/{ip}/volume")]
    public async Task<ActionResult> SetVolume(string ip, [FromBody] VolumeRequest request, int port = 11000)
    {
        var success = await _playerService.SetVolumeAsync(ip, request.Level, port);
        return success ? Ok() : BadRequest();
    }

    // ==================== Group Management ====================

    /// <summary>
    /// Create a group
    /// </summary>
    [HttpPost("player/{ip}/group/create")]
    public async Task<ActionResult> CreateGroup(string ip, [FromBody] CreateGroupRequest request, int port = 11000)
    {
        bool success = true;
        foreach (var slaveIp in request.SlaveIps)
        {
            success = success && await _bluesoundApi.AddSlaveAsync(ip, port, slaveIp);
        }
        return success ? Ok() : BadRequest();
    }

    /// <summary>
    /// Add player to group
    /// </summary>
    [HttpPost("player/{ip}/group/add")]
    public async Task<ActionResult> AddToGroup(string ip, [FromBody] AddToGroupRequest request, int port = 11000)
    {
        var success = await _bluesoundApi.AddSlaveAsync(ip, port, request.SlaveIp);
        return success ? Ok() : BadRequest();
    }

    /// <summary>
    /// Remove player from group
    /// </summary>
    [HttpPost("player/{ip}/group/remove")]
    public async Task<ActionResult> RemoveFromGroup(string ip, [FromBody] RemoveFromGroupRequest request, int port = 11000)
    {
        var success = await _bluesoundApi.RemoveSlaveAsync(ip, port, request.SlaveIp);
        return success ? Ok() : BadRequest();
    }

    /// <summary>
    /// Leave group
    /// </summary>
    [HttpPost("player/{ip}/group/leave")]
    public async Task<ActionResult> LeaveGroup(string ip, int port = 11000)
    {
        var success = await _bluesoundApi.LeaveGroupAsync(ip, port);
        return success ? Ok() : BadRequest();
    }

    // ==================== Seek & Mute ====================

    /// <summary>
    /// Seek to position
    /// </summary>
    [HttpPost("player/{ip}/seek")]
    public async Task<ActionResult> Seek(string ip, [FromBody] SeekRequest request, int port = 11000)
    {
        // BluOS API: /Seek?time=<seconds>
        try
        {
            using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(5) };
            var response = await client.GetAsync($"http://{ip}:{port}/Seek?time={request.Seconds}");
            return response.IsSuccessStatusCode ? Ok() : BadRequest();
        }
        catch
        {
            return BadRequest();
        }
    }

    /// <summary>
    /// Toggle mute
    /// </summary>
    [HttpPost("player/{ip}/mute")]
    public async Task<ActionResult> Mute(string ip, [FromBody] MuteRequest request, int port = 11000)
    {
        // BluOS API: /Volume?mute=<0|1>
        try
        {
            using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(5) };
            var muteValue = request.Mute ? 1 : 0;
            var response = await client.GetAsync($"http://{ip}:{port}/Volume?mute={muteValue}");
            return response.IsSuccessStatusCode ? Ok() : BadRequest();
        }
        catch
        {
            return BadRequest();
        }
    }

    // ==================== Qobuz Playback ====================

    /// <summary>
    /// Play a single Qobuz track by ID (uses native BluOS Qobuz integration)
    /// </summary>
    [HttpPost("player/{ip}/play-qobuz")]
    public async Task<ActionResult> PlayQobuzTrack(string ip, [FromBody] PlayQobuzTrackRequest request, int port = 11000)
    {
        // Use native BluOS Qobuz playback: /Play?service=Qobuz&id=<trackId>
        try
        {
            using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(10) };
            var url = $"http://{ip}:{port}/Play?service=Qobuz&id={request.TrackId}";
            var response = await client.GetAsync(url);
            return response.IsSuccessStatusCode ? Ok() : BadRequest();
        }
        catch
        {
            return BadRequest();
        }
    }

    /// <summary>
    /// Play a Qobuz album (uses native BluOS Qobuz integration)
    /// </summary>
    [HttpPost("player/{ip}/play-qobuz-album")]
    public async Task<ActionResult> PlayQobuzAlbum(string ip, [FromBody] PlayQobuzAlbumRequest request, int port = 11000)
    {
        // Use native BluOS Qobuz playback: /Play?service=Qobuz&album=<albumId>
        try
        {
            using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(10) };
            var url = $"http://{ip}:{port}/Play?service=Qobuz&album={request.AlbumId}";
            if (request.StartTrackIndex > 0)
            {
                url += $"&index={request.StartTrackIndex}";
            }
            var response = await client.GetAsync(url);
            return response.IsSuccessStatusCode ? Ok() : BadRequest();
        }
        catch
        {
            return BadRequest();
        }
    }

    /// <summary>
    /// Play a Qobuz playlist (uses native BluOS Qobuz integration)
    /// </summary>
    [HttpPost("player/{ip}/play-qobuz-playlist")]
    public async Task<ActionResult> PlayQobuzPlaylist(string ip, [FromBody] PlayQobuzPlaylistRequest request, int port = 11000)
    {
        // Use native BluOS Qobuz playback: /Play?service=Qobuz&playlist=<playlistId>
        try
        {
            using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(10) };
            var url = $"http://{ip}:{port}/Play?service=Qobuz&playlist={request.PlaylistId}";
            if (request.StartTrackIndex > 0)
            {
                url += $"&index={request.StartTrackIndex}";
            }
            var response = await client.GetAsync(url);
            return response.IsSuccessStatusCode ? Ok() : BadRequest();
        }
        catch
        {
            return BadRequest();
        }
    }

    // ==================== Queue Management ====================

    /// <summary>
    /// Get current queue/playlist as JSON
    /// </summary>
    [HttpGet("player/{ip}/queue")]
    public async Task<ActionResult> GetQueue(string ip, int port = 11000)
    {
        try
        {
            using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(5) };
            var xmlResponse = await client.GetStringAsync($"http://{ip}:{port}/Playlist");

            // Parse XML and convert to JSON
            var doc = System.Xml.Linq.XDocument.Parse(xmlResponse);
            var songs = doc.Descendants("song").Select((song, index) => new
            {
                index,
                id = (int?)song.Attribute("id") ?? index,
                title = (string?)song.Element("title") ?? "",
                artist = (string?)song.Element("art") ?? "",
                album = (string?)song.Element("alb") ?? "",
                imageUrl = (string?)song.Element("image") ?? "",
                duration = (int?)song.Element("secs") ?? 0,
                service = (string?)song.Element("service") ?? ""
            }).ToList();

            return Ok(songs);
        }
        catch
        {
            return Ok(new List<object>()); // Return empty array on error
        }
    }

    /// <summary>
    /// Add track to queue
    /// </summary>
    [HttpPost("player/{ip}/queue/add")]
    public async Task<ActionResult> AddToQueue(string ip, [FromBody] AddToQueueRequest request, int port = 11000)
    {
        try
        {
            using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(5) };
            var url = $"http://{ip}:{port}/Add?service=Qobuz&id={request.TrackId}";
            if (!string.IsNullOrEmpty(request.AlbumId))
            {
                url += $"&where=nextAlbum&aid={request.AlbumId}";
            }
            var response = await client.GetAsync(url);
            return response.IsSuccessStatusCode ? Ok() : BadRequest();
        }
        catch
        {
            return BadRequest();
        }
    }

    /// <summary>
    /// Clear queue
    /// </summary>
    [HttpPost("player/{ip}/queue/clear")]
    public async Task<ActionResult> ClearQueue(string ip, int port = 11000)
    {
        try
        {
            using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(5) };
            var response = await client.GetAsync($"http://{ip}:{port}/Clear");
            return response.IsSuccessStatusCode ? Ok() : BadRequest();
        }
        catch
        {
            return BadRequest();
        }
    }

    /// <summary>
    /// Play track at specific queue position
    /// </summary>
    [HttpPost("player/{ip}/queue/play")]
    public async Task<ActionResult> PlayQueuePosition(string ip, [FromBody] PlayQueuePositionRequest request, int port = 11000)
    {
        try
        {
            using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(5) };
            var response = await client.GetAsync($"http://{ip}:{port}/Play?id={request.Index}");
            return response.IsSuccessStatusCode ? Ok() : BadRequest();
        }
        catch
        {
            return BadRequest();
        }
    }

    /// <summary>
    /// Remove track from queue
    /// </summary>
    [HttpDelete("player/{ip}/queue/{index}")]
    public async Task<ActionResult> RemoveFromQueue(string ip, int index, int port = 11000)
    {
        try
        {
            using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(5) };
            var response = await client.GetAsync($"http://{ip}:{port}/Delete?id={index}");
            return response.IsSuccessStatusCode ? Ok() : BadRequest();
        }
        catch
        {
            return BadRequest();
        }
    }
}

// ==================== Request DTOs ====================

public record VolumeRequest(int Level);
public record CreateGroupRequest(List<string> SlaveIps);
public record AddToGroupRequest(string SlaveIp);
public record RemoveFromGroupRequest(string SlaveIp);
public record SeekRequest(int Seconds);
public record MuteRequest(bool Mute);
public record PlayQobuzTrackRequest(long TrackId);
public record PlayQobuzAlbumRequest(string AlbumId, int StartTrackIndex = 0);
public record PlayQobuzPlaylistRequest(long PlaylistId, int StartTrackIndex = 0);
public record AddToQueueRequest(long TrackId, string? AlbumId);
public record PlayQueuePositionRequest(int Index);

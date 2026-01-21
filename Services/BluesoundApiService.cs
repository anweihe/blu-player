using System.Xml.Linq;
using BluesoundWeb.Models;

namespace BluesoundWeb.Services;

/// <summary>
/// Service for communicating with Bluesound players via the BluOS API
/// </summary>
public interface IBluesoundApiService
{
    Task<BluesoundPlayer?> GetPlayerStatusAsync(string ipAddress, int port = 11000);
    Task<PlaybackStatus?> GetPlaybackStatusAsync(string ipAddress, int port = 11000);
    Task<bool> RemoveSlaveAsync(string masterIp, int masterPort, string slaveIp);
    Task<bool> LeaveGroupAsync(string slaveIp, int slavePort);
    Task<bool> AddSlaveAsync(string masterIp, int masterPort, string slaveIp);
    Task<bool> SetVolumeAsync(string ipAddress, int port, int volume);
    Task<bool> PlayAsync(string ipAddress, int port);
    Task<bool> PauseAsync(string ipAddress, int port);
    Task<bool> StopAsync(string ipAddress, int port);
    Task<bool> NextTrackAsync(string ipAddress, int port);
    Task<bool> PreviousTrackAsync(string ipAddress, int port);
    Task<bool> PlayUrlAsync(string ipAddress, int port, string streamUrl, string? title = null, string? artist = null, string? album = null, string? imageUrl = null);

    /// <summary>
    /// Play a Qobuz album natively on the player using the built-in Qobuz integration
    /// </summary>
    Task<bool> PlayQobuzAlbumAsync(string ipAddress, int port, string albumId, int? trackIndex = null);

    /// <summary>
    /// Play a Qobuz playlist natively on the player using the built-in Qobuz integration
    /// </summary>
    Task<bool> PlayQobuzPlaylistAsync(string ipAddress, int port, long playlistId, int trackIndex, long trackId);
}

public class BluesoundApiService : IBluesoundApiService
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<BluesoundApiService> _logger;

    public BluesoundApiService(HttpClient httpClient, ILogger<BluesoundApiService> logger)
    {
        _httpClient = httpClient;
        _httpClient.Timeout = TimeSpan.FromSeconds(5);
        _logger = logger;
    }

    public async Task<BluesoundPlayer?> GetPlayerStatusAsync(string ipAddress, int port = 11000)
    {
        try
        {
            var url = $"http://{ipAddress}:{port}/SyncStatus";
            _logger.LogDebug("Fetching SyncStatus from {Url}", url);

            var response = await _httpClient.GetStringAsync(url);
            return ParseSyncStatus(response, ipAddress, port);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to get status from {IpAddress}:{Port}", ipAddress, port);
            return null;
        }
    }

    /// <summary>
    /// Removes a slave player from a group (called on the master)
    /// </summary>
    public async Task<bool> RemoveSlaveAsync(string masterIp, int masterPort, string slaveIp)
    {
        try
        {
            var url = $"http://{masterIp}:{masterPort}/RemoveSlave?slave={slaveIp}&port=11000";
            _logger.LogInformation("Removing slave {SlaveIp} from master {MasterIp}", slaveIp, masterIp);

            var response = await _httpClient.GetAsync(url);
            return response.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to remove slave {SlaveIp} from {MasterIp}", slaveIp, masterIp);
            return false;
        }
    }

    /// <summary>
    /// Makes a slave player leave its current group
    /// </summary>
    public async Task<bool> LeaveGroupAsync(string slaveIp, int slavePort)
    {
        try
        {
            var url = $"http://{slaveIp}:{slavePort}/Leave";
            _logger.LogInformation("Player {SlaveIp} leaving group", slaveIp);

            var response = await _httpClient.GetAsync(url);
            return response.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to leave group for {SlaveIp}", slaveIp);
            return false;
        }
    }

    /// <summary>
    /// Adds a slave player to a group (called on the master)
    /// </summary>
    public async Task<bool> AddSlaveAsync(string masterIp, int masterPort, string slaveIp)
    {
        try
        {
            var url = $"http://{masterIp}:{masterPort}/AddSlave?slave={slaveIp}&port=11000";
            _logger.LogInformation("Adding slave {SlaveIp} to master {MasterIp}:{MasterPort}", slaveIp, masterIp, masterPort);

            var response = await _httpClient.GetAsync(url);
            return response.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to add slave {SlaveIp} to {MasterIp}", slaveIp, masterIp);
            return false;
        }
    }

    /// <summary>
    /// Sets the volume of a player (0-100)
    /// </summary>
    public async Task<bool> SetVolumeAsync(string ipAddress, int port, int volume)
    {
        try
        {
            // Clamp volume to valid range
            volume = Math.Max(0, Math.Min(100, volume));
            var url = $"http://{ipAddress}:{port}/Volume?level={volume}";
            _logger.LogInformation("Setting volume to {Volume} on {IpAddress}:{Port}", volume, ipAddress, port);

            var response = await _httpClient.GetAsync(url);
            return response.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to set volume on {IpAddress}", ipAddress);
            return false;
        }
    }

    /// <summary>
    /// Gets the current playback status from a player
    /// </summary>
    public async Task<PlaybackStatus?> GetPlaybackStatusAsync(string ipAddress, int port = 11000)
    {
        try
        {
            var url = $"http://{ipAddress}:{port}/Status";
            _logger.LogDebug("Fetching Status from {Url}", url);

            var response = await _httpClient.GetStringAsync(url);
            return ParsePlaybackStatus(response);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to get playback status from {IpAddress}:{Port}", ipAddress, port);
            return null;
        }
    }

    /// <summary>
    /// Starts playback on a player
    /// </summary>
    public async Task<bool> PlayAsync(string ipAddress, int port)
    {
        try
        {
            var url = $"http://{ipAddress}:{port}/Play";
            _logger.LogInformation("Starting playback on {IpAddress}:{Port}", ipAddress, port);

            var response = await _httpClient.GetAsync(url);
            return response.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to start playback on {IpAddress}", ipAddress);
            return false;
        }
    }

    /// <summary>
    /// Pauses playback on a player
    /// </summary>
    public async Task<bool> PauseAsync(string ipAddress, int port)
    {
        try
        {
            var url = $"http://{ipAddress}:{port}/Pause";
            _logger.LogInformation("Pausing playback on {IpAddress}:{Port}", ipAddress, port);

            var response = await _httpClient.GetAsync(url);
            return response.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to pause playback on {IpAddress}", ipAddress);
            return false;
        }
    }

    /// <summary>
    /// Stops playback on a player
    /// </summary>
    public async Task<bool> StopAsync(string ipAddress, int port)
    {
        try
        {
            var url = $"http://{ipAddress}:{port}/Stop";
            _logger.LogInformation("Stopping playback on {IpAddress}:{Port}", ipAddress, port);

            var response = await _httpClient.GetAsync(url);
            return response.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to stop playback on {IpAddress}", ipAddress);
            return false;
        }
    }

    /// <summary>
    /// Skips to the next track
    /// </summary>
    public async Task<bool> NextTrackAsync(string ipAddress, int port)
    {
        try
        {
            var url = $"http://{ipAddress}:{port}/Skip";
            _logger.LogInformation("Skipping to next track on {IpAddress}:{Port}", ipAddress, port);

            var response = await _httpClient.GetAsync(url);
            return response.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to skip track on {IpAddress}", ipAddress);
            return false;
        }
    }

    /// <summary>
    /// Goes to the previous track
    /// </summary>
    public async Task<bool> PreviousTrackAsync(string ipAddress, int port)
    {
        try
        {
            var url = $"http://{ipAddress}:{port}/Back";
            _logger.LogInformation("Going to previous track on {IpAddress}:{Port}", ipAddress, port);

            var response = await _httpClient.GetAsync(url);
            return response.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to go to previous track on {IpAddress}", ipAddress);
            return false;
        }
    }

    /// <summary>
    /// Plays a URL on the player (e.g., a Qobuz stream URL)
    /// </summary>
    public async Task<bool> PlayUrlAsync(string ipAddress, int port, string streamUrl, string? title = null, string? artist = null, string? album = null, string? imageUrl = null)
    {
        try
        {
            // Build the URL with query parameters
            var queryParams = new List<string>
            {
                $"url={Uri.EscapeDataString(streamUrl)}"
            };

            if (!string.IsNullOrEmpty(title))
                queryParams.Add($"title1={Uri.EscapeDataString(title)}");
            if (!string.IsNullOrEmpty(artist))
                queryParams.Add($"title2={Uri.EscapeDataString(artist)}");
            if (!string.IsNullOrEmpty(album))
                queryParams.Add($"title3={Uri.EscapeDataString(album)}");
            if (!string.IsNullOrEmpty(imageUrl))
                queryParams.Add($"image={Uri.EscapeDataString(imageUrl)}");

            var url = $"http://{ipAddress}:{port}/Play?{string.Join("&", queryParams)}";
            _logger.LogInformation("Playing URL on {IpAddress}:{Port}: {Title} by {Artist}", ipAddress, port, title ?? "Unknown", artist ?? "Unknown");

            var response = await _httpClient.GetAsync(url);

            if (!response.IsSuccessStatusCode)
            {
                var content = await response.Content.ReadAsStringAsync();
                _logger.LogWarning("Failed to play URL on {IpAddress}:{Port}. Status: {Status}, Response: {Response}",
                    ipAddress, port, response.StatusCode, content);
            }

            return response.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to play URL on {IpAddress}:{Port}", ipAddress, port);
            return false;
        }
    }

    /// <summary>
    /// Plays a Qobuz album natively using the BluOS built-in Qobuz integration.
    /// The player manages the queue itself - no browser polling needed.
    /// </summary>
    public async Task<bool> PlayQobuzAlbumAsync(string ipAddress, int port, string albumId, int? trackIndex = null)
    {
        try
        {
            // Build the native BluOS Qobuz URL
            // Format: /Add?playnow=1&service=Qobuz&albumid={ALBUM_ID}
            // With trackindex: /Add?playnow=1&service=Qobuz&albumid={ALBUM_ID}&trackindex={INDEX}
            var queryParams = new List<string>
            {
                "playnow=1",
                "service=Qobuz",
                $"albumid={Uri.EscapeDataString(albumId)}"
            };

            if (trackIndex.HasValue)
            {
                queryParams.Add($"trackindex={trackIndex.Value}");
            }

            var url = $"http://{ipAddress}:{port}/Add?{string.Join("&", queryParams)}";
            _logger.LogInformation("Playing Qobuz album {AlbumId} natively on {IpAddress}:{Port} (trackIndex: {TrackIndex})",
                albumId, ipAddress, port, trackIndex);

            var request = new HttpRequestMessage(HttpMethod.Get, url);
            // Add headers that the native app uses
            request.Headers.Add("x-sovi-ui-schema-version", "6");
            request.Headers.Add("x-sovi-schema-version", "34");

            var response = await _httpClient.SendAsync(request);

            if (!response.IsSuccessStatusCode)
            {
                var content = await response.Content.ReadAsStringAsync();
                _logger.LogWarning("Failed to play Qobuz album on {IpAddress}:{Port}. Status: {Status}, Response: {Response}",
                    ipAddress, port, response.StatusCode, content);
            }
            else
            {
                _logger.LogInformation("Successfully started Qobuz album {AlbumId} on {IpAddress}", albumId, ipAddress);
            }

            return response.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to play Qobuz album {AlbumId} on {IpAddress}:{Port}", albumId, ipAddress, port);
            return false;
        }
    }

    /// <summary>
    /// Plays a Qobuz playlist natively using the BluOS built-in Qobuz integration.
    /// The player manages the queue itself - no browser polling needed.
    /// </summary>
    public async Task<bool> PlayQobuzPlaylistAsync(string ipAddress, int port, long playlistId, int trackIndex, long trackId)
    {
        try
        {
            // Build the native BluOS Qobuz URL for playlist playback
            // Format: /Add?playnow=1&service=Qobuz&playlistid={PLAYLIST_ID}&listindex={INDEX}&file=Qobuz:{TRACK_ID}
            var queryParams = new List<string>
            {
                "playnow=1",
                "service=Qobuz",
                $"playlistid={playlistId}",
                $"listindex={trackIndex}",
                $"file=Qobuz:{trackId}",
                "cursor=last",
                "nextlist=1",
                "where=last"
            };

            var url = $"http://{ipAddress}:{port}/Add?{string.Join("&", queryParams)}";
            _logger.LogInformation("Playing Qobuz playlist {PlaylistId} track {TrackId} (index {TrackIndex}) natively on {IpAddress}:{Port}",
                playlistId, trackId, trackIndex, ipAddress, port);

            var request = new HttpRequestMessage(HttpMethod.Get, url);
            // Add headers that the native app uses
            request.Headers.Add("x-sovi-ui-schema-version", "6");
            request.Headers.Add("x-sovi-schema-version", "34");

            var response = await _httpClient.SendAsync(request);

            if (!response.IsSuccessStatusCode)
            {
                var content = await response.Content.ReadAsStringAsync();
                _logger.LogWarning("Failed to play Qobuz playlist on {IpAddress}:{Port}. Status: {Status}, Response: {Response}",
                    ipAddress, port, response.StatusCode, content);
            }
            else
            {
                _logger.LogInformation("Successfully started Qobuz playlist {PlaylistId} on {IpAddress}", playlistId, ipAddress);
            }

            return response.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to play Qobuz playlist {PlaylistId} on {IpAddress}:{Port}", playlistId, ipAddress, port);
            return false;
        }
    }

    private PlaybackStatus? ParsePlaybackStatus(string xml)
    {
        try
        {
            var doc = XDocument.Parse(xml);
            var status = doc.Element("status");

            if (status == null)
                return null;

            var playbackStatus = new PlaybackStatus
            {
                State = status.Element("state")?.Value ?? "stop",
                Title = status.Element("title1")?.Value,
                Artist = status.Element("title2")?.Value,
                Album = status.Element("title3")?.Value,
                Service = status.Element("service")?.Value,
                StreamUrl = status.Element("streamUrl")?.Value
            };

            // Parse image URL
            var image = status.Element("image")?.Value;
            if (!string.IsNullOrEmpty(image))
            {
                playbackStatus.ImageUrl = image;
            }

            // Parse duration/position
            if (int.TryParse(status.Element("totlen")?.Value, out var totalLen))
            {
                playbackStatus.TotalSeconds = totalLen;
            }
            if (int.TryParse(status.Element("secs")?.Value, out var secs))
            {
                playbackStatus.CurrentSeconds = secs;
            }

            _logger.LogDebug("Parsed playback status: State={State}, Title={Title}, Artist={Artist}",
                playbackStatus.State, playbackStatus.Title, playbackStatus.Artist);

            return playbackStatus;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to parse Status XML");
            return null;
        }
    }

    private BluesoundPlayer? ParseSyncStatus(string xml, string ipAddress, int port)
    {
        try
        {
            var doc = XDocument.Parse(xml);
            var syncStatus = doc.Element("SyncStatus");

            if (syncStatus == null)
                return null;

            var volumeValue = int.TryParse(syncStatus.Attribute("volume")?.Value, out var vol) ? vol : 0;
            var isFixedVolume = volumeValue < 0; // volume=-1 indicates Fixed Volume

            var player = new BluesoundPlayer
            {
                Id = syncStatus.Attribute("id")?.Value ?? $"{ipAddress}:{port}",
                Name = syncStatus.Attribute("name")?.Value ?? "Unknown",
                IpAddress = ipAddress,
                Port = port,
                ModelName = syncStatus.Attribute("modelName")?.Value ?? "",
                Model = syncStatus.Attribute("model")?.Value ?? "",
                Brand = syncStatus.Attribute("brand")?.Value ?? "Bluesound",
                MacAddress = syncStatus.Attribute("mac")?.Value ?? "",
                Volume = isFixedVolume ? 0 : volumeValue,
                IsFixedVolume = isFixedVolume,
                GroupName = syncStatus.Attribute("group")?.Value
            };

            // Check for master element (indicates this player is a slave in a group)
            var masterElement = syncStatus.Element("master");
            if (masterElement != null)
            {
                var masterIp = masterElement.Value;
                var masterPort = masterElement.Attribute("port")?.Value ?? "11000";
                player.MasterIp = $"{masterIp}:{masterPort}";
                player.IsGrouped = true;
                // This player is a slave (master IP is different from this player's IP)
                player.IsMaster = false;
            }

            // Check for slave elements (indicates this player is a master)
            var slaveElements = syncStatus.Elements("slave");
            foreach (var slave in slaveElements)
            {
                var slaveIp = slave.Attribute("id")?.Value;
                var slavePort = slave.Attribute("port")?.Value ?? "11000";
                if (!string.IsNullOrEmpty(slaveIp))
                {
                    player.SlaveIps.Add($"{slaveIp}:{slavePort}");
                }
            }

            if (player.SlaveIps.Count > 0)
            {
                player.IsGrouped = true;
                player.IsMaster = true;
            }

            // Check for stereo pair - channelMode attribute on the SyncStatus element
            var channelMode = syncStatus.Attribute("channelMode")?.Value;
            if (!string.IsNullOrEmpty(channelMode))
            {
                player.IsStereoPaired = true;
                player.ChannelMode = channelMode;
            }

            // Check if this is a secondary speaker of a stereo pair
            // Secondary speakers have: pairSlaveOnly="true" or managedZoneSlave="true"
            // NOT modelName="Stereo Pair" - that's actually the PRIMARY/controller of the stereo pair!
            var pairSlaveOnly = syncStatus.Attribute("pairSlaveOnly")?.Value;
            var managedZoneSlave = syncStatus.Attribute("managedZoneSlave")?.Value;

            if (pairSlaveOnly == "true" || managedZoneSlave == "true")
            {
                player.IsSecondaryStereoPairSpeaker = true;
                _logger.LogInformation("Player {Name} is secondary stereo pair speaker (pairSlaveOnly={PairSlaveOnly}, managedZoneSlave={ManagedZoneSlave})",
                    player.Name, pairSlaveOnly, managedZoneSlave);
            }

            _logger.LogInformation("Parsed player: {Name}, IP: {IP}, IsMaster: {IsMaster}, IsGrouped: {IsGrouped}, MasterIp: {MasterIp}, SlaveCount: {SlaveCount}, IsStereoPaired: {IsStereoPaired}, IsSecondary: {IsSecondary}",
                player.Name, player.IpAddress, player.IsMaster, player.IsGrouped, player.MasterIp, player.SlaveIps.Count, player.IsStereoPaired, player.IsSecondaryStereoPairSpeaker);

            return player;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to parse SyncStatus XML");
            return null;
        }
    }
}

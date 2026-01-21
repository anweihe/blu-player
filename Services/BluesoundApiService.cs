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
    Task<bool> PlayQobuzAlbumAsync(string ipAddress, int port, string albumId, int trackIndex, long trackId);

    /// <summary>
    /// Play a Qobuz playlist natively on the player using the built-in Qobuz integration
    /// </summary>
    Task<bool> PlayQobuzPlaylistAsync(string ipAddress, int port, long playlistId, int trackIndex, long trackId);

    /// <summary>
    /// Get the current Qobuz streaming quality setting from the player
    /// </summary>
    /// <returns>Quality string: "MP3", "CD", "HD", or "UHD"</returns>
    Task<string?> GetQobuzQualityAsync(string ipAddress);

    /// <summary>
    /// Set the Qobuz streaming quality on the player
    /// </summary>
    /// <param name="quality">Quality string: "MP3", "CD", "HD", or "UHD"</param>
    Task<bool> SetQobuzQualityAsync(string ipAddress, string quality);

    /// <summary>
    /// Get the TuneIn main menu from the player
    /// </summary>
    Task<string?> GetTuneInMenuXmlAsync(string ipAddress, int port = 11000);

    /// <summary>
    /// Browse a TuneIn category or subcategory
    /// </summary>
    Task<string?> BrowseTuneInAsync(string ipAddress, int port, string uri);

    /// <summary>
    /// Play a TuneIn station on the player
    /// </summary>
    Task<bool> PlayTuneInStationAsync(string ipAddress, int port, string playUrl, string? title = null, string? imageUrl = null);

    /// <summary>
    /// Get the Radio Paradise menu from the player
    /// </summary>
    Task<string?> GetRadioParadiseMenuXmlAsync(string ipAddress, int port = 11000);

    /// <summary>
    /// Play a Radio Paradise station on the player
    /// </summary>
    Task<bool> PlayRadioParadiseStationAsync(string ipAddress, int port, string playUrl, string? title = null, string? imageUrl = null);
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
            var status = ParsePlaybackStatus(response);

            // Convert relative image URL to absolute URL pointing to the Bluesound player
            if (status != null && !string.IsNullOrEmpty(status.ImageUrl) && status.ImageUrl.StartsWith("/"))
            {
                status.ImageUrl = $"http://{ipAddress}:{port}{status.ImageUrl}";
            }

            return status;
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
    /// Uses /ui/prf endpoint format for proper queue auto-fill.
    /// </summary>
    public async Task<bool> PlayQobuzAlbumAsync(string ipAddress, int port, string albumId, int trackIndex, long trackId)
    {
        try
        {
            // Build the native BluOS Qobuz URL using /ui/prf format
            // Format: /ui/prf?a={encoded_params}&t=1&u={encoded_add_url}

            // 'a' parameter: album context and playback settings
            // Order: albumid, cursor, listindex, nextlist, playnow, service, where, withArtists
            var aParams = $"albumid={albumId}&cursor=last&listindex={trackIndex}&nextlist=1&playnow=1&service=Qobuz&where=last&withArtists=1";

            // 'u' parameter: the Add command with specific track
            var uParam = $"/Add?playnow=1&file=Qobuz:{trackId}";

            var url = $"http://{ipAddress}:{port}/ui/prf?a={Uri.EscapeDataString(aParams)}&t=1&u={Uri.EscapeDataString(uParam)}";

            _logger.LogInformation("Playing Qobuz album {AlbumId} track {TrackId} (index {TrackIndex}) natively on {IpAddress}:{Port}",
                albumId, trackId, trackIndex, ipAddress, port);

            var request = new HttpRequestMessage(HttpMethod.Get, url);
            // Add headers that the native app uses
            request.Headers.Add("x-sovi-ui-schema-version", "6");
            request.Headers.Add("x-sovi-schema-version", "34");
            request.Headers.Add("x-sovi-ui-autofill", "1"); // Auto-fill queue with album tracks

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
    /// Uses /ui/prf endpoint format for proper queue auto-fill.
    /// </summary>
    public async Task<bool> PlayQobuzPlaylistAsync(string ipAddress, int port, long playlistId, int trackIndex, long trackId)
    {
        try
        {
            // Build the native BluOS Qobuz URL using /ui/prf format
            // Format: /ui/prf?a={encoded_params}&t=1&u={encoded_add_url}

            // 'a' parameter: playlist context and playback settings
            // Order: cursor, listindex, nextlist, playlistid, playnow, service, where
            var aParams = $"cursor=last&listindex={trackIndex}&nextlist=1&playlistid={playlistId}&playnow=1&service=Qobuz&where=last";

            // 'u' parameter: the Add command with specific track
            var uParam = $"/Add?playnow=1&file=Qobuz:{trackId}";

            var url = $"http://{ipAddress}:{port}/ui/prf?a={Uri.EscapeDataString(aParams)}&t=1&u={Uri.EscapeDataString(uParam)}";

            _logger.LogInformation("Playing Qobuz playlist {PlaylistId} track {TrackId} (index {TrackIndex}) natively on {IpAddress}:{Port}",
                playlistId, trackId, trackIndex, ipAddress, port);

            var request = new HttpRequestMessage(HttpMethod.Get, url);
            // Add headers that the native app uses
            request.Headers.Add("x-sovi-ui-schema-version", "6");
            request.Headers.Add("x-sovi-schema-version", "34");
            request.Headers.Add("x-sovi-ui-autofill", "1"); // Auto-fill queue with playlist tracks

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

    /// <summary>
    /// Get the current Qobuz streaming quality setting from the player.
    /// Parses HTML response from /credentials endpoint.
    /// </summary>
    public async Task<string?> GetQobuzQualityAsync(string ipAddress)
    {
        try
        {
            var url = $"http://{ipAddress}/credentials?service=Qobuz&noheader=1&schemaVersion=35";
            _logger.LogDebug("Fetching Qobuz quality from {Url}", url);

            var response = await _httpClient.GetStringAsync(url);

            // Parse HTML to find the checked radio button with name="quality"
            // The HTML contains radio buttons like: <input type="radio" name="quality" value="CD" checked>
            // We need to find which one has the "checked" attribute
            var qualityValues = new[] { "MP3", "CD", "HD", "UHD" };

            foreach (var quality in qualityValues)
            {
                // Look for patterns like: value="CD" checked or value="CD"  checked
                // The checked attribute can appear after the value
                var pattern1 = $"name=\"quality\"[^>]*value=\"{quality}\"[^>]*checked";
                var pattern2 = $"value=\"{quality}\"[^>]*name=\"quality\"[^>]*checked";

                if (System.Text.RegularExpressions.Regex.IsMatch(response, pattern1, System.Text.RegularExpressions.RegexOptions.IgnoreCase) ||
                    System.Text.RegularExpressions.Regex.IsMatch(response, pattern2, System.Text.RegularExpressions.RegexOptions.IgnoreCase))
                {
                    _logger.LogInformation("Qobuz quality on {IpAddress}: {Quality}", ipAddress, quality);
                    return quality;
                }
            }

            _logger.LogWarning("Could not find Qobuz quality setting in response from {IpAddress}", ipAddress);
            return null;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to get Qobuz quality from {IpAddress}", ipAddress);
            return null;
        }
    }

    /// <summary>
    /// Set the Qobuz streaming quality on the player.
    /// Posts form data to /credentials endpoint.
    /// </summary>
    public async Task<bool> SetQobuzQualityAsync(string ipAddress, string quality)
    {
        try
        {
            var url = $"http://{ipAddress}/credentials";
            _logger.LogInformation("Setting Qobuz quality to {Quality} on {IpAddress}", quality, ipAddress);

            var content = new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["service"] = "Qobuz",
                ["quality"] = quality,
                ["update"] = "Aktualisieren"
            });

            // Disable automatic redirect following to check the Location header
            using var handler = new HttpClientHandler { AllowAutoRedirect = false };
            using var client = new HttpClient(handler) { Timeout = TimeSpan.FromSeconds(5) };

            var response = await client.PostAsync(url, content);

            // Check for 303 See Other with message=Updated in Location header
            if (response.StatusCode == System.Net.HttpStatusCode.RedirectMethod ||
                response.StatusCode == System.Net.HttpStatusCode.Redirect)
            {
                var location = response.Headers.Location?.ToString() ?? "";
                var success = location.Contains("message=Updated");
                _logger.LogInformation("Qobuz quality set result: {Success} (Location: {Location})", success, location);
                return success;
            }

            // Also accept 200 OK as success
            if (response.IsSuccessStatusCode)
            {
                _logger.LogInformation("Qobuz quality set successfully on {IpAddress}", ipAddress);
                return true;
            }

            _logger.LogWarning("Unexpected response when setting Qobuz quality: {StatusCode}", response.StatusCode);
            return false;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to set Qobuz quality on {IpAddress}", ipAddress);
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

    /// <summary>
    /// Get the TuneIn main menu from the player's built-in TuneIn integration
    /// </summary>
    public async Task<string?> GetTuneInMenuXmlAsync(string ipAddress, int port = 11000)
    {
        try
        {
            var url = $"http://{ipAddress}:{port}/ui/browseMenuGroup?service=TuneIn";
            _logger.LogDebug("Fetching TuneIn menu from {Url}", url);

            var response = await _httpClient.GetStringAsync(url);
            return response;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to get TuneIn menu from {IpAddress}:{Port}", ipAddress, port);
            return null;
        }
    }

    /// <summary>
    /// Browse a TuneIn category or subcategory by following the action URI
    /// </summary>
    public async Task<string?> BrowseTuneInAsync(string ipAddress, int port, string uri)
    {
        try
        {
            // The uri should already include the path like /ui/browse?...
            var url = $"http://{ipAddress}:{port}{uri}";
            _logger.LogDebug("Browsing TuneIn at {Url}", url);

            var response = await _httpClient.GetStringAsync(url);
            return response;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to browse TuneIn at {Uri} on {IpAddress}:{Port}", uri, ipAddress, port);
            return null;
        }
    }

    /// <summary>
    /// Play a TuneIn station on the player.
    /// The playUrl can be either:
    /// - A TuneIn station URL (e.g., "TuneIn:s309526") which will be wrapped in /Play?url=
    /// - A direct player URI from player-link action (e.g., "/Play?url=TuneIn%3As309526&...")
    /// </summary>
    public async Task<bool> PlayTuneInStationAsync(string ipAddress, int port, string playUrl, string? title = null, string? imageUrl = null)
    {
        try
        {
            string url;

            // Check if playUrl is already a complete player URI (from player-link action)
            if (playUrl.StartsWith("/Play?") || playUrl.StartsWith("/Play"))
            {
                // Direct player URI - just call it on the player
                url = $"http://{ipAddress}:{port}{playUrl}";
                _logger.LogInformation("Playing TuneIn via direct URI on {IpAddress}:{Port}: {Uri}", ipAddress, port, playUrl);
            }
            else
            {
                // Build the play URL with optional metadata
                var queryParams = new List<string>
                {
                    $"url={Uri.EscapeDataString(playUrl)}"
                };

                if (!string.IsNullOrEmpty(title))
                    queryParams.Add($"title1={Uri.EscapeDataString(title)}");
                if (!string.IsNullOrEmpty(imageUrl))
                    queryParams.Add($"image={Uri.EscapeDataString(imageUrl)}");

                url = $"http://{ipAddress}:{port}/Play?{string.Join("&", queryParams)}";
                _logger.LogInformation("Playing TuneIn station on {IpAddress}:{Port}: {Title}", ipAddress, port, title ?? playUrl);
            }

            var response = await _httpClient.GetAsync(url);
            return response.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to play TuneIn station on {IpAddress}:{Port}", ipAddress, port);
            return false;
        }
    }

    /// <summary>
    /// Get the Radio Paradise menu from the player's built-in Radio Paradise integration
    /// </summary>
    public async Task<string?> GetRadioParadiseMenuXmlAsync(string ipAddress, int port = 11000)
    {
        try
        {
            var url = $"http://{ipAddress}:{port}/ui/browseMenuGroup?service=RadioParadise";
            _logger.LogDebug("Fetching Radio Paradise menu from {Url}", url);

            var response = await _httpClient.GetStringAsync(url);
            return response;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to get Radio Paradise menu from {IpAddress}:{Port}", ipAddress, port);
            return null;
        }
    }

    /// <summary>
    /// Play a Radio Paradise station on the player.
    /// The playUrl can be either:
    /// - A Radio Paradise station URL (e.g., "RadioParadise:0:20") which will be wrapped in /Play?url=
    /// - A direct player URI from player-link action (e.g., "/Play?url=RadioParadise%3A0%3A20&...")
    /// </summary>
    public async Task<bool> PlayRadioParadiseStationAsync(string ipAddress, int port, string playUrl, string? title = null, string? imageUrl = null)
    {
        try
        {
            string url;

            // Check if playUrl is already a complete player URI (from player-link action)
            if (playUrl.StartsWith("/Play?") || playUrl.StartsWith("/Play"))
            {
                // Direct player URI - just call it on the player
                url = $"http://{ipAddress}:{port}{playUrl}";
                _logger.LogInformation("Playing Radio Paradise via direct URI on {IpAddress}:{Port}: {Uri}", ipAddress, port, playUrl);
            }
            else
            {
                // Build the play URL with optional metadata
                var queryParams = new List<string>
                {
                    $"url={Uri.EscapeDataString(playUrl)}"
                };

                if (!string.IsNullOrEmpty(title))
                    queryParams.Add($"title1={Uri.EscapeDataString(title)}");
                if (!string.IsNullOrEmpty(imageUrl))
                    queryParams.Add($"image={Uri.EscapeDataString(imageUrl)}");

                url = $"http://{ipAddress}:{port}/Play?{string.Join("&", queryParams)}";
                _logger.LogInformation("Playing Radio Paradise station on {IpAddress}:{Port}: {Title}", ipAddress, port, title ?? playUrl);
            }

            var response = await _httpClient.GetAsync(url);
            return response.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to play Radio Paradise station on {IpAddress}:{Port}", ipAddress, port);
            return false;
        }
    }
}

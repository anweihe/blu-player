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

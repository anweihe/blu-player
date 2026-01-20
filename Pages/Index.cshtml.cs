using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using BluesoundWeb.Models;
using BluesoundWeb.Services;

namespace BluesoundWeb.Pages;

public class IndexModel : PageModel
{
    private readonly IPlayerDiscoveryService _discoveryService;
    private readonly IBluesoundApiService _apiService;
    private readonly IPlayerCacheService _playerCache;
    private readonly ILogger<IndexModel> _logger;

    public IndexModel(
        IPlayerDiscoveryService discoveryService,
        IBluesoundApiService apiService,
        IPlayerCacheService playerCache,
        ILogger<IndexModel> logger)
    {
        _discoveryService = discoveryService;
        _apiService = apiService;
        _playerCache = playerCache;
        _logger = logger;
    }

    public List<PlayerGroup> PlayerGroups { get; set; } = new();
    public string? ErrorMessage { get; set; }
    public string? SuccessMessage { get; set; }

    public async Task OnGetAsync()
    {
        // Full discovery on first load
        await DiscoverAndGroupPlayersAsync();
    }

    public async Task<IActionResult> OnPostRefreshAsync()
    {
        // Full discovery on manual refresh
        await DiscoverAndGroupPlayersAsync();
        return Page();
    }

    public async Task<IActionResult> OnPostUngroupAsync(string masterIp, int masterPort, string slaveIp)
    {
        _logger.LogInformation("Ungrouping slave {SlaveIp} from master {MasterIp}:{MasterPort}",
            slaveIp, masterIp, masterPort);

        var success = await _apiService.RemoveSlaveAsync(masterIp, masterPort, slaveIp);

        if (success)
        {
            SuccessMessage = $"Player wurde erfolgreich aus der Gruppe entfernt.";
        }
        else
        {
            ErrorMessage = "Fehler beim Entfernen des Players aus der Gruppe.";
        }

        // Quick refresh of known players
        await Task.Delay(300);
        await RefreshKnownPlayersAsync();

        return Page();
    }

    public async Task<IActionResult> OnPostLeaveGroupAsync(string playerIp, int playerPort)
    {
        _logger.LogInformation("Player {PlayerIp}:{PlayerPort} leaving group", playerIp, playerPort);

        var success = await _apiService.LeaveGroupAsync(playerIp, playerPort);

        if (success)
        {
            SuccessMessage = "Player hat die Gruppe verlassen.";
        }
        else
        {
            ErrorMessage = "Fehler beim Verlassen der Gruppe.";
        }

        await Task.Delay(300);
        await RefreshKnownPlayersAsync();

        return Page();
    }

    public async Task<IActionResult> OnPostDissolveGroupAsync(string masterIp, int masterPort, string slaveIps)
    {
        _logger.LogInformation("Dissolving group from master {MasterIp}:{MasterPort}", masterIp, masterPort);

        var slaves = slaveIps.Split(',', StringSplitOptions.RemoveEmptyEntries);
        var allSuccess = true;

        foreach (var slaveIp in slaves)
        {
            var success = await _apiService.RemoveSlaveAsync(masterIp, masterPort, slaveIp.Trim());
            if (!success)
            {
                allSuccess = false;
            }
            await Task.Delay(100);
        }

        if (allSuccess)
        {
            SuccessMessage = "Gruppe wurde aufgelöst.";
        }
        else
        {
            ErrorMessage = "Einige Player konnten nicht aus der Gruppe entfernt werden.";
        }

        // Wait for players to update, then quick refresh
        await Task.Delay(500);
        await RefreshKnownPlayersAsync();

        return Page();
    }

    public async Task<IActionResult> OnPostAddToGroupAsync(string masterIp, int masterPort, string slaveIp)
    {
        _logger.LogInformation("Adding {SlaveIp} to group with master {MasterIp}:{MasterPort}", slaveIp, masterIp, masterPort);

        var success = await _apiService.AddSlaveAsync(masterIp, masterPort, slaveIp);

        if (success)
        {
            SuccessMessage = "Player wurde zur Gruppe hinzugefügt.";
        }
        else
        {
            ErrorMessage = "Fehler beim Hinzufügen des Players zur Gruppe.";
        }

        await Task.Delay(300);
        await RefreshKnownPlayersAsync();

        return Page();
    }

    public async Task<IActionResult> OnPostVolumeAsync(string playerIp, int playerPort, int volume)
    {
        _logger.LogInformation("Setting volume to {Volume} on {PlayerIp}:{PlayerPort}", volume, playerIp, playerPort);

        await _apiService.SetVolumeAsync(playerIp, playerPort, volume);

        // Return JSON with new volume for AJAX requests
        if (Request.Headers["X-Requested-With"] == "XMLHttpRequest")
        {
            var player = await _apiService.GetPlayerStatusAsync(playerIp, playerPort);
            return new JsonResult(new { success = true, volume = player?.Volume ?? volume });
        }

        await RefreshKnownPlayersAsync();
        return Page();
    }

    public async Task<IActionResult> OnGetPlaybackStatusAsync(string playerIp, int playerPort)
    {
        var status = await _apiService.GetPlaybackStatusAsync(playerIp, playerPort);
        if (status == null)
        {
            return new JsonResult(new { success = false, error = "Could not get playback status" });
        }

        return new JsonResult(new
        {
            success = true,
            state = status.State,
            isPlaying = status.IsPlaying,
            isPaused = status.IsPaused,
            title = status.Title,
            artist = status.Artist,
            album = status.Album,
            imageUrl = status.ImageUrl,
            service = status.Service,
            totalSeconds = status.TotalSeconds,
            currentSeconds = status.CurrentSeconds,
            formattedDuration = status.FormattedDuration,
            formattedPosition = status.FormattedPosition,
            progressPercent = status.ProgressPercent
        });
    }

    public async Task<IActionResult> OnPostPlayAsync(string playerIp, int playerPort)
    {
        _logger.LogInformation("Play on {PlayerIp}:{PlayerPort}", playerIp, playerPort);
        var success = await _apiService.PlayAsync(playerIp, playerPort);
        return new JsonResult(new { success });
    }

    public async Task<IActionResult> OnPostPauseAsync(string playerIp, int playerPort)
    {
        _logger.LogInformation("Pause on {PlayerIp}:{PlayerPort}", playerIp, playerPort);
        var success = await _apiService.PauseAsync(playerIp, playerPort);
        return new JsonResult(new { success });
    }

    public async Task<IActionResult> OnPostStopAsync(string playerIp, int playerPort)
    {
        _logger.LogInformation("Stop on {PlayerIp}:{PlayerPort}", playerIp, playerPort);
        var success = await _apiService.StopAsync(playerIp, playerPort);
        return new JsonResult(new { success });
    }

    public async Task<IActionResult> OnPostNextTrackAsync(string playerIp, int playerPort)
    {
        _logger.LogInformation("Next track on {PlayerIp}:{PlayerPort}", playerIp, playerPort);
        var success = await _apiService.NextTrackAsync(playerIp, playerPort);
        return new JsonResult(new { success });
    }

    public async Task<IActionResult> OnPostPreviousTrackAsync(string playerIp, int playerPort)
    {
        _logger.LogInformation("Previous track on {PlayerIp}:{PlayerPort}", playerIp, playerPort);
        var success = await _apiService.PreviousTrackAsync(playerIp, playerPort);
        return new JsonResult(new { success });
    }

    /// <summary>
    /// Full mDNS discovery - used on first load and manual refresh
    /// </summary>
    private async Task DiscoverAndGroupPlayersAsync()
    {
        try
        {
            _logger.LogInformation("Starting full mDNS player discovery...");

            var players = await _discoveryService.DiscoverPlayersAsync(TimeSpan.FromSeconds(3));

            _logger.LogInformation("Discovery complete. Found {Count} players.", players.Count);

            // Cache the discovered players in the shared cache
            _playerCache.SetCachedPlayers(players);

            PlayerGroups = OrganizeIntoGroups(players);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during player discovery");
            ErrorMessage = $"Fehler bei der Suche nach Playern: {ex.Message}";
        }
    }

    /// <summary>
    /// Quick refresh - only queries known players directly without mDNS discovery
    /// </summary>
    private async Task RefreshKnownPlayersAsync()
    {
        var cachedPlayers = _playerCache.GetCachedPlayers();

        if (cachedPlayers.Count == 0)
        {
            _logger.LogWarning("No known players cached, falling back to full discovery");
            await DiscoverAndGroupPlayersAsync();
            return;
        }

        var playersToQuery = cachedPlayers.Select(p => (p.IpAddress, p.Port)).ToList();

        try
        {
            _logger.LogInformation("Quick refresh of {Count} known players...", playersToQuery.Count);

            // Query all known players in parallel
            var tasks = playersToQuery.Select(p => _apiService.GetPlayerStatusAsync(p.IpAddress, p.Port));
            var results = await Task.WhenAll(tasks);

            var players = results.Where(p => p != null).Cast<BluesoundPlayer>().ToList();

            _logger.LogInformation("Quick refresh complete. Got status from {Count} players.", players.Count);

            // Update the shared cache
            _playerCache.SetCachedPlayers(players);

            PlayerGroups = OrganizeIntoGroups(players);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during quick refresh, falling back to discovery");
            await DiscoverAndGroupPlayersAsync();
        }
    }

    private List<PlayerGroup> OrganizeIntoGroups(List<BluesoundPlayer> players)
    {
        var groups = new List<PlayerGroup>();
        var processedIds = new HashSet<string>();

        // Filter out secondary stereo pair speakers - they should not appear as separate entries
        var visiblePlayers = players
            .Where(p => !p.IsSecondaryStereoPairSpeaker)
            .ToList();

        _logger.LogInformation("Visible players: {Count}, Total players: {Total}",
            visiblePlayers.Count, players.Count);

        foreach (var p in visiblePlayers)
        {
            _logger.LogInformation("Player: {Name}, IP: {IP}, IsMaster: {IsMaster}, IsGrouped: {IsGrouped}, MasterIp: {MasterIp}, SlaveIps: [{SlaveIps}]",
                p.Name, p.IpAddress, p.IsMaster, p.IsGrouped, p.MasterIp, string.Join(", ", p.SlaveIps));
        }

        // Mark secondary speakers as processed so they don't appear later
        foreach (var secondary in players.Where(p => p.IsSecondaryStereoPairSpeaker))
        {
            processedIds.Add(secondary.Id);
        }

        // First, find all masters and create groups
        foreach (var player in visiblePlayers.Where(p => p.IsMaster && p.IsGrouped))
        {
            var group = new PlayerGroup
            {
                Id = player.Id,
                Name = player.GroupName ?? player.Name,
                Type = GroupType.MultiRoom,
                Master = player
            };

            // Method 1: Find slaves via SlaveIps list from master
            foreach (var slaveAddress in player.SlaveIps)
            {
                var slaveIp = slaveAddress.Split(':')[0];
                var slave = visiblePlayers.FirstOrDefault(p => p.IpAddress == slaveIp);
                if (slave != null && !processedIds.Contains(slave.Id))
                {
                    group.Members.Add(slave);
                    processedIds.Add(slave.Id);
                    _logger.LogInformation("Found slave via SlaveIps: {Name}", slave.Name);
                }
            }

            // Method 2: Find slaves that have this master's IP as their MasterIp
            var masterIpWithPort = $"{player.IpAddress}:{player.Port}";
            var masterIpOnly = player.IpAddress;

            foreach (var potentialSlave in visiblePlayers.Where(p =>
                !processedIds.Contains(p.Id) &&
                p.Id != player.Id &&
                p.IsGrouped &&
                !p.IsMaster &&
                p.MasterIp != null))
            {
                var slaveMasterIp = potentialSlave.MasterIp!.Split(':')[0];
                if (slaveMasterIp == masterIpOnly)
                {
                    group.Members.Add(potentialSlave);
                    processedIds.Add(potentialSlave.Id);
                    _logger.LogInformation("Found slave via MasterIp: {Name}", potentialSlave.Name);
                }
            }

            processedIds.Add(player.Id);
            groups.Add(group);

            _logger.LogInformation("Created group '{Name}' with {MemberCount} members",
                group.Name, group.Members.Count);
        }

        // Add ungrouped players as single-player groups
        foreach (var player in visiblePlayers.Where(p => !processedIds.Contains(p.Id) && !p.IsGrouped))
        {
            var groupType = player.IsStereoPaired ? GroupType.StereoPair : GroupType.Single;
            groups.Add(new PlayerGroup
            {
                Id = player.Id,
                Name = player.Name,
                Type = groupType,
                Master = player
            });
            processedIds.Add(player.Id);
        }

        // Handle slaves that weren't found through their master (edge case)
        foreach (var player in visiblePlayers.Where(p => !processedIds.Contains(p.Id)))
        {
            var groupType = player.IsStereoPaired ? GroupType.StereoPair : GroupType.Single;
            groups.Add(new PlayerGroup
            {
                Id = player.Id,
                Name = player.Name,
                Type = groupType,
                Master = player
            });
        }

        return groups.OrderBy(g => g.Type).ThenBy(g => g.Name).ToList();
    }
}

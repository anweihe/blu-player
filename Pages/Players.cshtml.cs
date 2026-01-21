using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using BluesoundWeb.Models;
using BluesoundWeb.Services;

namespace BluesoundWeb.Pages;

public class PlayersModel : PageModel
{
    private readonly IBluesoundPlayerService _playerService;
    private readonly IBluesoundApiService _apiService;
    private readonly ILogger<PlayersModel> _logger;

    public PlayersModel(
        IBluesoundPlayerService playerService,
        IBluesoundApiService apiService,
        ILogger<PlayersModel> logger)
    {
        _playerService = playerService;
        _apiService = apiService;
        _logger = logger;
    }

    public List<PlayerGroup> PlayerGroups { get; set; } = new();
    public string? ErrorMessage { get; set; }
    public string? SuccessMessage { get; set; }
    public bool IsInitialLoad { get; set; } = true;

    public void OnGet()
    {
        // Page loads immediately - discovery happens via AJAX
        IsInitialLoad = true;
    }

    /// <summary>
    /// Returns only the page content for SPA navigation
    /// </summary>
    public IActionResult OnGetFragment()
    {
        IsInitialLoad = true;
        return Partial("_PlayersContent", this);
    }

    /// <summary>
    /// AJAX endpoint for discovering players.
    /// refresh=true: Full mDNS discovery, saves to database
    /// refresh=false: Uses stored players from DB if available, otherwise mDNS
    /// </summary>
    public async Task<IActionResult> OnGetDiscoverAsync(bool refresh = false)
    {
        try
        {
            var players = await _playerService.DiscoverPlayersAsync(forceRefresh: refresh);
            var groups = _playerService.OrganizeIntoGroups(players);

            return new JsonResult(new
            {
                success = true,
                groups = groups.Select(g => new
                {
                    id = g.Id,
                    name = g.Name,
                    type = g.Type.ToString(),
                    displayType = g.DisplayType,
                    totalMembers = g.TotalMembers,
                    master = g.Master == null ? null : new
                    {
                        id = g.Master.Id,
                        name = g.Master.Name,
                        ipAddress = g.Master.IpAddress,
                        port = g.Master.Port,
                        modelName = g.Master.ModelName,
                        brand = g.Master.Brand,
                        volume = g.Master.Volume,
                        isFixedVolume = g.Master.IsFixedVolume,
                        isStereoPaired = g.Master.IsStereoPaired,
                        channelMode = g.Master.ChannelMode
                    },
                    members = g.Members.Select(m => new
                    {
                        id = m.Id,
                        name = m.Name,
                        ipAddress = m.IpAddress,
                        port = m.Port,
                        modelName = m.ModelName,
                        brand = m.Brand,
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
            _logger.LogError(ex, "Error during player discovery");
            return new JsonResult(new
            {
                success = false,
                error = $"Fehler bei der Suche nach Playern: {ex.Message}"
            });
        }
    }

    public async Task<IActionResult> OnPostRefreshAsync()
    {
        try
        {
            var players = await _playerService.DiscoverPlayersAsync(forceRefresh: true);
            PlayerGroups = _playerService.OrganizeIntoGroups(players);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during player refresh");
            ErrorMessage = $"Fehler bei der Suche nach Playern: {ex.Message}";
        }
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
        await RefreshAndOrganizePlayersAsync();

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
        await RefreshAndOrganizePlayersAsync();

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
        await RefreshAndOrganizePlayersAsync();

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
        await RefreshAndOrganizePlayersAsync();

        return Page();
    }

    public async Task<IActionResult> OnPostVolumeAsync(string playerIp, int playerPort, int volume)
    {
        _logger.LogInformation("Setting volume to {Volume} on {PlayerIp}:{PlayerPort}", volume, playerIp, playerPort);

        await _playerService.SetVolumeAsync(playerIp, volume, playerPort);

        // Return JSON with new volume for AJAX requests
        if (Request.Headers["X-Requested-With"] == "XMLHttpRequest")
        {
            var status = await _apiService.GetPlayerStatusAsync(playerIp, playerPort);
            return new JsonResult(new { success = true, volume = status?.Volume ?? volume });
        }

        await RefreshAndOrganizePlayersAsync();
        return Page();
    }

    public async Task<IActionResult> OnGetPlaybackStatusAsync(string playerIp, int playerPort)
    {
        var status = await _playerService.GetPlaybackStatusAsync(playerIp, playerPort);
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
        var success = await _playerService.PlayAsync(playerIp, playerPort);
        return new JsonResult(new { success });
    }

    public async Task<IActionResult> OnPostPauseAsync(string playerIp, int playerPort)
    {
        _logger.LogInformation("Pause on {PlayerIp}:{PlayerPort}", playerIp, playerPort);
        var success = await _playerService.PauseAsync(playerIp, playerPort);
        return new JsonResult(new { success });
    }

    public async Task<IActionResult> OnPostStopAsync(string playerIp, int playerPort)
    {
        _logger.LogInformation("Stop on {PlayerIp}:{PlayerPort}", playerIp, playerPort);
        var success = await _playerService.StopAsync(playerIp, playerPort);
        return new JsonResult(new { success });
    }

    public async Task<IActionResult> OnPostNextTrackAsync(string playerIp, int playerPort)
    {
        _logger.LogInformation("Next track on {PlayerIp}:{PlayerPort}", playerIp, playerPort);
        var success = await _playerService.NextTrackAsync(playerIp, playerPort);
        return new JsonResult(new { success });
    }

    public async Task<IActionResult> OnPostPreviousTrackAsync(string playerIp, int playerPort)
    {
        _logger.LogInformation("Previous track on {PlayerIp}:{PlayerPort}", playerIp, playerPort);
        var success = await _playerService.PreviousTrackAsync(playerIp, playerPort);
        return new JsonResult(new { success });
    }

    /// <summary>
    /// Helper to refresh known players and organize into groups for page display.
    /// </summary>
    private async Task RefreshAndOrganizePlayersAsync()
    {
        try
        {
            var players = await _playerService.RefreshKnownPlayersAsync();
            PlayerGroups = _playerService.OrganizeIntoGroups(players);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error refreshing players");
            ErrorMessage = $"Fehler beim Aktualisieren der Player: {ex.Message}";
        }
    }
}

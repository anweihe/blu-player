using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using BluesoundWeb.Models;
using BluesoundWeb.Services;
using System.Xml.Linq;

namespace BluesoundWeb.Pages;

public class RadioParadiseModel : PageModel
{
    private readonly IBluesoundPlayerService _playerService;
    private readonly IBluesoundApiService _bluesoundService;
    private readonly IListeningHistoryService _historyService;
    private readonly ILogger<RadioParadiseModel> _logger;

    public RadioParadiseModel(
        IBluesoundPlayerService playerService,
        IBluesoundApiService bluesoundService,
        IListeningHistoryService historyService,
        ILogger<RadioParadiseModel> logger)
    {
        _playerService = playerService;
        _bluesoundService = bluesoundService;
        _historyService = historyService;
        _logger = logger;
    }

    public void OnGet()
    {
        // Initial page load - nothing needed server-side
    }

    /// <summary>
    /// Returns only the page content for SPA navigation
    /// </summary>
    public IActionResult OnGetFragment()
    {
        return Partial("_RadioParadiseContent", this);
    }

    /// <summary>
    /// Get available Bluesound players for the player selector
    /// </summary>
    public async Task<IActionResult> OnGetPlayersAsync(bool refresh = false, bool refreshStatus = false)
    {
        try
        {
            var players = await _playerService.DiscoverPlayersAsync(
                forceRefresh: refresh,
                skipCache: refreshStatus);

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
                    channelMode = p.ChannelMode
                })
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to discover players");
            return new JsonResult(new { success = false, error = "Player-Suche fehlgeschlagen" });
        }
    }

    /// <summary>
    /// Get the Radio Paradise menu from a player
    /// </summary>
    public async Task<IActionResult> OnGetMenuAsync(string playerIp, int port = 11000)
    {
        if (string.IsNullOrEmpty(playerIp))
        {
            return new JsonResult(new { success = false, error = "Fehlende Player-IP" });
        }

        _logger.LogInformation("Fetching Radio Paradise menu from player {Ip}:{Port}", playerIp, port);

        var xml = await _bluesoundService.GetRadioParadiseMenuXmlAsync(playerIp, port);

        if (string.IsNullOrEmpty(xml))
        {
            return new JsonResult(new { success = false, error = "Radio Paradise Menu konnte nicht geladen werden" });
        }

        try
        {
            var response = ParseBrowseResponseWithSections(xml, playerIp, port);

            var sections = response.Sections.Select(s => new
            {
                title = s.Title,
                items = s.Items.Select(i => new
                {
                    title = i.Title,
                    subtitle = i.Subtitle,
                    imageUrl = i.ImageUrl,
                    type = i.Type,
                    actionUri = i.ActionUri,
                    actionUrl = i.ActionUrl,
                    actionType = i.ActionType,
                    isPlayable = i.IsPlayable,
                    isBrowsable = i.IsBrowsable
                })
            });

            return new JsonResult(new
            {
                success = true,
                sections,
                hasMultipleSections = response.HasMultipleSections
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to parse Radio Paradise menu XML");
            return new JsonResult(new { success = false, error = "Fehler beim Parsen der Radio Paradise-Daten" });
        }
    }

    /// <summary>
    /// Play a Radio Paradise station
    /// </summary>
    public async Task<IActionResult> OnPostPlayStationAsync([FromBody] PlayRadioParadiseStationRequest request)
    {
        if (string.IsNullOrEmpty(request.Ip) || string.IsNullOrEmpty(request.PlayUrl))
        {
            return new JsonResult(new { success = false, error = "Fehlende Parameter" });
        }

        _logger.LogInformation("Playing Radio Paradise station on {Ip}:{Port}: {Title}", request.Ip, request.Port, request.Title ?? request.PlayUrl);

        var success = await _bluesoundService.PlayRadioParadiseStationAsync(
            request.Ip,
            request.Port,
            request.PlayUrl,
            request.Title,
            request.ImageUrl);

        if (!success)
        {
            return new JsonResult(new { success = false, error = "Station konnte nicht abgespielt werden" });
        }

        return new JsonResult(new { success = true });
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
    /// Control playback on a Bluesound player (play/pause/stop)
    /// </summary>
    public async Task<IActionResult> OnPostBluesoundControlAsync([FromBody] BluesoundControlRequest request)
    {
        if (string.IsNullOrEmpty(request.Ip) || string.IsNullOrEmpty(request.Action))
        {
            return new JsonResult(new { success = false, error = "Fehlende Parameter" });
        }

        _logger.LogInformation("Bluesound control: {Action} on {Ip}:{Port}", request.Action, request.Ip, request.Port);

        var action = request.Action.ToLower();
        bool success = action switch
        {
            "play" => await _playerService.PlayAsync(request.Ip, request.Port),
            "pause" => await _playerService.PauseAsync(request.Ip, request.Port),
            "stop" => await _playerService.StopAsync(request.Ip, request.Port),
            "next" => await _playerService.NextTrackAsync(request.Ip, request.Port),
            "previous" => await _playerService.PreviousTrackAsync(request.Ip, request.Port),
            _ => false
        };

        return new JsonResult(new { success });
    }

    /// <summary>
    /// Save a Radio Paradise channel to listening history
    /// </summary>
    public async Task<IActionResult> OnPostSaveHistoryAsync([FromBody] SaveRadioParadiseHistoryRequest request)
    {
        if (string.IsNullOrEmpty(request.ActionUrl))
        {
            return new JsonResult(new { success = false, error = "Fehlende ActionUrl" });
        }

        await _historyService.SaveRadioParadiseAsync(request.Title, request.ImageUrl, request.ActionUrl, request.Quality);

        return new JsonResult(new { success = true });
    }

    /// <summary>
    /// Parse browse/menu XML response into sections with items
    /// </summary>
    private RadioParadiseBrowseResponse ParseBrowseResponseWithSections(string xml, string playerIp, int port)
    {
        var response = new RadioParadiseBrowseResponse();
        var doc = XDocument.Parse(xml);

        // Get screen title
        var screen = doc.Element("screen");
        response.ScreenTitle = screen?.Attribute("screenTitle")?.Value;

        // Find all list elements (each list is a section - MQA, CD Quality)
        var listElements = doc.Descendants("list").ToList();

        if (listElements.Count == 0)
        {
            // Fallback: find items directly (old format)
            var section = new RadioParadiseSection();
            var itemElements = doc.Descendants("item");
            foreach (var item in itemElements)
            {
                section.Items.Add(ParseItem(item, playerIp, port));
            }
            if (section.Items.Count > 0)
            {
                response.Sections.Add(section);
            }
        }
        else
        {
            foreach (var list in listElements)
            {
                var section = new RadioParadiseSection
                {
                    Title = list.Attribute("title")?.Value
                };

                // Parse items in this list
                foreach (var item in list.Elements("item"))
                {
                    section.Items.Add(ParseItem(item, playerIp, port));
                }

                if (section.Items.Count > 0)
                {
                    response.Sections.Add(section);
                }
            }
        }

        return response;
    }

    /// <summary>
    /// Parse a single item element
    /// </summary>
    private RadioParadiseItem ParseItem(XElement item, string playerIp, int port)
    {
        var rpItem = new RadioParadiseItem
        {
            Title = item.Attribute("title")?.Value ?? "",
            Subtitle = item.Attribute("subTitle")?.Value,
            ImageUrl = item.Attribute("image")?.Value,
            Type = item.Attribute("type")?.Value ?? "station"
        };

        // Get the action element for navigation or playback
        var action = item.Element("action");
        if (action != null)
        {
            rpItem.ActionUri = action.Attribute("uri")?.Value ?? action.Attribute("URI")?.Value;
            rpItem.ActionUrl = action.Attribute("url")?.Value;
            rpItem.ActionType = action.Attribute("type")?.Value ?? "player-link";
        }

        // Convert relative image URLs to absolute
        if (!string.IsNullOrEmpty(rpItem.ImageUrl) && rpItem.ImageUrl.StartsWith("/"))
        {
            rpItem.ImageUrl = $"http://{playerIp}:{port}{rpItem.ImageUrl}";
        }

        // Radio Paradise items are always playable stations
        rpItem.IsPlayable = rpItem.ActionType == "player-link" || !string.IsNullOrEmpty(rpItem.ActionUri);
        rpItem.IsBrowsable = false; // Radio Paradise doesn't have browsable categories

        return rpItem;
    }
}

/// <summary>
/// Request model for playing a Radio Paradise station
/// </summary>
public class PlayRadioParadiseStationRequest
{
    public string Ip { get; set; } = string.Empty;
    public int Port { get; set; } = 11000;
    public string PlayUrl { get; set; } = string.Empty;
    public string? Title { get; set; }
    public string? ImageUrl { get; set; }
}

/// <summary>
/// Represents a Radio Paradise menu/browse item
/// </summary>
public class RadioParadiseItem
{
    public string Title { get; set; } = string.Empty;
    public string? Subtitle { get; set; }
    public string? ImageUrl { get; set; }
    public string Type { get; set; } = "station";
    public string? ActionUri { get; set; }
    public string? ActionUrl { get; set; }
    public string ActionType { get; set; } = "player-link";
    public bool IsPlayable { get; set; }
    public bool IsBrowsable { get; set; }
}

/// <summary>
/// Represents a section (list) in a Radio Paradise browse response (e.g., MQA, CD Quality)
/// </summary>
public class RadioParadiseSection
{
    public string? Title { get; set; }
    public List<RadioParadiseItem> Items { get; set; } = new();
}

/// <summary>
/// Represents a complete Radio Paradise browse response with multiple sections
/// </summary>
public class RadioParadiseBrowseResponse
{
    public string? ScreenTitle { get; set; }
    public List<RadioParadiseSection> Sections { get; set; } = new();
    public bool HasMultipleSections => Sections.Count > 1 || (Sections.Count == 1 && !string.IsNullOrEmpty(Sections[0].Title));
}

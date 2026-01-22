using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using BluesoundWeb.Models;
using BluesoundWeb.Services;
using System.Xml.Linq;

namespace BluesoundWeb.Pages;

public class TuneInModel : PageModel
{
    private readonly IBluesoundPlayerService _playerService;
    private readonly IBluesoundApiService _bluesoundService;
    private readonly IListeningHistoryService _historyService;
    private readonly ILogger<TuneInModel> _logger;

    public TuneInModel(
        IBluesoundPlayerService playerService,
        IBluesoundApiService bluesoundService,
        IListeningHistoryService historyService,
        ILogger<TuneInModel> logger)
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
        return Partial("_TuneInContent", this);
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
    /// Get the TuneIn main menu from a player
    /// </summary>
    public async Task<IActionResult> OnGetMenuAsync(string playerIp, int port = 11000)
    {
        if (string.IsNullOrEmpty(playerIp))
        {
            return new JsonResult(new { success = false, error = "Fehlende Player-IP" });
        }

        _logger.LogInformation("Fetching TuneIn menu from player {Ip}:{Port}", playerIp, port);

        var xml = await _bluesoundService.GetTuneInMenuXmlAsync(playerIp, port);

        if (string.IsNullOrEmpty(xml))
        {
            return new JsonResult(new { success = false, error = "TuneIn-Menu konnte nicht geladen werden" });
        }

        try
        {
            var items = ParseBrowseResponse(xml, playerIp, port);
            return new JsonResult(new { success = true, items });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to parse TuneIn menu XML");
            return new JsonResult(new { success = false, error = "Fehler beim Parsen der TuneIn-Daten" });
        }
    }

    /// <summary>
    /// Browse a TuneIn category or subcategory
    /// </summary>
    public async Task<IActionResult> OnGetBrowseAsync(string playerIp, int port, string uri)
    {
        if (string.IsNullOrEmpty(playerIp) || string.IsNullOrEmpty(uri))
        {
            return new JsonResult(new { success = false, error = "Fehlende Parameter" });
        }

        _logger.LogInformation("Browsing TuneIn at {Uri} on player {Ip}:{Port}", uri, playerIp, port);

        var xml = await _bluesoundService.BrowseTuneInAsync(playerIp, port, uri);

        if (string.IsNullOrEmpty(xml))
        {
            return new JsonResult(new { success = false, error = "TuneIn-Kategorie konnte nicht geladen werden" });
        }

        try
        {
            var response = ParseBrowseResponseWithSections(xml, playerIp, port);
            var title = response.ScreenTitle ?? ParseBrowseTitle(xml);

            // Return sections data for rendering
            var sections = response.Sections.Select(s => new
            {
                title = s.Title,
                viewAllUri = s.ViewAllUri,
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
                title,
                sections,
                hasMultipleSections = response.HasMultipleSections,
                // Also include flat items list for backward compatibility
                items = response.Sections.SelectMany(s => s.Items).Select(i => new
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
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to parse TuneIn browse XML");
            return new JsonResult(new { success = false, error = "Fehler beim Parsen der TuneIn-Daten" });
        }
    }

    /// <summary>
    /// Play a TuneIn station
    /// </summary>
    public async Task<IActionResult> OnPostPlayStationAsync([FromBody] PlayTuneInStationRequest request)
    {
        if (string.IsNullOrEmpty(request.Ip) || string.IsNullOrEmpty(request.PlayUrl))
        {
            return new JsonResult(new { success = false, error = "Fehlende Parameter" });
        }

        _logger.LogInformation("Playing TuneIn station on {Ip}:{Port}: {Title}", request.Ip, request.Port, request.Title ?? request.PlayUrl);

        var success = await _bluesoundService.PlayTuneInStationAsync(
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

        // Convert direct Bluesound URL to proxy URL to avoid mixed content issues
        var imageUrl = status.ImageUrl;
        if (!string.IsNullOrEmpty(imageUrl) && imageUrl.StartsWith($"http://{ip}:{port}"))
        {
            var path = imageUrl.Substring($"http://{ip}:{port}".Length);
            imageUrl = $"/Qobuz?handler=BluesoundImage&ip={ip}&port={port}&path={Uri.EscapeDataString(path)}";
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
                imageUrl = imageUrl,
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
    /// Save a TuneIn station to listening history
    /// </summary>
    public async Task<IActionResult> OnPostSaveHistoryAsync([FromBody] SaveTuneInHistoryRequest request)
    {
        if (string.IsNullOrEmpty(request.ActionUrl))
        {
            return new JsonResult(new { success = false, error = "Fehlende ActionUrl" });
        }

        await _historyService.SaveTuneInAsync(request.Title, request.ImageUrl, request.ActionUrl);

        return new JsonResult(new { success = true });
    }

    /// <summary>
    /// Parse browse/menu XML response into items (legacy - flat list)
    /// </summary>
    private List<TuneInItem> ParseBrowseResponse(string xml, string playerIp, int port)
    {
        var response = ParseBrowseResponseWithSections(xml, playerIp, port);
        // Flatten all sections into a single list for backward compatibility
        return response.Sections.SelectMany(s => s.Items).ToList();
    }

    /// <summary>
    /// Parse browse/menu XML response into sections with items
    /// </summary>
    private TuneInBrowseResponse ParseBrowseResponseWithSections(string xml, string playerIp, int port)
    {
        var response = new TuneInBrowseResponse();
        var doc = XDocument.Parse(xml);

        // Get screen title
        var screen = doc.Element("screen");
        response.ScreenTitle = screen?.Attribute("screenTitle")?.Value;

        // Find all list elements (each list is a section)
        var listElements = doc.Descendants("list").ToList();

        if (listElements.Count == 0)
        {
            // Fallback: find items directly (old format)
            var section = new TuneInSection();
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
                var section = new TuneInSection
                {
                    Title = list.Attribute("title")?.Value
                };

                // Check for menuAction with "View All" text
                var menuAction = list.Element("menuAction");
                if (menuAction != null)
                {
                    var menuActionText = menuAction.Attribute("text")?.Value;
                    if (menuActionText == "View All" || menuActionText == "Alle anzeigen")
                    {
                        // Get the URI from the action element inside menuAction
                        var viewAllAction = menuAction.Element("action");
                        section.ViewAllUri = viewAllAction?.Attribute("uri")?.Value
                            ?? viewAllAction?.Attribute("URI")?.Value;
                    }
                }

                // Also check for direct action on list element (browse link for section)
                var listAction = list.Element("action");
                if (listAction != null && string.IsNullOrEmpty(section.ViewAllUri))
                {
                    section.ViewAllUri = listAction.Attribute("uri")?.Value
                        ?? listAction.Attribute("URI")?.Value;
                }

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
    private TuneInItem ParseItem(XElement item, string playerIp, int port)
    {
        var tuneInItem = new TuneInItem
        {
            Title = item.Attribute("title")?.Value ?? "",
            Subtitle = item.Attribute("subTitle")?.Value,
            ImageUrl = item.Attribute("image")?.Value,
            Type = item.Attribute("type")?.Value ?? "category"
        };

        // Get the action element for navigation or playback
        var action = item.Element("action");
        if (action != null)
        {
            tuneInItem.ActionUri = action.Attribute("uri")?.Value ?? action.Attribute("URI")?.Value;
            tuneInItem.ActionUrl = action.Attribute("url")?.Value;
            tuneInItem.ActionType = action.Attribute("type")?.Value ?? "browse";
        }

        // Convert relative image URLs to absolute
        if (!string.IsNullOrEmpty(tuneInItem.ImageUrl) && tuneInItem.ImageUrl.StartsWith("/"))
        {
            tuneInItem.ImageUrl = $"http://{playerIp}:{port}{tuneInItem.ImageUrl}";
        }

        // Determine if this is a playable station or a browsable category based on action type
        tuneInItem.IsPlayable = tuneInItem.ActionType == "player-link" || !string.IsNullOrEmpty(tuneInItem.ActionUrl);
        tuneInItem.IsBrowsable = tuneInItem.ActionType == "browse" && !string.IsNullOrEmpty(tuneInItem.ActionUri);

        return tuneInItem;
    }

    /// <summary>
    /// Parse the title from a browse response (for breadcrumb)
    /// </summary>
    private string? ParseBrowseTitle(string xml)
    {
        try
        {
            var doc = XDocument.Parse(xml);
            // Try to find title in browseMenu or browse element
            var browseMenu = doc.Element("browseMenu") ?? doc.Element("browse") ?? doc.Element("browseMenuGroup");
            return browseMenu?.Attribute("title")?.Value;
        }
        catch
        {
            return null;
        }
    }
}

/// <summary>
/// Request model for playing a TuneIn station
/// </summary>
public class PlayTuneInStationRequest
{
    public string Ip { get; set; } = string.Empty;
    public int Port { get; set; } = 11000;
    public string PlayUrl { get; set; } = string.Empty;
    public string? Title { get; set; }
    public string? ImageUrl { get; set; }
}

/// <summary>
/// Represents a TuneIn menu/browse item
/// </summary>
public class TuneInItem
{
    public string Title { get; set; } = string.Empty;
    public string? Subtitle { get; set; }
    public string? ImageUrl { get; set; }
    public string Type { get; set; } = "category";
    public string? ActionUri { get; set; }
    public string? ActionUrl { get; set; }
    public string ActionType { get; set; } = "browse"; // "browse" or "player-link"
    public bool IsPlayable { get; set; }
    public bool IsBrowsable { get; set; }
}

/// <summary>
/// Represents a section (list) in a TuneIn browse response
/// </summary>
public class TuneInSection
{
    public string? Title { get; set; }
    public string? ViewAllUri { get; set; }
    public List<TuneInItem> Items { get; set; } = new();
}

/// <summary>
/// Represents a complete TuneIn browse response with multiple sections
/// </summary>
public class TuneInBrowseResponse
{
    public string? ScreenTitle { get; set; }
    public List<TuneInSection> Sections { get; set; } = new();
    public bool HasMultipleSections => Sections.Count > 1 || (Sections.Count == 1 && !string.IsNullOrEmpty(Sections[0].Title));
}

using Microsoft.AspNetCore.Mvc;
using BluesoundWeb.Models;
using BluesoundWeb.Services;
using System.Xml.Linq;

namespace BluesoundWeb.Controllers;

[ApiController]
[Route("api/[controller]")]
public class TuneInController : ControllerBase
{
    private readonly IBluesoundPlayerService _playerService;
    private readonly IBluesoundApiService _bluesoundService;
    private readonly IListeningHistoryService _historyService;
    private readonly ILogger<TuneInController> _logger;

    public TuneInController(
        IBluesoundPlayerService playerService,
        IBluesoundApiService bluesoundService,
        IListeningHistoryService historyService,
        ILogger<TuneInController> logger)
    {
        _playerService = playerService;
        _bluesoundService = bluesoundService;
        _historyService = historyService;
        _logger = logger;
    }

    [HttpGet]
    public async Task<IActionResult> Get([FromQuery] string? handler, [FromQuery] string? playerIp, [FromQuery] string? uri, [FromQuery] string? ip, [FromQuery] int port = 11000, [FromQuery] bool refresh = false, [FromQuery] bool refreshStatus = false)
    {
        return handler?.ToLower() switch
        {
            "menu" => await GetMenuAsync(playerIp!, port),
            "browse" => await BrowseAsync(playerIp!, port, uri!),
            "players" => await GetPlayersAsync(refresh, refreshStatus),
            "bluesoundstatus" => await GetBluesoundStatusAsync(ip!, port),
            _ => BadRequest("Unknown handler")
        };
    }

    [HttpPost]
    public async Task<IActionResult> Post([FromQuery] string? handler, [FromBody] object body)
    {
        return handler?.ToLower() switch
        {
            "playstation" => await PlayStationAsync(body),
            "bluesoundcontrol" => await BluesoundControlAsync(body),
            "savehistory" => await SaveHistoryAsync(body),
            _ => BadRequest("Unknown handler")
        };
    }

    private async Task<IActionResult> GetPlayersAsync(bool refresh, bool refreshStatus)
    {
        try
        {
            var players = await _playerService.DiscoverPlayersAsync(forceRefresh: refresh, skipCache: refreshStatus);
            var selectorItems = _playerService.GetPlayersForSelector(players);

            return Ok(new
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
            return Ok(new { success = false, error = "Player-Suche fehlgeschlagen" });
        }
    }

    private async Task<IActionResult> GetMenuAsync(string playerIp, int port)
    {
        if (string.IsNullOrEmpty(playerIp))
        {
            return Ok(new { success = false, error = "Fehlende Player-IP" });
        }

        _logger.LogInformation("Fetching TuneIn menu from player {Ip}:{Port}", playerIp, port);

        var xml = await _bluesoundService.GetTuneInMenuXmlAsync(playerIp, port);

        if (string.IsNullOrEmpty(xml))
        {
            return Ok(new { success = false, error = "TuneIn-Menu konnte nicht geladen werden" });
        }

        try
        {
            var items = ParseBrowseResponse(xml, playerIp, port);
            return Ok(new { success = true, items });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to parse TuneIn menu XML");
            return Ok(new { success = false, error = "Fehler beim Parsen der TuneIn-Daten" });
        }
    }

    private async Task<IActionResult> BrowseAsync(string playerIp, int port, string uri)
    {
        if (string.IsNullOrEmpty(playerIp) || string.IsNullOrEmpty(uri))
        {
            return Ok(new { success = false, error = "Fehlende Parameter" });
        }

        _logger.LogInformation("Browsing TuneIn at {Uri} on player {Ip}:{Port}", uri, playerIp, port);

        var xml = await _bluesoundService.BrowseTuneInAsync(playerIp, port, uri);

        if (string.IsNullOrEmpty(xml))
        {
            return Ok(new { success = false, error = "TuneIn-Kategorie konnte nicht geladen werden" });
        }

        try
        {
            var response = ParseBrowseResponseWithSections(xml, playerIp, port);
            var title = response.ScreenTitle ?? ParseBrowseTitle(xml);

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

            return Ok(new
            {
                success = true,
                title,
                sections,
                hasMultipleSections = response.HasMultipleSections,
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
            return Ok(new { success = false, error = "Fehler beim Parsen der TuneIn-Daten" });
        }
    }

    private async Task<IActionResult> PlayStationAsync(object body)
    {
        var request = System.Text.Json.JsonSerializer.Deserialize<PlayTuneInRequest>(
            System.Text.Json.JsonSerializer.Serialize(body));

        if (request == null || string.IsNullOrEmpty(request.Ip) || string.IsNullOrEmpty(request.PlayUrl))
        {
            return Ok(new { success = false, error = "Fehlende Parameter" });
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
            return Ok(new { success = false, error = "Station konnte nicht abgespielt werden" });
        }

        return Ok(new { success = true });
    }

    private async Task<IActionResult> GetBluesoundStatusAsync(string ip, int port)
    {
        if (string.IsNullOrEmpty(ip))
        {
            return Ok(new { success = false, error = "Fehlende IP-Adresse" });
        }

        var status = await _playerService.GetPlaybackStatusAsync(ip, port);

        if (status == null)
        {
            return Ok(new { success = false, error = "Status konnte nicht abgerufen werden" });
        }

        var imageUrl = status.ImageUrl;
        if (!string.IsNullOrEmpty(imageUrl) && imageUrl.StartsWith($"http://{ip}:{port}"))
        {
            var path = imageUrl.Substring($"http://{ip}:{port}".Length);
            imageUrl = $"/Api/Qobuz/BluesoundImage?ip={ip}&port={port}&path={Uri.EscapeDataString(path)}";
        }

        return Ok(new
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

    private async Task<IActionResult> BluesoundControlAsync(object body)
    {
        var request = System.Text.Json.JsonSerializer.Deserialize<BluesoundControlRequest>(
            System.Text.Json.JsonSerializer.Serialize(body));

        if (request == null || string.IsNullOrEmpty(request.Ip) || string.IsNullOrEmpty(request.Action))
        {
            return Ok(new { success = false, error = "Fehlende Parameter" });
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

        return Ok(new { success });
    }

    private async Task<IActionResult> SaveHistoryAsync(object body)
    {
        var request = System.Text.Json.JsonSerializer.Deserialize<SaveTuneInHistoryRequest>(
            System.Text.Json.JsonSerializer.Serialize(body));

        if (request == null || string.IsNullOrEmpty(request.ProfileId))
        {
            return Ok(new { success = false, error = "Fehlende ProfileId" });
        }

        if (string.IsNullOrEmpty(request.ActionUrl))
        {
            return Ok(new { success = false, error = "Fehlende ActionUrl" });
        }

        await _historyService.SaveTuneInAsync(request.ProfileId, request.Title, request.ImageUrl, request.ActionUrl);

        return Ok(new { success = true });
    }

    private List<TuneInItemDto> ParseBrowseResponse(string xml, string playerIp, int port)
    {
        var response = ParseBrowseResponseWithSections(xml, playerIp, port);
        return response.Sections.SelectMany(s => s.Items).ToList();
    }

    private TuneInBrowseResponseDto ParseBrowseResponseWithSections(string xml, string playerIp, int port)
    {
        var response = new TuneInBrowseResponseDto();
        var doc = XDocument.Parse(xml);

        var screen = doc.Element("screen");
        response.ScreenTitle = screen?.Attribute("screenTitle")?.Value;

        var listElements = doc.Descendants("list").ToList();

        if (listElements.Count == 0)
        {
            var section = new TuneInSectionDto();
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
                var section = new TuneInSectionDto
                {
                    Title = list.Attribute("title")?.Value
                };

                var menuAction = list.Element("menuAction");
                if (menuAction != null)
                {
                    var menuActionText = menuAction.Attribute("text")?.Value;
                    if (menuActionText == "View All" || menuActionText == "Alle anzeigen")
                    {
                        var viewAllAction = menuAction.Element("action");
                        section.ViewAllUri = viewAllAction?.Attribute("uri")?.Value
                            ?? viewAllAction?.Attribute("URI")?.Value;
                    }
                }

                var listAction = list.Element("action");
                if (listAction != null && string.IsNullOrEmpty(section.ViewAllUri))
                {
                    section.ViewAllUri = listAction.Attribute("uri")?.Value
                        ?? listAction.Attribute("URI")?.Value;
                }

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

    private TuneInItemDto ParseItem(XElement item, string playerIp, int port)
    {
        var tuneInItem = new TuneInItemDto
        {
            Title = item.Attribute("title")?.Value ?? "",
            Subtitle = item.Attribute("subTitle")?.Value,
            ImageUrl = item.Attribute("image")?.Value,
            Type = item.Attribute("type")?.Value ?? "category"
        };

        var action = item.Element("action");
        if (action != null)
        {
            tuneInItem.ActionUri = action.Attribute("uri")?.Value ?? action.Attribute("URI")?.Value;
            tuneInItem.ActionUrl = action.Attribute("url")?.Value;
            tuneInItem.ActionType = action.Attribute("type")?.Value ?? "browse";
        }

        if (!string.IsNullOrEmpty(tuneInItem.ImageUrl) && tuneInItem.ImageUrl.StartsWith("/"))
        {
            tuneInItem.ImageUrl = $"http://{playerIp}:{port}{tuneInItem.ImageUrl}";
        }

        tuneInItem.IsPlayable = tuneInItem.ActionType == "player-link" || !string.IsNullOrEmpty(tuneInItem.ActionUrl);
        tuneInItem.IsBrowsable = tuneInItem.ActionType == "browse" && !string.IsNullOrEmpty(tuneInItem.ActionUri);

        return tuneInItem;
    }

    private string? ParseBrowseTitle(string xml)
    {
        try
        {
            var doc = XDocument.Parse(xml);
            var browseMenu = doc.Element("browseMenu") ?? doc.Element("browse") ?? doc.Element("browseMenuGroup");
            return browseMenu?.Attribute("title")?.Value;
        }
        catch
        {
            return null;
        }
    }
}

// DTOs
public class PlayTuneInRequest
{
    [System.Text.Json.Serialization.JsonPropertyName("ip")]
    public string Ip { get; set; } = string.Empty;

    [System.Text.Json.Serialization.JsonPropertyName("port")]
    public int Port { get; set; } = 11000;

    [System.Text.Json.Serialization.JsonPropertyName("playUrl")]
    public string PlayUrl { get; set; } = string.Empty;

    [System.Text.Json.Serialization.JsonPropertyName("title")]
    public string? Title { get; set; }

    [System.Text.Json.Serialization.JsonPropertyName("imageUrl")]
    public string? ImageUrl { get; set; }
}

public class SaveTuneInHistoryRequest
{
    [System.Text.Json.Serialization.JsonPropertyName("profileId")]
    public string ProfileId { get; set; } = string.Empty;

    [System.Text.Json.Serialization.JsonPropertyName("title")]
    public string? Title { get; set; }

    [System.Text.Json.Serialization.JsonPropertyName("imageUrl")]
    public string? ImageUrl { get; set; }

    [System.Text.Json.Serialization.JsonPropertyName("actionUrl")]
    public string? ActionUrl { get; set; }
}

public class TuneInItemDto
{
    public string Title { get; set; } = string.Empty;
    public string? Subtitle { get; set; }
    public string? ImageUrl { get; set; }
    public string Type { get; set; } = "category";
    public string? ActionUri { get; set; }
    public string? ActionUrl { get; set; }
    public string ActionType { get; set; } = "browse";
    public bool IsPlayable { get; set; }
    public bool IsBrowsable { get; set; }
}

public class TuneInSectionDto
{
    public string? Title { get; set; }
    public string? ViewAllUri { get; set; }
    public List<TuneInItemDto> Items { get; set; } = new();
}

public class TuneInBrowseResponseDto
{
    public string? ScreenTitle { get; set; }
    public List<TuneInSectionDto> Sections { get; set; } = new();
    public bool HasMultipleSections => Sections.Count > 1 || (Sections.Count == 1 && !string.IsNullOrEmpty(Sections[0].Title));
}

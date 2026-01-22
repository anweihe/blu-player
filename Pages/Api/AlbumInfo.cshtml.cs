using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using BluesoundWeb.Models;
using BluesoundWeb.Services;

namespace BluesoundWeb.Pages.Api;

[IgnoreAntiforgeryToken]
public class AlbumInfoModel : PageModel
{
    private readonly IAlbumInfoService _albumInfoService;
    private readonly ILogger<AlbumInfoModel> _logger;

    public AlbumInfoModel(
        IAlbumInfoService albumInfoService,
        ILogger<AlbumInfoModel> logger)
    {
        _albumInfoService = albumInfoService;
        _logger = logger;
    }

    // POST /api/albuminfo
    public async Task<IActionResult> OnPostAsync([FromBody] AlbumInfoRequest request)
    {
        if (request == null || string.IsNullOrWhiteSpace(request.Title))
        {
            return new JsonResult(ApiResponse<AlbumInfoDto>.Fail("Album-Titel fehlt"));
        }

        try
        {
            var info = await _albumInfoService.GetAlbumInfoAsync(
                request.AlbumId, request.Artist, request.Title);

            if (info == null)
            {
                return new JsonResult(ApiResponse<AlbumInfoDto>.Fail("Info nicht verfügbar"));
            }

            return new JsonResult(ApiResponse<AlbumInfoDto>.Ok(info));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get album info for: {Title}", request.Title);
            return new JsonResult(ApiResponse<AlbumInfoDto>.Fail("Fehler beim Abrufen der Album-Info"));
        }
    }
}

public class AlbumInfoRequest
{
    public string AlbumId { get; set; } = string.Empty;
    public string Artist { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
}

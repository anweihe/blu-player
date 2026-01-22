using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using BluesoundWeb.Models;
using BluesoundWeb.Services;

namespace BluesoundWeb.Pages.Api;

[IgnoreAntiforgeryToken]
public class RatingsModel : PageModel
{
    private readonly IAlbumRatingService _ratingService;
    private readonly ILogger<RatingsModel> _logger;

    public RatingsModel(IAlbumRatingService ratingService, ILogger<RatingsModel> logger)
    {
        _ratingService = ratingService;
        _logger = logger;
    }

    // POST /api/ratings
    public async Task<IActionResult> OnPostAsync([FromBody] RatingsRequest request)
    {
        if (request?.Albums == null || request.Albums.Count == 0)
        {
            return new JsonResult(ApiResponse<List<AlbumRatingDto>>.Ok(new List<AlbumRatingDto>()));
        }

        try
        {
            var ratings = await _ratingService.GetRatingsAsync(request.Albums);
            return new JsonResult(ApiResponse<List<AlbumRatingDto>>.Ok(ratings));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get album ratings");
            return new JsonResult(ApiResponse<List<AlbumRatingDto>>.Fail("Ratings konnten nicht geladen werden"));
        }
    }
}

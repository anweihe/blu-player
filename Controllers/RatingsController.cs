using Microsoft.AspNetCore.Mvc;
using BluesoundWeb.Models;
using BluesoundWeb.Services;

namespace BluesoundWeb.Controllers;

/// <summary>
/// API controller for album ratings
/// </summary>
[ApiController]
[Route("Api/[controller]")]
public class RatingsController : ControllerBase
{
    private readonly IAlbumRatingService _ratingService;
    private readonly ILogger<RatingsController> _logger;

    public RatingsController(IAlbumRatingService ratingService, ILogger<RatingsController> logger)
    {
        _ratingService = ratingService;
        _logger = logger;
    }

    /// <summary>
    /// POST /Api/Ratings
    /// Get ratings for a batch of albums
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> GetRatings([FromBody] RatingsRequest request)
    {
        if (request?.Albums == null || request.Albums.Count == 0)
        {
            return Ok(ApiResponse<List<AlbumRatingDto>>.Ok(new List<AlbumRatingDto>()));
        }

        try
        {
            var ratings = await _ratingService.GetRatingsAsync(request.Albums);
            return Ok(ApiResponse<List<AlbumRatingDto>>.Ok(ratings));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get album ratings");
            return Ok(ApiResponse<List<AlbumRatingDto>>.Fail("Ratings konnten nicht geladen werden"));
        }
    }
}

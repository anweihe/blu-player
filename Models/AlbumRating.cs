using System.ComponentModel.DataAnnotations;

namespace BluesoundWeb.Models;

/// <summary>
/// Entity for caching album ratings from Mistral AI
/// </summary>
public class AlbumRating
{
    public int Id { get; set; }

    [Required]
    [MaxLength(100)]
    public string AlbumId { get; set; } = string.Empty;  // Qobuz Album ID

    [MaxLength(500)]
    public string? Artist { get; set; }

    [MaxLength(500)]
    public string? Title { get; set; }

    public int? UserScore { get; set; }      // 1-10 or null
    public int? CriticsScore { get; set; }   // 1-10 or null

    public DateTime FetchedAt { get; set; }  // When the rating was retrieved
    public DateTime ExpiresAt { get; set; }  // Cache expiration (FetchedAt + 4 weeks)
}

/// <summary>
/// Request DTO for rating lookup
/// </summary>
public class AlbumRatingRequest
{
    public string AlbumId { get; set; } = string.Empty;
    public string Artist { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
}

/// <summary>
/// Response DTO for ratings
/// </summary>
public class AlbumRatingDto
{
    public string AlbumId { get; set; } = string.Empty;
    public int? UserScore { get; set; }      // 1-10
    public int? CriticsScore { get; set; }   // 1-10
}

/// <summary>
/// Request body for the ratings API endpoint
/// </summary>
public class RatingsRequest
{
    public List<AlbumRatingRequest> Albums { get; set; } = new();
}

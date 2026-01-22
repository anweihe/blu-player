using System.ComponentModel.DataAnnotations;

namespace BluesoundWeb.Models;

/// <summary>
/// Entity for caching album info summaries from Mistral AI
/// </summary>
public class AlbumInfo
{
    public int Id { get; set; }

    [Required]
    [MaxLength(100)]
    public string AlbumId { get; set; } = string.Empty;  // Qobuz Album ID

    [MaxLength(500)]
    public string? Artist { get; set; }

    [MaxLength(500)]
    public string? Title { get; set; }

    public string? Summary { get; set; }  // KI-generierte Summary

    public string? Style { get; set; }  // Album-Stil (z.B. "Jazz", "Progressive Rock")

    public DateTime FetchedAt { get; set; }  // When the info was retrieved
    public DateTime ExpiresAt { get; set; }  // Cache expiration (FetchedAt + 4 weeks)
}

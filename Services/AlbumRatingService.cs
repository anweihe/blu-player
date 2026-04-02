using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using BluesoundWeb.Data;
using BluesoundWeb.Models;

namespace BluesoundWeb.Services;

public interface IAlbumRatingService
{
    Task<List<AlbumRatingDto>> GetRatingsAsync(List<AlbumRatingRequest> albums);
}

public class AlbumRatingService : IAlbumRatingService
{
    private readonly BluesoundDbContext _context;
    private readonly IAiChatService _aiChatService;
    private readonly ILogger<AlbumRatingService> _logger;

    private const int CacheDurationDays = 28; // 4 weeks

    public AlbumRatingService(
        BluesoundDbContext context,
        IAiChatService aiChatService,
        ILogger<AlbumRatingService> logger)
    {
        _context = context;
        _aiChatService = aiChatService;
        _logger = logger;
    }

    public async Task<List<AlbumRatingDto>> GetRatingsAsync(List<AlbumRatingRequest> albums)
    {
        if (albums == null || albums.Count == 0)
            return new List<AlbumRatingDto>();

        var result = new List<AlbumRatingDto>();
        var albumsToFetch = new List<AlbumRatingRequest>();
        var now = DateTime.UtcNow;

        // 1. Check database cache
        foreach (var album in albums)
        {
            var cached = await _context.AlbumRatings
                .FirstOrDefaultAsync(r => r.AlbumId == album.AlbumId);

            if (cached != null && cached.ExpiresAt > now)
            {
                // Cache hit: valid
                result.Add(new AlbumRatingDto
                {
                    AlbumId = cached.AlbumId,
                    UserScore = cached.UserScore,
                    CriticsScore = cached.CriticsScore
                });
            }
            else
            {
                // Cache miss or expired
                albumsToFetch.Add(album);
            }
        }

        // 2. Fetch missing ratings from AI provider
        if (albumsToFetch.Count > 0)
        {
            var freshRatings = await FetchFromAiAsync(albumsToFetch);

            // 3. Save to database
            foreach (var rating in freshRatings)
            {
                var albumRequest = albumsToFetch.FirstOrDefault(a => a.AlbumId == rating.AlbumId);
                var existing = await _context.AlbumRatings
                    .FirstOrDefaultAsync(r => r.AlbumId == rating.AlbumId);

                if (existing != null)
                {
                    // Update existing
                    existing.UserScore = rating.UserScore;
                    existing.CriticsScore = rating.CriticsScore;
                    existing.FetchedAt = now;
                    existing.ExpiresAt = now.AddDays(CacheDurationDays);
                    if (albumRequest != null)
                    {
                        existing.Artist = albumRequest.Artist;
                        existing.Title = albumRequest.Title;
                    }
                }
                else
                {
                    // Insert new
                    _context.AlbumRatings.Add(new AlbumRating
                    {
                        AlbumId = rating.AlbumId,
                        Artist = albumRequest?.Artist,
                        Title = albumRequest?.Title,
                        UserScore = rating.UserScore,
                        CriticsScore = rating.CriticsScore,
                        FetchedAt = now,
                        ExpiresAt = now.AddDays(CacheDurationDays)
                    });
                }

                result.Add(rating);
            }

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to save album ratings to database");
            }
        }

        return result;
    }

    private async Task<List<AlbumRatingDto>> FetchFromAiAsync(List<AlbumRatingRequest> albums)
    {
        var result = new List<AlbumRatingDto>();

        // Format: "Artist:Album:Id,Artist:Album:Id,..."
        var userMessage = string.Join(",", albums.Select(a =>
            $"{EscapeField(a.Artist)}:{EscapeField(a.Title)}:{a.AlbumId}"));

        var systemPrompt = """
            Du bist ein Musikredakteur und ein Spezialist für alle Arten von Genres.
            Du sollst Alben von Künstlern bewerten und auf einer Skala von 1 (niedrigste) bis 10 (höchste) bewerten. Zum einen aufgrund von Userbewertungen und zum Anderen aufgrund von Kritikerbewertungen.
            Das Rückgabeformat sollte so aussehen:
            [{ "albumId": <albumId>, "userScore": <userScore>, "criticsScore": <criticsScore>}]
            WICHTIG: userScore und criticsScore sind Ganzzahlen. Liefere ausschließlich das Rückgabeformat zurück, ohne weiteren Text.
            Als Eingabe erhältst du eine Liste mit <Künstler:Albumname:AlbumId>. Antworte auf Deutsch.
            """;

        _logger.LogInformation("Fetching album ratings from AI for {Count} albums", albums.Count);

        var content = await _aiChatService.ChatAsync(systemPrompt, userMessage);
        if (string.IsNullOrEmpty(content))
            return result;

        _logger.LogInformation("AI response for ratings: {Response}", content);

        return ParseRatingResponse(content);
    }

    private List<AlbumRatingDto> ParseRatingResponse(string content)
    {
        var result = new List<AlbumRatingDto>();

        try
        {
            // Try to extract JSON array from the content
            var jsonStart = content.IndexOf('[');
            var jsonEnd = content.LastIndexOf(']');

            if (jsonStart >= 0 && jsonEnd > jsonStart)
            {
                var jsonArray = content.Substring(jsonStart, jsonEnd - jsonStart + 1);

                using var ratingsDoc = JsonDocument.Parse(jsonArray);
                foreach (var item in ratingsDoc.RootElement.EnumerateArray())
                {
                    string? albumId = null;

                    if (item.TryGetProperty("albumId", out var albumIdElement))
                    {
                        albumId = albumIdElement.ValueKind == JsonValueKind.Number
                            ? albumIdElement.GetInt64().ToString()
                            : albumIdElement.GetString();
                    }

                    if (!string.IsNullOrEmpty(albumId))
                    {
                        int? userScore = null;
                        int? criticsScore = null;

                        if (item.TryGetProperty("userScore", out var userScoreElement) &&
                            userScoreElement.ValueKind == JsonValueKind.Number)
                        {
                            userScore = userScoreElement.GetInt32();
                        }

                        if (item.TryGetProperty("criticsScore", out var criticsScoreElement) &&
                            criticsScoreElement.ValueKind == JsonValueKind.Number)
                        {
                            criticsScore = criticsScoreElement.GetInt32();
                        }

                        result.Add(new AlbumRatingDto
                        {
                            AlbumId = albumId,
                            UserScore = userScore,
                            CriticsScore = criticsScore
                        });
                    }
                }
            }
            else
            {
                _logger.LogWarning("Could not find JSON array in AI response: {Content}", content);
            }
        }
        catch (JsonException ex)
        {
            _logger.LogError(ex, "Failed to parse AI rating response");
        }

        return result;
    }

    private static string EscapeField(string value)
    {
        if (string.IsNullOrEmpty(value))
            return "";
        // Escape colons and commas to avoid parsing issues
        return value.Replace(":", "\\:").Replace(",", "\\,");
    }
}

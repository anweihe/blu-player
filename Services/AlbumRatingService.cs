using System.Net.Http.Headers;
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
    private readonly ISettingsService _settingsService;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<AlbumRatingService> _logger;

    private const string MistralAgentId = "ag_019be5da3459715385dd0d5dad010869";
    private const int CacheDurationDays = 28; // 4 weeks

    public AlbumRatingService(
        BluesoundDbContext context,
        ISettingsService settingsService,
        IHttpClientFactory httpClientFactory,
        ILogger<AlbumRatingService> logger)
    {
        _context = context;
        _settingsService = settingsService;
        _httpClientFactory = httpClientFactory;
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

        // 2. Fetch missing ratings from Mistral
        if (albumsToFetch.Count > 0)
        {
            var freshRatings = await FetchFromMistralAsync(albumsToFetch);

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

    private async Task<List<AlbumRatingDto>> FetchFromMistralAsync(List<AlbumRatingRequest> albums)
    {
        var result = new List<AlbumRatingDto>();

        try
        {
            var apiKey = await _settingsService.GetMistralApiKeyAsync();
            if (string.IsNullOrEmpty(apiKey))
            {
                _logger.LogWarning("Mistral API key not configured, skipping rating fetch");
                return result;
            }

            // Format: "Artist:Album:Id,Artist:Album:Id,..."
            var content = string.Join(",", albums.Select(a =>
                $"{EscapeField(a.Artist)}:{EscapeField(a.Title)}:{a.AlbumId}"));

            var requestBody = new
            {
                agent_id = MistralAgentId,
                messages = new[]
                {
                    new { role = "user", content = content }
                }
            };

            var httpClient = _httpClientFactory.CreateClient();
            httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
            httpClient.Timeout = TimeSpan.FromSeconds(60);

            var response = await httpClient.PostAsJsonAsync(
                "https://api.mistral.ai/v1/agents/completions",
                requestBody);

            if (!response.IsSuccessStatusCode)
            {
                var errorBody = await response.Content.ReadAsStringAsync();
                _logger.LogError("Mistral API error: {StatusCode} - {Body}", response.StatusCode, errorBody);
                return result;
            }

            var responseText = await response.Content.ReadAsStringAsync();
            _logger.LogInformation("Mistral API response: {Response}", responseText);

            // Parse the response
            result = ParseMistralResponse(responseText, albums);
        }
        catch (TaskCanceledException)
        {
            _logger.LogWarning("Mistral API request timed out");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to fetch ratings from Mistral API");
        }

        return result;
    }

    private List<AlbumRatingDto> ParseMistralResponse(string responseText, List<AlbumRatingRequest> albums)
    {
        var result = new List<AlbumRatingDto>();

        try
        {
            using var doc = JsonDocument.Parse(responseText);
            var root = doc.RootElement;

            // Navigate to the content - try multiple response formats
            string? content = null;

            // Format 1: Mistral conversation API uses "outputs" array
            if (root.TryGetProperty("outputs", out var outputs) && outputs.GetArrayLength() > 0)
            {
                var firstOutput = outputs[0];
                if (firstOutput.TryGetProperty("content", out var contentElement))
                {
                    content = contentElement.GetString();
                }
            }
            // Format 2: Mistral agents/completions API uses "choices" array
            else if (root.TryGetProperty("choices", out var choices) && choices.GetArrayLength() > 0)
            {
                var firstChoice = choices[0];
                if (firstChoice.TryGetProperty("message", out var message) &&
                    message.TryGetProperty("content", out var contentElement))
                {
                    content = contentElement.GetString();
                }
            }

            if (string.IsNullOrEmpty(content))
            {
                // Log the actual structure for debugging
                var properties = string.Join(", ", root.EnumerateObject().Select(p => p.Name));
                _logger.LogWarning("No content in Mistral response. Root properties: {Properties}", properties);
                return result;
            }

            // Try to extract JSON array from the content
            // The agent returns JSON like: [{"albumId":123,"userScore":8,"criticsScore":7},...]
            var jsonStart = content.IndexOf('[');
            var jsonEnd = content.LastIndexOf(']');

            if (jsonStart >= 0 && jsonEnd > jsonStart)
            {
                var jsonArray = content.Substring(jsonStart, jsonEnd - jsonStart + 1);

                // Parse with JsonDocument to handle albumId as number or string
                using var ratingsDoc = JsonDocument.Parse(jsonArray);
                foreach (var item in ratingsDoc.RootElement.EnumerateArray())
                {
                    string? albumId = null;

                    // Handle albumId as string or number
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
                _logger.LogWarning("Could not find JSON array in Mistral response: {Content}", content);
            }
        }
        catch (JsonException ex)
        {
            _logger.LogError(ex, "Failed to parse Mistral JSON response");
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

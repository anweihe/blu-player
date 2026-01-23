using System.Net.Http.Headers;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using BluesoundWeb.Data;
using BluesoundWeb.Models;

namespace BluesoundWeb.Services;

public interface IAlbumInfoService
{
    Task<AlbumInfoDto?> GetAlbumInfoAsync(string albumId, string artist, string title);
}

public class AlbumInfoService : IAlbumInfoService
{
    private readonly BluesoundDbContext _context;
    private readonly ISettingsService _settingsService;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<AlbumInfoService> _logger;

    private const string MistralAgentId = "ag_019be5dea96577adb582ddbcec22305f";
    private const int CacheDurationDays = 28; // 4 weeks

    public AlbumInfoService(
        BluesoundDbContext context,
        ISettingsService settingsService,
        IHttpClientFactory httpClientFactory,
        ILogger<AlbumInfoService> logger)
    {
        _context = context;
        _settingsService = settingsService;
        _httpClientFactory = httpClientFactory;
        _logger = logger;
    }

    public async Task<AlbumInfoDto?> GetAlbumInfoAsync(string albumId, string artist, string title)
    {
        if (string.IsNullOrWhiteSpace(albumId) || string.IsNullOrWhiteSpace(title))
            return null;

        var now = DateTime.UtcNow;

        // 1. Check database cache
        var cached = await _context.AlbumInfos
            .FirstOrDefaultAsync(i => i.AlbumId == albumId);

        if (cached != null && cached.ExpiresAt > now)
        {
            // Cache hit: valid
            _logger.LogInformation("Album info cache hit for: {Artist} - {Title}", artist, title);
            return new AlbumInfoDto { Summary = cached.Summary, Style = cached.Style };
        }

        // 2. Fetch from Mistral API
        var info = await FetchFromMistralAsync(albumId, artist, title);
        if (info == null)
            return null;

        // 3. Save to database
        if (cached != null)
        {
            // Update existing
            cached.Artist = artist;
            cached.Title = title;
            cached.Summary = info.Summary;
            cached.Style = info.Style;
            cached.FetchedAt = now;
            cached.ExpiresAt = now.AddDays(CacheDurationDays);
        }
        else
        {
            // Insert new
            _context.AlbumInfos.Add(new AlbumInfo
            {
                AlbumId = albumId,
                Artist = artist,
                Title = title,
                Summary = info.Summary,
                Style = info.Style,
                FetchedAt = now,
                ExpiresAt = now.AddDays(CacheDurationDays)
            });
        }

        try
        {
            await _context.SaveChangesAsync();
            _logger.LogInformation("Saved album info to database for: {Artist} - {Title}", artist, title);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to save album info to database");
        }

        return info;
    }

    private async Task<AlbumInfoDto?> FetchFromMistralAsync(string albumId, string artist, string title)
    {
        try
        {
            var apiKey = await _settingsService.GetMistralApiKeyAsync();
            if (string.IsNullOrEmpty(apiKey))
            {
                _logger.LogWarning("Mistral API key not configured");
                return null;
            }

            // Format: "Artist:Album:AlbumId"
            var content = $"{artist}:{title}:{albumId}";

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

            var jsonContent = JsonSerializer.Serialize(requestBody);
            var httpContent = new StringContent(jsonContent, System.Text.Encoding.UTF8, "application/json");

            _logger.LogInformation("Calling Mistral AI Agent for album: {Artist} - {Title}", artist, title);

            var response = await httpClient.PostAsync("https://api.mistral.ai/v1/agents/completions", httpContent);
            var responseText = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogError("Mistral API error: {StatusCode} - {Response}", response.StatusCode, responseText);
                return null;
            }

            return ParseMistralResponse(responseText);
        }
        catch (TaskCanceledException)
        {
            _logger.LogWarning("Mistral API request timed out");
            return null;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to fetch album info from Mistral API");
            return null;
        }
    }

    private AlbumInfoDto? ParseMistralResponse(string responseText)
    {
        try
        {
            using var doc = JsonDocument.Parse(responseText);
            var root = doc.RootElement;

            // Navigate: choices[0].message.content
            if (root.TryGetProperty("choices", out var choices) &&
                choices.GetArrayLength() > 0)
            {
                var firstChoice = choices[0];
                if (firstChoice.TryGetProperty("message", out var message) &&
                    message.TryGetProperty("content", out var content))
                {
                    var contentText = content.GetString();
                    if (contentText != null)
                    {
                        // Extract album info from JSON response
                        return ExtractAlbumInfo(contentText);
                    }
                }
            }

            _logger.LogWarning("Unexpected Mistral response structure: {Response}", responseText);
            return null;
        }
        catch (JsonException ex)
        {
            _logger.LogError(ex, "Failed to parse Mistral response: {Response}", responseText);
            return null;
        }
    }

    private AlbumInfoDto ExtractAlbumInfo(string contentText)
    {
        // Remove markdown code block if present (```json ... ```)
        var text = contentText.Trim();
        if (text.StartsWith("```"))
        {
            var endIndex = text.IndexOf("```", 3);
            if (endIndex > 0)
            {
                // Extract content between ``` markers
                var startIndex = text.IndexOf('\n', 3);
                if (startIndex > 0 && startIndex < endIndex)
                {
                    text = text.Substring(startIndex + 1, endIndex - startIndex - 1).Trim();
                }
            }
        }

        // Try to parse as JSON and extract summary and style
        // First try with original text, then with single quotes converted
        foreach (var jsonText in new[] { text, ConvertPythonDictToJson(text) })
        {
            try
            {
                using var jsonDoc = JsonDocument.Parse(jsonText);
                var result = new AlbumInfoDto();

                if (jsonDoc.RootElement.TryGetProperty("summary", out var summary))
                {
                    result.Summary = summary.GetString();
                }

                if (jsonDoc.RootElement.TryGetProperty("style", out var style))
                {
                    result.Style = style.GetString();
                }

                // If we got at least summary, return the DTO
                if (result.Summary != null)
                {
                    return result;
                }
            }
            catch (JsonException)
            {
                // Try next format
            }
        }

        return new AlbumInfoDto { Summary = text };
    }

    /// <summary>
    /// Convert Python-style dict with single quotes to valid JSON with double quotes.
    /// Handles the pattern: { 'key': 'value', ... }
    /// </summary>
    private static string ConvertPythonDictToJson(string text)
    {
        if (string.IsNullOrEmpty(text) || !text.Contains("'"))
            return text;

        var result = new System.Text.StringBuilder();
        bool inString = false;
        char stringDelimiter = '\0';

        for (int i = 0; i < text.Length; i++)
        {
            char c = text[i];

            if (!inString)
            {
                if (c == '\'')
                {
                    // Start of a single-quoted string, convert to double quote
                    result.Append('"');
                    inString = true;
                    stringDelimiter = '\'';
                }
                else if (c == '"')
                {
                    // Start of a double-quoted string
                    result.Append(c);
                    inString = true;
                    stringDelimiter = '"';
                }
                else
                {
                    result.Append(c);
                }
            }
            else
            {
                // Inside a string
                if (c == stringDelimiter)
                {
                    // Check for escape
                    if (i > 0 && text[i - 1] == '\\')
                    {
                        result.Append(c);
                    }
                    else
                    {
                        // End of string
                        result.Append(stringDelimiter == '\'' ? '"' : c);
                        inString = false;
                        stringDelimiter = '\0';
                    }
                }
                else if (c == '"' && stringDelimiter == '\'')
                {
                    // Escape double quotes inside single-quoted strings
                    result.Append("\\\"");
                }
                else
                {
                    result.Append(c);
                }
            }
        }

        return result.ToString();
    }
}

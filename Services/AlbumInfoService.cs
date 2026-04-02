using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using BluesoundWeb.Data;
using BluesoundWeb.Models;

namespace BluesoundWeb.Services;

public interface IAlbumInfoService
{
    Task<AlbumInfoDto?> GetAlbumInfoAsync(string albumId, string artist, string title, string language = "de");
}

public class AlbumInfoService : IAlbumInfoService
{
    private readonly BluesoundDbContext _context;
    private readonly IAiChatService _aiChatService;
    private readonly ILogger<AlbumInfoService> _logger;

    private const int CacheDurationDays = 28; // 4 weeks

    public AlbumInfoService(
        BluesoundDbContext context,
        IAiChatService aiChatService,
        ILogger<AlbumInfoService> logger)
    {
        _context = context;
        _aiChatService = aiChatService;
        _logger = logger;
    }

    public async Task<AlbumInfoDto?> GetAlbumInfoAsync(string albumId, string artist, string title, string language = "de")
    {
        if (string.IsNullOrWhiteSpace(albumId) || string.IsNullOrWhiteSpace(title))
            return null;

        // Normalize language
        var lang = language?.StartsWith("de") == true ? "de" : "en";
        var now = DateTime.UtcNow;

        // 1. Check database cache (per language)
        var cached = await _context.AlbumInfos
            .FirstOrDefaultAsync(i => i.AlbumId == albumId && i.Language == lang);

        if (cached != null && cached.ExpiresAt > now)
        {
            // Cache hit: valid
            _logger.LogInformation("Album info cache hit for: {Artist} - {Title} ({Language})", artist, title, lang);
            return new AlbumInfoDto { Summary = cached.Summary, Style = cached.Style };
        }

        // 2. Fetch from AI provider
        var info = await FetchFromAiAsync(albumId, artist, title, lang);
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
                Language = lang,
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

    private async Task<AlbumInfoDto?> FetchFromAiAsync(string albumId, string artist, string title, string language)
    {
        // Format: "Artist:Album:AlbumId"
        var userMessage = $"{artist}:{title}:{albumId}";

        // System prompt for Album Reception
        var languageName = language == "de" ? "German" : "English";
        var systemPrompt = $$"""
            You are a music editor and a specialist in all kinds of genres.
            Provide a summary of the reception of an album.
            # Request Format
            You receive an album as input with <Artist:AlbumName:AlbumId>.
            # Response Format
            Your response must have this format:
            { 'albumId': <albumId>, 'summary': <summary>, 'style': <style> }
            The summary contains no sub-nodes and has a maximum of 10 sentences.
            Also describe in the style element in two to three sentences what the style of the album is.
            Answer in {{languageName}}.
            """;

        _logger.LogInformation("Fetching album info from AI for: {Artist} - {Title}", artist, title);

        var contentText = await _aiChatService.ChatAsync(systemPrompt, userMessage);
        if (contentText == null)
            return null;

        return ExtractAlbumInfo(contentText);
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

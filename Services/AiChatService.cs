using System.Net.Http.Headers;
using System.Text.Json;

namespace BluesoundWeb.Services;

public interface IAiChatService
{
    Task<string?> ChatAsync(string systemPrompt, string userMessage);
    Task<string> GetActiveProviderAsync();
}

public class AiChatService : IAiChatService
{
    private readonly ISettingsService _settingsService;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<AiChatService> _logger;

    public AiChatService(
        ISettingsService settingsService,
        IHttpClientFactory httpClientFactory,
        ILogger<AiChatService> logger)
    {
        _settingsService = settingsService;
        _httpClientFactory = httpClientFactory;
        _logger = logger;
    }

    public async Task<string> GetActiveProviderAsync()
    {
        return await _settingsService.GetActiveAiProviderAsync();
    }

    public async Task<string?> ChatAsync(string systemPrompt, string userMessage)
    {
        var provider = await _settingsService.GetActiveAiProviderAsync();
        var apiKey = await _settingsService.GetApiKeyAsync(provider);

        if (string.IsNullOrEmpty(apiKey))
        {
            _logger.LogWarning("No API key configured for active provider: {Provider}", provider);
            return null;
        }

        try
        {
            return provider switch
            {
                "anthropic" => await CallAnthropicAsync(apiKey, systemPrompt, userMessage),
                "openai" => await CallOpenAiAsync(apiKey, systemPrompt, userMessage),
                _ => await CallMistralAsync(apiKey, systemPrompt, userMessage)
            };
        }
        catch (TaskCanceledException)
        {
            _logger.LogWarning("{Provider} API request timed out", provider);
            return null;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to call {Provider} API", provider);
            return null;
        }
    }

    private async Task<string?> CallMistralAsync(string apiKey, string systemPrompt, string userMessage)
    {
        var requestBody = new
        {
            model = "mistral-small-latest",
            messages = new[]
            {
                new { role = "system", content = systemPrompt },
                new { role = "user", content = userMessage }
            }
        };

        return await CallOpenAiCompatibleAsync(
            apiKey, "https://api.mistral.ai/v1/chat/completions", requestBody, "Mistral");
    }

    private async Task<string?> CallOpenAiAsync(string apiKey, string systemPrompt, string userMessage)
    {
        var requestBody = new
        {
            model = "gpt-4o-mini",
            messages = new[]
            {
                new { role = "system", content = systemPrompt },
                new { role = "user", content = userMessage }
            }
        };

        return await CallOpenAiCompatibleAsync(
            apiKey, "https://api.openai.com/v1/chat/completions", requestBody, "OpenAI");
    }

    private async Task<string?> CallOpenAiCompatibleAsync(string apiKey, string url, object requestBody, string providerName)
    {
        var httpClient = _httpClientFactory.CreateClient();
        httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
        httpClient.Timeout = TimeSpan.FromSeconds(60);

        var jsonContent = JsonSerializer.Serialize(requestBody);
        var httpContent = new StringContent(jsonContent, System.Text.Encoding.UTF8, "application/json");

        _logger.LogInformation("Calling {Provider} Chat API", providerName);

        var response = await httpClient.PostAsync(url, httpContent);
        var responseText = await response.Content.ReadAsStringAsync();

        if (!response.IsSuccessStatusCode)
        {
            _logger.LogError("{Provider} API error: {StatusCode} - {Response}", providerName, response.StatusCode, responseText);
            return null;
        }

        return ParseOpenAiCompatibleResponse(responseText, providerName);
    }

    private async Task<string?> CallAnthropicAsync(string apiKey, string systemPrompt, string userMessage)
    {
        var httpClient = _httpClientFactory.CreateClient();
        httpClient.DefaultRequestHeaders.Add("x-api-key", apiKey);
        httpClient.DefaultRequestHeaders.Add("anthropic-version", "2023-06-01");
        httpClient.Timeout = TimeSpan.FromSeconds(60);

        var requestBody = new
        {
            model = "claude-sonnet-4-20250514",
            max_tokens = 1024,
            system = systemPrompt,
            messages = new[]
            {
                new { role = "user", content = userMessage }
            }
        };

        var jsonContent = JsonSerializer.Serialize(requestBody);
        var httpContent = new StringContent(jsonContent, System.Text.Encoding.UTF8, "application/json");

        _logger.LogInformation("Calling Anthropic Chat API");

        var response = await httpClient.PostAsync("https://api.anthropic.com/v1/messages", httpContent);
        var responseText = await response.Content.ReadAsStringAsync();

        if (!response.IsSuccessStatusCode)
        {
            _logger.LogError("Anthropic API error: {StatusCode} - {Response}", response.StatusCode, responseText);
            return null;
        }

        return ParseAnthropicResponse(responseText);
    }

    private string? ParseOpenAiCompatibleResponse(string responseText, string providerName)
    {
        try
        {
            using var doc = JsonDocument.Parse(responseText);
            var root = doc.RootElement;

            if (root.TryGetProperty("choices", out var choices) &&
                choices.GetArrayLength() > 0)
            {
                var firstChoice = choices[0];
                if (firstChoice.TryGetProperty("message", out var message) &&
                    message.TryGetProperty("content", out var content))
                {
                    return content.GetString();
                }
            }

            _logger.LogWarning("Unexpected {Provider} response structure: {Response}", providerName, responseText);
            return null;
        }
        catch (JsonException ex)
        {
            _logger.LogError(ex, "Failed to parse {Provider} response: {Response}", providerName, responseText);
            return null;
        }
    }

    private string? ParseAnthropicResponse(string responseText)
    {
        try
        {
            using var doc = JsonDocument.Parse(responseText);
            var root = doc.RootElement;

            if (root.TryGetProperty("content", out var content) &&
                content.GetArrayLength() > 0)
            {
                var firstBlock = content[0];
                if (firstBlock.TryGetProperty("text", out var text))
                {
                    return text.GetString();
                }
            }

            _logger.LogWarning("Unexpected Anthropic response structure: {Response}", responseText);
            return null;
        }
        catch (JsonException ex)
        {
            _logger.LogError(ex, "Failed to parse Anthropic response: {Response}", responseText);
            return null;
        }
    }
}

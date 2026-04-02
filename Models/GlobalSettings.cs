namespace BluesoundWeb.Models;

/// <summary>
/// Stores global application settings (singleton, Id = 1)
/// </summary>
public class GlobalSettings
{
    public int Id { get; set; }

    /// <summary>
    /// Encrypted Mistral AI API key (AES-256 encrypted, Base64 encoded)
    /// </summary>
    public string? MistralApiKeyEncrypted { get; set; }

    /// <summary>
    /// Timestamp when Mistral API key was last updated
    /// </summary>
    public DateTime? MistralApiKeyUpdatedAt { get; set; }

    /// <summary>
    /// Encrypted Anthropic API key (AES-256 encrypted, Base64 encoded)
    /// </summary>
    public string? AnthropicApiKeyEncrypted { get; set; }

    /// <summary>
    /// Timestamp when Anthropic API key was last updated
    /// </summary>
    public DateTime? AnthropicApiKeyUpdatedAt { get; set; }

    /// <summary>
    /// Encrypted OpenAI API key (AES-256 encrypted, Base64 encoded)
    /// </summary>
    public string? OpenAiApiKeyEncrypted { get; set; }

    /// <summary>
    /// Timestamp when OpenAI API key was last updated
    /// </summary>
    public DateTime? OpenAiApiKeyUpdatedAt { get; set; }

    /// <summary>
    /// Active AI provider: "mistral", "anthropic", or "openai"
    /// </summary>
    public string ActiveAiProvider { get; set; } = "mistral";
}

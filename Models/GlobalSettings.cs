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
}

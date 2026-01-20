namespace BluesoundWeb.Models;

/// <summary>
/// Stores Qobuz authentication credentials for a user profile
/// </summary>
public class UserQobuzCredential
{
    public int Id { get; set; }

    /// <summary>
    /// Foreign key to UserProfile
    /// </summary>
    public int UserProfileId { get; set; }

    /// <summary>
    /// Qobuz user ID
    /// </summary>
    public long QobuzUserId { get; set; }

    /// <summary>
    /// Authentication token from Qobuz
    /// </summary>
    public string AuthToken { get; set; } = string.Empty;

    /// <summary>
    /// Display name from Qobuz (optional)
    /// </summary>
    public string? DisplayName { get; set; }

    /// <summary>
    /// Avatar URL from Qobuz (optional)
    /// </summary>
    public string? Avatar { get; set; }

    // Navigation property
    public UserProfile? UserProfile { get; set; }
}

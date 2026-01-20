namespace BluesoundWeb.Models;

/// <summary>
/// Represents a user profile in the application
/// </summary>
public class UserProfile
{
    public int Id { get; set; }

    /// <summary>
    /// Unique string identifier for the profile (e.g., "profile_xxx")
    /// </summary>
    public string ProfileId { get; set; } = string.Empty;

    /// <summary>
    /// Display name of the profile
    /// </summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// When the profile was created
    /// </summary>
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public UserQobuzCredential? QobuzCredential { get; set; }
    public ProfileSettings? Settings { get; set; }
}

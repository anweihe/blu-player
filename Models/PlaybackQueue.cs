namespace BluesoundWeb.Models;

/// <summary>
/// Represents a playback queue for a user profile
/// </summary>
public class PlaybackQueue
{
    public int Id { get; set; }

    /// <summary>
    /// Foreign key to UserProfile
    /// </summary>
    public int UserProfileId { get; set; }

    /// <summary>
    /// Source type: "playlist" or "album"
    /// </summary>
    public string? SourceType { get; set; }

    /// <summary>
    /// Qobuz Playlist or Album ID
    /// </summary>
    public string? SourceId { get; set; }

    /// <summary>
    /// Display name of the source (Playlist/Album name)
    /// </summary>
    public string? SourceName { get; set; }

    /// <summary>
    /// Current position in the queue (0-based index)
    /// </summary>
    public int CurrentIndex { get; set; }

    /// <summary>
    /// When the queue was last updated
    /// </summary>
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public UserProfile UserProfile { get; set; } = null!;
    public List<QueueTrack> Tracks { get; set; } = new();
}

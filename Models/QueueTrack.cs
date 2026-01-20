namespace BluesoundWeb.Models;

/// <summary>
/// Represents a track in the playback queue
/// </summary>
public class QueueTrack
{
    public int Id { get; set; }

    /// <summary>
    /// Foreign key to PlaybackQueue
    /// </summary>
    public int PlaybackQueueId { get; set; }

    /// <summary>
    /// Position in the queue (0-based)
    /// </summary>
    public int Position { get; set; }

    /// <summary>
    /// Qobuz Track ID
    /// </summary>
    public long QobuzTrackId { get; set; }

    /// <summary>
    /// Track title
    /// </summary>
    public string Title { get; set; } = string.Empty;

    /// <summary>
    /// Artist name
    /// </summary>
    public string? ArtistName { get; set; }

    /// <summary>
    /// Album title
    /// </summary>
    public string? AlbumTitle { get; set; }

    /// <summary>
    /// Album cover URL
    /// </summary>
    public string? AlbumCover { get; set; }

    /// <summary>
    /// Track duration in seconds
    /// </summary>
    public int Duration { get; set; }

    /// <summary>
    /// Formatted duration (e.g., "3:42")
    /// </summary>
    public string? FormattedDuration { get; set; }

    /// <summary>
    /// Whether the track is Hi-Res
    /// </summary>
    public bool IsHiRes { get; set; }

    /// <summary>
    /// Quality label (e.g., "Hi-Res")
    /// </summary>
    public string? QualityLabel { get; set; }

    /// <summary>
    /// Whether the track is streamable
    /// </summary>
    public bool IsStreamable { get; set; }

    /// <summary>
    /// Track number on the album/disc
    /// </summary>
    public int TrackNumber { get; set; }

    /// <summary>
    /// Disc/media number
    /// </summary>
    public int MediaNumber { get; set; }

    // Navigation property
    public PlaybackQueue PlaybackQueue { get; set; } = null!;
}

namespace BluesoundWeb.Models;

/// <summary>
/// TuneIn radio station history entry
/// </summary>
public class TuneInHistoryEntry
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;      // Station name
    public string? ImageUrl { get; set; }                   // Station logo
    public string ActionUrl { get; set; } = string.Empty;   // Stream URL (unique identifier)
    public DateTime PlayedAt { get; set; }
}

/// <summary>
/// Radio Paradise channel history entry
/// </summary>
public class RadioParadiseHistoryEntry
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;      // Channel name (Main, Mellow, etc.)
    public string? ImageUrl { get; set; }
    public string ActionUrl { get; set; } = string.Empty;   // Stream URL (unique identifier)
    public string? Quality { get; set; }                    // MQA, FLAC, etc.
    public DateTime PlayedAt { get; set; }
}

/// <summary>
/// Qobuz album history entry
/// </summary>
public class QobuzAlbumHistoryEntry
{
    public int Id { get; set; }
    public string AlbumId { get; set; } = string.Empty;     // Qobuz Album ID (unique identifier)
    public string AlbumName { get; set; } = string.Empty;
    public string? Artist { get; set; }
    public string? CoverUrl { get; set; }
    public DateTime PlayedAt { get; set; }
}

/// <summary>
/// Qobuz playlist history entry
/// </summary>
public class QobuzPlaylistHistoryEntry
{
    public int Id { get; set; }
    public string PlaylistId { get; set; } = string.Empty;  // Qobuz Playlist ID (unique identifier)
    public string PlaylistName { get; set; } = string.Empty;
    public string? CoverUrl { get; set; }
    public DateTime PlayedAt { get; set; }
    public List<QobuzPlaylistTrack> Tracks { get; set; } = new();
}

/// <summary>
/// Track within a saved playlist (for quick playback)
/// </summary>
public class QobuzPlaylistTrack
{
    public int Id { get; set; }
    public int PlaylistHistoryEntryId { get; set; }
    public string TrackId { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string? Artist { get; set; }
    public int Position { get; set; }

    public QobuzPlaylistHistoryEntry? PlaylistHistoryEntry { get; set; }
}

/// <summary>
/// DTO for returning all history data to the frontend
/// </summary>
public class ListeningHistoryResponse
{
    public List<TuneInHistoryDto> TuneIn { get; set; } = new();
    public List<RadioParadiseHistoryDto> RadioParadise { get; set; } = new();
    public List<QobuzAlbumHistoryDto> QobuzAlbums { get; set; } = new();
    public List<QobuzPlaylistHistoryDto> QobuzPlaylists { get; set; } = new();
}

public class TuneInHistoryDto
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? ImageUrl { get; set; }
    public string ActionUrl { get; set; } = string.Empty;
}

public class RadioParadiseHistoryDto
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? ImageUrl { get; set; }
    public string ActionUrl { get; set; } = string.Empty;
    public string? Quality { get; set; }
}

public class QobuzAlbumHistoryDto
{
    public int Id { get; set; }
    public string AlbumId { get; set; } = string.Empty;
    public string AlbumName { get; set; } = string.Empty;
    public string? Artist { get; set; }
    public string? CoverUrl { get; set; }
}

public class QobuzPlaylistHistoryDto
{
    public int Id { get; set; }
    public string PlaylistId { get; set; } = string.Empty;
    public string PlaylistName { get; set; } = string.Empty;
    public string? CoverUrl { get; set; }
    public List<QobuzPlaylistTrackDto> Tracks { get; set; } = new();
}

public class QobuzPlaylistTrackDto
{
    public string TrackId { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string? Artist { get; set; }
    public int Position { get; set; }
}

/// <summary>
/// Request DTOs for saving history
/// </summary>
public class SaveTuneInHistoryRequest
{
    public string Title { get; set; } = string.Empty;
    public string? ImageUrl { get; set; }
    public string ActionUrl { get; set; } = string.Empty;
}

public class SaveRadioParadiseHistoryRequest
{
    public string Title { get; set; } = string.Empty;
    public string? ImageUrl { get; set; }
    public string ActionUrl { get; set; } = string.Empty;
    public string? Quality { get; set; }
}

public class SaveQobuzAlbumHistoryRequest
{
    public string AlbumId { get; set; } = string.Empty;
    public string AlbumName { get; set; } = string.Empty;
    public string? Artist { get; set; }
    public string? CoverUrl { get; set; }
}

public class SaveQobuzPlaylistHistoryRequest
{
    public string PlaylistId { get; set; } = string.Empty;
    public string PlaylistName { get; set; } = string.Empty;
    public string? CoverUrl { get; set; }
    public List<SavePlaylistTrackRequest>? Tracks { get; set; }
}

public class SavePlaylistTrackRequest
{
    public string TrackId { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string? Artist { get; set; }
}

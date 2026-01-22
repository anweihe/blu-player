using BluesoundWeb.Data;
using BluesoundWeb.Models;
using Microsoft.EntityFrameworkCore;

namespace BluesoundWeb.Services;

public interface IListeningHistoryService
{
    Task SaveTuneInAsync(string title, string? imageUrl, string actionUrl);
    Task SaveRadioParadiseAsync(string title, string? imageUrl, string actionUrl, string? quality);
    Task SaveQobuzAlbumAsync(string albumId, string albumName, string? artist, string? coverUrl);
    Task SaveQobuzPlaylistAsync(string playlistId, string playlistName, string? coverUrl, List<SavePlaylistTrackRequest>? tracks);
    Task<ListeningHistoryResponse> GetAllHistoryAsync();
}

public class ListeningHistoryService : IListeningHistoryService
{
    private readonly BluesoundDbContext _dbContext;
    private readonly ILogger<ListeningHistoryService> _logger;
    private const int MaxHistoryEntries = 5;

    public ListeningHistoryService(BluesoundDbContext dbContext, ILogger<ListeningHistoryService> logger)
    {
        _dbContext = dbContext;
        _logger = logger;
    }

    public async Task SaveTuneInAsync(string title, string? imageUrl, string actionUrl)
    {
        if (string.IsNullOrEmpty(actionUrl)) return;

        try
        {
            // Check if entry already exists (upsert by ActionUrl)
            var existing = await _dbContext.TuneInHistory
                .FirstOrDefaultAsync(e => e.ActionUrl == actionUrl);

            if (existing != null)
            {
                // Update existing entry
                existing.Title = title;
                existing.ImageUrl = imageUrl;
                existing.PlayedAt = DateTime.UtcNow;
            }
            else
            {
                // Add new entry
                _dbContext.TuneInHistory.Add(new TuneInHistoryEntry
                {
                    Title = title,
                    ImageUrl = imageUrl,
                    ActionUrl = actionUrl,
                    PlayedAt = DateTime.UtcNow
                });

                // Enforce limit - remove oldest entries beyond MaxHistoryEntries
                var count = await _dbContext.TuneInHistory.CountAsync();
                if (count >= MaxHistoryEntries)
                {
                    var oldestEntries = await _dbContext.TuneInHistory
                        .OrderBy(e => e.PlayedAt)
                        .Take(count - MaxHistoryEntries + 1)
                        .ToListAsync();
                    _dbContext.TuneInHistory.RemoveRange(oldestEntries);
                }
            }

            await _dbContext.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to save TuneIn history entry: {Title}", title);
        }
    }

    public async Task SaveRadioParadiseAsync(string title, string? imageUrl, string actionUrl, string? quality)
    {
        if (string.IsNullOrEmpty(actionUrl)) return;

        try
        {
            // Check if entry already exists (upsert by ActionUrl)
            var existing = await _dbContext.RadioParadiseHistory
                .FirstOrDefaultAsync(e => e.ActionUrl == actionUrl);

            if (existing != null)
            {
                // Update existing entry
                existing.Title = title;
                existing.ImageUrl = imageUrl;
                existing.Quality = quality;
                existing.PlayedAt = DateTime.UtcNow;
            }
            else
            {
                // Add new entry
                _dbContext.RadioParadiseHistory.Add(new RadioParadiseHistoryEntry
                {
                    Title = title,
                    ImageUrl = imageUrl,
                    ActionUrl = actionUrl,
                    Quality = quality,
                    PlayedAt = DateTime.UtcNow
                });

                // Enforce limit
                var count = await _dbContext.RadioParadiseHistory.CountAsync();
                if (count >= MaxHistoryEntries)
                {
                    var oldestEntries = await _dbContext.RadioParadiseHistory
                        .OrderBy(e => e.PlayedAt)
                        .Take(count - MaxHistoryEntries + 1)
                        .ToListAsync();
                    _dbContext.RadioParadiseHistory.RemoveRange(oldestEntries);
                }
            }

            await _dbContext.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to save Radio Paradise history entry: {Title}", title);
        }
    }

    public async Task SaveQobuzAlbumAsync(string albumId, string albumName, string? artist, string? coverUrl)
    {
        if (string.IsNullOrEmpty(albumId)) return;

        try
        {
            // Check if entry already exists (upsert by AlbumId)
            var existing = await _dbContext.QobuzAlbumHistory
                .FirstOrDefaultAsync(e => e.AlbumId == albumId);

            if (existing != null)
            {
                // Update existing entry
                existing.AlbumName = albumName;
                existing.Artist = artist;
                existing.CoverUrl = coverUrl;
                existing.PlayedAt = DateTime.UtcNow;
            }
            else
            {
                // Add new entry
                _dbContext.QobuzAlbumHistory.Add(new QobuzAlbumHistoryEntry
                {
                    AlbumId = albumId,
                    AlbumName = albumName,
                    Artist = artist,
                    CoverUrl = coverUrl,
                    PlayedAt = DateTime.UtcNow
                });

                // Enforce limit
                var count = await _dbContext.QobuzAlbumHistory.CountAsync();
                if (count >= MaxHistoryEntries)
                {
                    var oldestEntries = await _dbContext.QobuzAlbumHistory
                        .OrderBy(e => e.PlayedAt)
                        .Take(count - MaxHistoryEntries + 1)
                        .ToListAsync();
                    _dbContext.QobuzAlbumHistory.RemoveRange(oldestEntries);
                }
            }

            await _dbContext.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to save Qobuz album history entry: {AlbumId}", albumId);
        }
    }

    public async Task SaveQobuzPlaylistAsync(string playlistId, string playlistName, string? coverUrl, List<SavePlaylistTrackRequest>? tracks)
    {
        if (string.IsNullOrEmpty(playlistId)) return;

        try
        {
            // Check if entry already exists (upsert by PlaylistId)
            var existing = await _dbContext.QobuzPlaylistHistory
                .Include(e => e.Tracks)
                .FirstOrDefaultAsync(e => e.PlaylistId == playlistId);

            if (existing != null)
            {
                // Update existing entry
                existing.PlaylistName = playlistName;
                existing.CoverUrl = coverUrl;
                existing.PlayedAt = DateTime.UtcNow;

                // Update tracks if provided
                if (tracks != null && tracks.Count > 0)
                {
                    // Remove old tracks
                    _dbContext.QobuzPlaylistTracks.RemoveRange(existing.Tracks);

                    // Add new tracks
                    for (int i = 0; i < Math.Min(tracks.Count, 10); i++)
                    {
                        existing.Tracks.Add(new QobuzPlaylistTrack
                        {
                            TrackId = tracks[i].TrackId,
                            Title = tracks[i].Title,
                            Artist = tracks[i].Artist,
                            Position = i
                        });
                    }
                }
            }
            else
            {
                // Add new entry
                var entry = new QobuzPlaylistHistoryEntry
                {
                    PlaylistId = playlistId,
                    PlaylistName = playlistName,
                    CoverUrl = coverUrl,
                    PlayedAt = DateTime.UtcNow
                };

                // Add tracks if provided
                if (tracks != null && tracks.Count > 0)
                {
                    for (int i = 0; i < Math.Min(tracks.Count, 10); i++)
                    {
                        entry.Tracks.Add(new QobuzPlaylistTrack
                        {
                            TrackId = tracks[i].TrackId,
                            Title = tracks[i].Title,
                            Artist = tracks[i].Artist,
                            Position = i
                        });
                    }
                }

                _dbContext.QobuzPlaylistHistory.Add(entry);

                // Enforce limit
                var count = await _dbContext.QobuzPlaylistHistory.CountAsync();
                if (count >= MaxHistoryEntries)
                {
                    var oldestEntries = await _dbContext.QobuzPlaylistHistory
                        .Include(e => e.Tracks)
                        .OrderBy(e => e.PlayedAt)
                        .Take(count - MaxHistoryEntries + 1)
                        .ToListAsync();
                    _dbContext.QobuzPlaylistHistory.RemoveRange(oldestEntries);
                }
            }

            await _dbContext.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to save Qobuz playlist history entry: {PlaylistId}", playlistId);
        }
    }

    public async Task<ListeningHistoryResponse> GetAllHistoryAsync()
    {
        var response = new ListeningHistoryResponse();

        try
        {
            // Get TuneIn history (most recent first)
            var tuneInHistory = await _dbContext.TuneInHistory
                .OrderByDescending(e => e.PlayedAt)
                .Take(MaxHistoryEntries)
                .ToListAsync();

            response.TuneIn = tuneInHistory.Select(e => new TuneInHistoryDto
            {
                Id = e.Id,
                Title = e.Title,
                ImageUrl = e.ImageUrl,
                ActionUrl = e.ActionUrl
            }).ToList();

            // Get Radio Paradise history
            var rpHistory = await _dbContext.RadioParadiseHistory
                .OrderByDescending(e => e.PlayedAt)
                .Take(MaxHistoryEntries)
                .ToListAsync();

            response.RadioParadise = rpHistory.Select(e => new RadioParadiseHistoryDto
            {
                Id = e.Id,
                Title = e.Title,
                ImageUrl = e.ImageUrl,
                ActionUrl = e.ActionUrl,
                Quality = e.Quality
            }).ToList();

            // Get Qobuz album history
            var albumHistory = await _dbContext.QobuzAlbumHistory
                .OrderByDescending(e => e.PlayedAt)
                .Take(MaxHistoryEntries)
                .ToListAsync();

            response.QobuzAlbums = albumHistory.Select(e => new QobuzAlbumHistoryDto
            {
                Id = e.Id,
                AlbumId = e.AlbumId,
                AlbumName = e.AlbumName,
                Artist = e.Artist,
                CoverUrl = e.CoverUrl
            }).ToList();

            // Get Qobuz playlist history (with tracks)
            var playlistHistory = await _dbContext.QobuzPlaylistHistory
                .Include(e => e.Tracks.OrderBy(t => t.Position))
                .OrderByDescending(e => e.PlayedAt)
                .Take(MaxHistoryEntries)
                .ToListAsync();

            response.QobuzPlaylists = playlistHistory.Select(e => new QobuzPlaylistHistoryDto
            {
                Id = e.Id,
                PlaylistId = e.PlaylistId,
                PlaylistName = e.PlaylistName,
                CoverUrl = e.CoverUrl,
                Tracks = e.Tracks.Select(t => new QobuzPlaylistTrackDto
                {
                    TrackId = t.TrackId,
                    Title = t.Title,
                    Artist = t.Artist,
                    Position = t.Position
                }).ToList()
            }).ToList();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to retrieve listening history");
        }

        return response;
    }
}

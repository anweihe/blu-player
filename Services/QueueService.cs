using Microsoft.EntityFrameworkCore;
using BluesoundWeb.Data;
using BluesoundWeb.Models;

namespace BluesoundWeb.Services;

/// <summary>
/// Service for managing playback queues
/// </summary>
public class QueueService : IQueueService
{
    private readonly BluesoundDbContext _db;

    public QueueService(BluesoundDbContext db)
    {
        _db = db;
    }

    public async Task<PlaybackQueueDto?> GetQueueAsync(string profileId)
    {
        var profile = await _db.UserProfiles
            .FirstOrDefaultAsync(p => p.ProfileId == profileId);

        if (profile == null)
            return null;

        var queue = await _db.PlaybackQueues
            .Include(q => q.Tracks.OrderBy(t => t.Position))
            .FirstOrDefaultAsync(q => q.UserProfileId == profile.Id);

        if (queue == null)
            return null;

        return MapToDto(queue);
    }

    public async Task<PlaybackQueueDto?> SetQueueAsync(string profileId, SetQueueRequest request)
    {
        var profile = await _db.UserProfiles
            .FirstOrDefaultAsync(p => p.ProfileId == profileId);

        if (profile == null)
            return null;

        // Get existing queue or create new one
        var queue = await _db.PlaybackQueues
            .Include(q => q.Tracks)
            .FirstOrDefaultAsync(q => q.UserProfileId == profile.Id);

        if (queue == null)
        {
            queue = new PlaybackQueue
            {
                UserProfileId = profile.Id
            };
            _db.PlaybackQueues.Add(queue);
        }
        else
        {
            // Clear existing tracks
            _db.QueueTracks.RemoveRange(queue.Tracks);
            queue.Tracks.Clear();
        }

        // Update queue properties
        queue.SourceType = request.SourceType;
        queue.SourceId = request.SourceId;
        queue.SourceName = request.SourceName;
        queue.CurrentIndex = request.CurrentIndex;
        queue.UpdatedAt = DateTime.UtcNow;

        // Add new tracks
        for (int i = 0; i < request.Tracks.Count; i++)
        {
            var trackDto = request.Tracks[i];
            var track = new QueueTrack
            {
                Position = i,
                QobuzTrackId = trackDto.Id,
                Title = trackDto.Title,
                ArtistName = trackDto.ArtistName,
                AlbumTitle = trackDto.AlbumTitle,
                AlbumCover = trackDto.AlbumCover,
                Duration = trackDto.Duration,
                FormattedDuration = trackDto.FormattedDuration,
                IsHiRes = trackDto.IsHiRes,
                QualityLabel = trackDto.QualityLabel,
                IsStreamable = trackDto.IsStreamable,
                TrackNumber = trackDto.TrackNumber,
                MediaNumber = trackDto.MediaNumber
            };
            queue.Tracks.Add(track);
        }

        await _db.SaveChangesAsync();

        return MapToDto(queue);
    }

    public async Task<bool> UpdateQueueIndexAsync(string profileId, int currentIndex)
    {
        var profile = await _db.UserProfiles
            .FirstOrDefaultAsync(p => p.ProfileId == profileId);

        if (profile == null)
            return false;

        var queue = await _db.PlaybackQueues
            .FirstOrDefaultAsync(q => q.UserProfileId == profile.Id);

        if (queue == null)
            return false;

        queue.CurrentIndex = currentIndex;
        queue.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<bool> ClearQueueAsync(string profileId)
    {
        var profile = await _db.UserProfiles
            .FirstOrDefaultAsync(p => p.ProfileId == profileId);

        if (profile == null)
            return false;

        var queue = await _db.PlaybackQueues
            .Include(q => q.Tracks)
            .FirstOrDefaultAsync(q => q.UserProfileId == profile.Id);

        if (queue == null)
            return true; // Already no queue

        _db.PlaybackQueues.Remove(queue);
        await _db.SaveChangesAsync();

        return true;
    }

    private static PlaybackQueueDto MapToDto(PlaybackQueue queue)
    {
        return new PlaybackQueueDto
        {
            SourceType = queue.SourceType,
            SourceId = queue.SourceId,
            SourceName = queue.SourceName,
            CurrentIndex = queue.CurrentIndex,
            UpdatedAt = queue.UpdatedAt,
            Tracks = queue.Tracks.OrderBy(t => t.Position).Select(t => new QueueTrackDto
            {
                Position = t.Position,
                Id = t.QobuzTrackId,
                Title = t.Title,
                ArtistName = t.ArtistName,
                AlbumTitle = t.AlbumTitle,
                AlbumCover = t.AlbumCover,
                Duration = t.Duration,
                FormattedDuration = t.FormattedDuration,
                IsHiRes = t.IsHiRes,
                QualityLabel = t.QualityLabel,
                IsStreamable = t.IsStreamable,
                TrackNumber = t.TrackNumber,
                MediaNumber = t.MediaNumber
            }).ToList()
        };
    }
}

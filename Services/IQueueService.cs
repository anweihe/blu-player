using BluesoundWeb.Models;

namespace BluesoundWeb.Services;

/// <summary>
/// Service interface for managing playback queues
/// </summary>
public interface IQueueService
{
    /// <summary>
    /// Gets the playback queue for a profile
    /// </summary>
    Task<PlaybackQueueDto?> GetQueueAsync(string profileId);

    /// <summary>
    /// Sets the playback queue for a profile (replaces existing queue)
    /// </summary>
    Task<PlaybackQueueDto?> SetQueueAsync(string profileId, SetQueueRequest request);

    /// <summary>
    /// Updates the current index in the queue
    /// </summary>
    Task<bool> UpdateQueueIndexAsync(string profileId, int currentIndex);

    /// <summary>
    /// Clears the playback queue for a profile
    /// </summary>
    Task<bool> ClearQueueAsync(string profileId);
}

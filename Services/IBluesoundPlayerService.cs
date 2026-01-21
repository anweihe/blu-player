using BluesoundWeb.Models;

namespace BluesoundWeb.Services;

/// <summary>
/// High-level service for managing Bluesound players.
/// Orchestrates discovery, caching, grouping, and playback control.
/// </summary>
public interface IBluesoundPlayerService
{
    /// <summary>
    /// Discovers players using mDNS or stored players from database.
    /// </summary>
    /// <param name="forceRefresh">Force full mDNS discovery, save to database</param>
    /// <param name="skipCache">Skip memory cache but use stored players if available</param>
    /// <returns>List of discovered players</returns>
    Task<List<BluesoundPlayer>> DiscoverPlayersAsync(bool forceRefresh = false, bool skipCache = false);

    /// <summary>
    /// Refreshes status of known/cached players without mDNS discovery.
    /// Falls back to full discovery if no cached players exist.
    /// </summary>
    /// <returns>List of online players</returns>
    Task<List<BluesoundPlayer>> RefreshKnownPlayersAsync();

    /// <summary>
    /// Gets the current playback status from a player.
    /// </summary>
    Task<PlaybackStatus?> GetPlaybackStatusAsync(string ip, int port = 11000);

    /// <summary>
    /// Organizes players into groups (multi-room, stereo pairs, singles).
    /// Filters out secondary stereo pair speakers.
    /// </summary>
    List<PlayerGroup> OrganizeIntoGroups(List<BluesoundPlayer> players);

    /// <summary>
    /// Gets players formatted for the selector UI (footer popup).
    /// Groups are represented by their master with member details.
    /// </summary>
    List<PlayerSelectorItem> GetPlayersForSelector(List<BluesoundPlayer> players);

    // Playback controls - delegate to IBluesoundApiService

    Task<bool> PlayAsync(string ip, int port = 11000);
    Task<bool> PauseAsync(string ip, int port = 11000);
    Task<bool> StopAsync(string ip, int port = 11000);
    Task<bool> NextTrackAsync(string ip, int port = 11000);
    Task<bool> PreviousTrackAsync(string ip, int port = 11000);
    Task<bool> SetVolumeAsync(string ip, int volume, int port = 11000);
}

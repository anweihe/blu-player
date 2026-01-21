using BluesoundWeb.Models;

namespace BluesoundWeb.Services;

/// <summary>
/// Service for managing stored player data in the database.
/// Enables fast player lookup without mDNS discovery.
/// </summary>
public interface IStoredPlayerService
{
    /// <summary>
    /// Get all stored players from the database
    /// </summary>
    Task<List<StoredPlayer>> GetAllStoredPlayersAsync();

    /// <summary>
    /// Check if there are any stored players in the database
    /// </summary>
    Task<bool> HasStoredPlayersAsync();

    /// <summary>
    /// Save discovered players to the database.
    /// Updates existing players by MAC address or IP, adds new ones.
    /// </summary>
    Task SaveDiscoveredPlayersAsync(List<BluesoundPlayer> players);

    /// <summary>
    /// Mark a player as offline when it doesn't respond
    /// </summary>
    Task MarkPlayerOfflineAsync(string ipAddress);

    /// <summary>
    /// Mark a player as online and update LastSeenAt
    /// </summary>
    Task MarkPlayerOnlineAsync(string ipAddress);

    /// <summary>
    /// Remove a player from the database
    /// </summary>
    Task RemovePlayerAsync(string ipAddress);
}

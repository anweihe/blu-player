using BluesoundWeb.Models;

namespace BluesoundWeb.Services;

/// <summary>
/// Shared cache for discovered Bluesound players.
/// Used by both Index and Qobuz pages to avoid redundant discovery.
/// </summary>
public interface IPlayerCacheService
{
    List<BluesoundPlayer> GetCachedPlayers();
    void SetCachedPlayers(List<BluesoundPlayer> players);
    bool HasRecentCache(TimeSpan maxAge);
    DateTime LastDiscoveryTime { get; }
}

public class PlayerCacheService : IPlayerCacheService
{
    private readonly object _lock = new();
    private List<BluesoundPlayer> _cachedPlayers = new();
    private DateTime _lastDiscovery = DateTime.MinValue;

    public List<BluesoundPlayer> GetCachedPlayers()
    {
        lock (_lock)
        {
            return _cachedPlayers.ToList();
        }
    }

    public void SetCachedPlayers(List<BluesoundPlayer> players)
    {
        lock (_lock)
        {
            _cachedPlayers = players.ToList();
            _lastDiscovery = DateTime.Now;
        }
    }

    public bool HasRecentCache(TimeSpan maxAge)
    {
        lock (_lock)
        {
            return _cachedPlayers.Count > 0 && DateTime.Now - _lastDiscovery < maxAge;
        }
    }

    public DateTime LastDiscoveryTime
    {
        get
        {
            lock (_lock)
            {
                return _lastDiscovery;
            }
        }
    }
}

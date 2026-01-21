using BluesoundWeb.Models;

namespace BluesoundWeb.Services;

/// <summary>
/// High-level service for managing Bluesound players.
/// Consolidates discovery, caching, grouping, and playback logic.
/// </summary>
public class BluesoundPlayerService : IBluesoundPlayerService
{
    private readonly IBluesoundApiService _apiService;
    private readonly IPlayerDiscoveryService _discoveryService;
    private readonly IPlayerCacheService _playerCache;
    private readonly IStoredPlayerService _storedPlayerService;
    private readonly ILogger<BluesoundPlayerService> _logger;

    public BluesoundPlayerService(
        IBluesoundApiService apiService,
        IPlayerDiscoveryService discoveryService,
        IPlayerCacheService playerCache,
        IStoredPlayerService storedPlayerService,
        ILogger<BluesoundPlayerService> logger)
    {
        _apiService = apiService;
        _discoveryService = discoveryService;
        _playerCache = playerCache;
        _storedPlayerService = storedPlayerService;
        _logger = logger;
    }

    /// <inheritdoc />
    public async Task<List<BluesoundPlayer>> DiscoverPlayersAsync(bool forceRefresh = false, bool skipCache = false)
    {
        List<BluesoundPlayer> players;

        if (forceRefresh)
        {
            // Full mDNS discovery requested
            _logger.LogInformation("Starting full mDNS player discovery (refresh requested)...");
            players = await _discoveryService.DiscoverPlayersAsync(TimeSpan.FromSeconds(3));
            _logger.LogInformation("Discovery complete. Found {Count} players.", players.Count);

            // Save discovered players to database
            await _storedPlayerService.SaveDiscoveredPlayersAsync(players);

            // Update memory cache
            _playerCache.SetCachedPlayers(players);
        }
        else if (!skipCache && _playerCache.HasRecentCache(TimeSpan.FromSeconds(30)))
        {
            // Use memory cache if recent
            players = _playerCache.GetCachedPlayers();
            _logger.LogInformation("Using {Count} cached players from memory", players.Count);
        }
        else
        {
            // Check if we have stored players in the database
            var hasStoredPlayers = await _storedPlayerService.HasStoredPlayersAsync();

            if (hasStoredPlayers)
            {
                // Query stored player IPs directly (fast path)
                _logger.LogInformation("Querying stored players from database...");
                players = await QueryStoredPlayersAsync();
                _logger.LogInformation("Quick query complete. Found {Count} online players.", players.Count);

                // Update memory cache
                _playerCache.SetCachedPlayers(players);
            }
            else
            {
                // No stored players - do full mDNS discovery
                _logger.LogInformation("No stored players in database, starting mDNS discovery...");
                players = await _discoveryService.DiscoverPlayersAsync(TimeSpan.FromSeconds(3));
                _logger.LogInformation("Discovery complete. Found {Count} players.", players.Count);

                // Save to database for next time
                await _storedPlayerService.SaveDiscoveredPlayersAsync(players);

                // Update memory cache
                _playerCache.SetCachedPlayers(players);
            }
        }

        return players;
    }

    /// <inheritdoc />
    public async Task<List<BluesoundPlayer>> RefreshKnownPlayersAsync()
    {
        var cachedPlayers = _playerCache.GetCachedPlayers();

        if (cachedPlayers.Count == 0)
        {
            _logger.LogWarning("No known players cached, falling back to full discovery");
            return await DiscoverPlayersAsync(forceRefresh: true);
        }

        var playersToQuery = cachedPlayers.Select(p => (p.IpAddress, p.Port)).ToList();

        try
        {
            _logger.LogInformation("Quick refresh of {Count} known players...", playersToQuery.Count);

            // Query all known players in parallel
            var tasks = playersToQuery.Select(p => _apiService.GetPlayerStatusAsync(p.IpAddress, p.Port));
            var results = await Task.WhenAll(tasks);

            var players = results.Where(p => p != null).Cast<BluesoundPlayer>().ToList();

            _logger.LogInformation("Quick refresh complete. Got status from {Count} players.", players.Count);

            // Update the shared cache
            _playerCache.SetCachedPlayers(players);

            return players;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during quick refresh, falling back to discovery");
            return await DiscoverPlayersAsync(forceRefresh: true);
        }
    }

    /// <inheritdoc />
    public async Task<PlaybackStatus?> GetPlaybackStatusAsync(string ip, int port = 11000)
    {
        return await _apiService.GetPlaybackStatusAsync(ip, port);
    }

    /// <inheritdoc />
    public List<PlayerGroup> OrganizeIntoGroups(List<BluesoundPlayer> players)
    {
        var groups = new List<PlayerGroup>();
        var processedIds = new HashSet<string>();

        // Filter out secondary stereo pair speakers - they should not appear as separate entries
        var visiblePlayers = players
            .Where(p => !p.IsSecondaryStereoPairSpeaker)
            .ToList();

        _logger.LogInformation("Visible players: {Count}, Total players: {Total}",
            visiblePlayers.Count, players.Count);

        foreach (var p in visiblePlayers)
        {
            _logger.LogDebug("Player: {Name}, IP: {IP}, IsMaster: {IsMaster}, IsGrouped: {IsGrouped}, MasterIp: {MasterIp}, SlaveIps: [{SlaveIps}]",
                p.Name, p.IpAddress, p.IsMaster, p.IsGrouped, p.MasterIp, string.Join(", ", p.SlaveIps));
        }

        // Mark secondary speakers as processed so they don't appear later
        foreach (var secondary in players.Where(p => p.IsSecondaryStereoPairSpeaker))
        {
            processedIds.Add(secondary.Id);
        }

        // First, find all masters and create groups
        foreach (var player in visiblePlayers.Where(p => p.IsMaster && p.IsGrouped))
        {
            var group = new PlayerGroup
            {
                Id = player.Id,
                Name = player.Name,
                Type = GroupType.MultiRoom,
                Master = player
            };

            // Method 1: Find slaves via SlaveIps list from master
            foreach (var slaveAddress in player.SlaveIps)
            {
                var slaveIp = slaveAddress.Split(':')[0];
                var slave = visiblePlayers.FirstOrDefault(p => p.IpAddress == slaveIp);
                if (slave != null && !processedIds.Contains(slave.Id))
                {
                    group.Members.Add(slave);
                    processedIds.Add(slave.Id);
                    _logger.LogDebug("Found slave via SlaveIps: {Name}", slave.Name);
                }
            }

            // Method 2: Find slaves that have this master's IP as their MasterIp
            var masterIpOnly = player.IpAddress;

            foreach (var potentialSlave in visiblePlayers.Where(p =>
                !processedIds.Contains(p.Id) &&
                p.Id != player.Id &&
                p.IsGrouped &&
                !p.IsMaster &&
                p.MasterIp != null))
            {
                var slaveMasterIp = potentialSlave.MasterIp!.Split(':')[0];
                if (slaveMasterIp == masterIpOnly)
                {
                    group.Members.Add(potentialSlave);
                    processedIds.Add(potentialSlave.Id);
                    _logger.LogDebug("Found slave via MasterIp: {Name}", potentialSlave.Name);
                }
            }

            processedIds.Add(player.Id);
            groups.Add(group);

            _logger.LogDebug("Created group '{Name}' with {MemberCount} members",
                group.Name, group.Members.Count);
        }

        // Add ungrouped players as single-player groups
        foreach (var player in visiblePlayers.Where(p => !processedIds.Contains(p.Id) && !p.IsGrouped))
        {
            var groupType = player.IsStereoPaired ? GroupType.StereoPair : GroupType.Single;
            groups.Add(new PlayerGroup
            {
                Id = player.Id,
                Name = player.Name,
                Type = groupType,
                Master = player
            });
            processedIds.Add(player.Id);
        }

        // Handle slaves that weren't found through their master (edge case)
        foreach (var player in visiblePlayers.Where(p => !processedIds.Contains(p.Id)))
        {
            var groupType = player.IsStereoPaired ? GroupType.StereoPair : GroupType.Single;
            groups.Add(new PlayerGroup
            {
                Id = player.Id,
                Name = player.Name,
                Type = groupType,
                Master = player
            });
        }

        return groups.OrderBy(g => g.Type).ThenBy(g => g.Name).ToList();
    }

    /// <inheritdoc />
    public List<PlayerSelectorItem> GetPlayersForSelector(List<BluesoundPlayer> players)
    {
        var result = new List<PlayerSelectorItem>();
        var processedIds = new HashSet<string>();

        // Filter out secondary stereo pair speakers
        var visiblePlayers = players
            .Where(p => !p.IsSecondaryStereoPairSpeaker)
            .ToList();

        // Mark secondary speakers as processed
        foreach (var secondary in players.Where(p => p.IsSecondaryStereoPairSpeaker))
        {
            processedIds.Add(secondary.Id);
        }

        // First, process masters of groups - they represent the entire group
        foreach (var player in visiblePlayers.Where(p => p.IsMaster && p.IsGrouped))
        {
            var groupMembers = new List<PlayerSelectorMember>();

            // Add slaves from SlaveIps
            foreach (var slaveAddress in player.SlaveIps)
            {
                var slaveIp = slaveAddress.Split(':')[0];
                var slave = visiblePlayers.FirstOrDefault(p => p.IpAddress == slaveIp);
                if (slave != null)
                {
                    groupMembers.Add(new PlayerSelectorMember
                    {
                        Id = slave.Id,
                        IpAddress = slave.IpAddress,
                        Port = slave.Port,
                        Name = slave.Name,
                        Brand = slave.Brand,
                        ModelName = slave.ModelName,
                        Volume = slave.Volume,
                        IsFixedVolume = slave.IsFixedVolume,
                        IsStereoPaired = slave.IsStereoPaired,
                        ChannelMode = slave.ChannelMode
                    });
                    processedIds.Add(slave.Id);
                }
            }

            // Add slaves that reference this master
            var masterIp = player.IpAddress;
            foreach (var slave in visiblePlayers.Where(p =>
                !processedIds.Contains(p.Id) &&
                p.Id != player.Id &&
                p.IsGrouped && !p.IsMaster && p.MasterIp != null &&
                p.MasterIp.Split(':')[0] == masterIp))
            {
                groupMembers.Add(new PlayerSelectorMember
                {
                    Id = slave.Id,
                    IpAddress = slave.IpAddress,
                    Port = slave.Port,
                    Name = slave.Name,
                    Brand = slave.Brand,
                    ModelName = slave.ModelName,
                    Volume = slave.Volume,
                    IsFixedVolume = slave.IsFixedVolume,
                    IsStereoPaired = slave.IsStereoPaired,
                    ChannelMode = slave.ChannelMode
                });
                processedIds.Add(slave.Id);
            }

            result.Add(new PlayerSelectorItem
            {
                Id = player.Id,
                Name = player.Name,
                IpAddress = player.IpAddress,
                Port = player.Port,
                Model = player.IsStereoPaired ? "Stereo Pair" : player.ModelName,
                Brand = player.Brand,
                IsGroup = true,
                MemberCount = groupMembers.Count + 1, // +1 for the master itself
                Volume = player.Volume,
                IsFixedVolume = player.IsFixedVolume,
                IsStereoPaired = player.IsStereoPaired,
                ChannelMode = player.ChannelMode,
                Members = groupMembers
            });

            processedIds.Add(player.Id);
        }

        // Add ungrouped players (singles and stereo pairs)
        foreach (var player in visiblePlayers.Where(p => !processedIds.Contains(p.Id) && !p.IsGrouped))
        {
            result.Add(new PlayerSelectorItem
            {
                Id = player.Id,
                Name = player.Name,
                IpAddress = player.IpAddress,
                Port = player.Port,
                Model = player.IsStereoPaired ? "Stereo Pair" : player.ModelName,
                Brand = player.Brand,
                IsGroup = false,
                MemberCount = 1,
                Volume = player.Volume,
                IsFixedVolume = player.IsFixedVolume,
                IsStereoPaired = player.IsStereoPaired,
                ChannelMode = player.ChannelMode,
                Members = new List<PlayerSelectorMember>()
            });
            processedIds.Add(player.Id);
        }

        // Handle any remaining players (edge case)
        foreach (var player in visiblePlayers.Where(p => !processedIds.Contains(p.Id)))
        {
            result.Add(new PlayerSelectorItem
            {
                Id = player.Id,
                Name = player.Name,
                IpAddress = player.IpAddress,
                Port = player.Port,
                Model = player.ModelName,
                Brand = player.Brand,
                IsGroup = false,
                MemberCount = 1,
                Volume = player.Volume,
                IsFixedVolume = player.IsFixedVolume,
                IsStereoPaired = player.IsStereoPaired,
                ChannelMode = player.ChannelMode,
                Members = new List<PlayerSelectorMember>()
            });
        }

        return result.OrderByDescending(p => p.IsGroup).ThenBy(p => p.Name).ToList();
    }

    // Playback controls - delegate to IBluesoundApiService

    /// <inheritdoc />
    public async Task<bool> PlayAsync(string ip, int port = 11000)
    {
        return await _apiService.PlayAsync(ip, port);
    }

    /// <inheritdoc />
    public async Task<bool> PauseAsync(string ip, int port = 11000)
    {
        return await _apiService.PauseAsync(ip, port);
    }

    /// <inheritdoc />
    public async Task<bool> StopAsync(string ip, int port = 11000)
    {
        return await _apiService.StopAsync(ip, port);
    }

    /// <inheritdoc />
    public async Task<bool> NextTrackAsync(string ip, int port = 11000)
    {
        return await _apiService.NextTrackAsync(ip, port);
    }

    /// <inheritdoc />
    public async Task<bool> PreviousTrackAsync(string ip, int port = 11000)
    {
        return await _apiService.PreviousTrackAsync(ip, port);
    }

    /// <inheritdoc />
    public async Task<bool> SetVolumeAsync(string ip, int volume, int port = 11000)
    {
        return await _apiService.SetVolumeAsync(ip, port, volume);
    }

    /// <summary>
    /// Query stored players directly by their IPs (fast, ~0.5s instead of ~3s mDNS)
    /// </summary>
    private async Task<List<BluesoundPlayer>> QueryStoredPlayersAsync()
    {
        var storedPlayers = await _storedPlayerService.GetAllStoredPlayersAsync();

        // Query all stored players in parallel (HTTP requests only, no DB access)
        var tasks = storedPlayers.Select(async sp =>
        {
            try
            {
                var player = await _apiService.GetPlayerStatusAsync(sp.IpAddress, sp.Port);
                return (sp.IpAddress, Player: player, IsOnline: player != null);
            }
            catch
            {
                return (sp.IpAddress, Player: (BluesoundPlayer?)null, IsOnline: false);
            }
        });

        var results = await Task.WhenAll(tasks);

        // Update DB sequentially to avoid DbContext concurrency issues
        foreach (var result in results)
        {
            if (result.IsOnline)
            {
                await _storedPlayerService.MarkPlayerOnlineAsync(result.IpAddress);
            }
            else
            {
                await _storedPlayerService.MarkPlayerOfflineAsync(result.IpAddress);
            }
        }

        return results.Where(r => r.Player != null).Select(r => r.Player!).ToList();
    }
}

using BluesoundWeb.Models;
using Zeroconf;

namespace BluesoundWeb.Services;

/// <summary>
/// Service for discovering Bluesound players on the network using mDNS
/// </summary>
public interface IPlayerDiscoveryService
{
    Task<List<BluesoundPlayer>> DiscoverPlayersAsync(TimeSpan? scanDuration = null);
}

public class PlayerDiscoveryService : IPlayerDiscoveryService
{
    private readonly IBluesoundApiService _apiService;
    private readonly ILogger<PlayerDiscoveryService> _logger;

    // BluOS mDNS service type
    private const string BluOsServiceType = "_musc._tcp.local.";

    public PlayerDiscoveryService(IBluesoundApiService apiService, ILogger<PlayerDiscoveryService> logger)
    {
        _apiService = apiService;
        _logger = logger;
    }

    public async Task<List<BluesoundPlayer>> DiscoverPlayersAsync(TimeSpan? scanDuration = null)
    {
        var players = new List<BluesoundPlayer>();
        var duration = scanDuration ?? TimeSpan.FromSeconds(3);

        try
        {
            _logger.LogInformation("Starting mDNS discovery for BluOS players...");

            // Discover BluOS players via mDNS
            var results = await ZeroconfResolver.ResolveAsync(
                BluOsServiceType,
                scanTime: duration,
                retries: 2,
                callback: (host) =>
                {
                    _logger.LogDebug("Found host during scan: {Host}", host.DisplayName);
                });

            _logger.LogInformation("Found {Count} devices via mDNS", results.Count);

            // Get detailed status from each discovered player
            var tasks = new List<Task<BluesoundPlayer?>>();

            foreach (var host in results)
            {
                var ip = host.IPAddress;
                var port = 11000;

                // Try to get port from services
                foreach (var service in host.Services)
                {
                    if (service.Value.Port > 0)
                    {
                        port = service.Value.Port;
                        break;
                    }
                }

                _logger.LogDebug("Querying player at {Ip}:{Port}", ip, port);
                tasks.Add(_apiService.GetPlayerStatusAsync(ip, port));
            }

            var results2 = await Task.WhenAll(tasks);

            foreach (var player in results2)
            {
                if (player != null)
                {
                    players.Add(player);
                    _logger.LogInformation("Discovered player: {Name} at {Ip}", player.Name, player.IpAddress);
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during player discovery");
        }

        return players.OrderBy(p => p.Name).ToList();
    }
}

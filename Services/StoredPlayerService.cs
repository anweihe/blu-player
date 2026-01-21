using Microsoft.EntityFrameworkCore;
using BluesoundWeb.Data;
using BluesoundWeb.Models;

namespace BluesoundWeb.Services;

public class StoredPlayerService : IStoredPlayerService
{
    private readonly BluesoundDbContext _db;
    private readonly ILogger<StoredPlayerService> _logger;

    public StoredPlayerService(BluesoundDbContext db, ILogger<StoredPlayerService> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task<List<StoredPlayer>> GetAllStoredPlayersAsync()
    {
        return await _db.StoredPlayers
            .OrderBy(p => p.Name)
            .ToListAsync();
    }

    public async Task<bool> HasStoredPlayersAsync()
    {
        return await _db.StoredPlayers.AnyAsync();
    }

    public async Task SaveDiscoveredPlayersAsync(List<BluesoundPlayer> players)
    {
        var now = DateTime.UtcNow;

        foreach (var player in players)
        {
            // Try to find existing player by MAC address first, then by IP
            var existingPlayer = await _db.StoredPlayers
                .FirstOrDefaultAsync(p =>
                    (!string.IsNullOrEmpty(player.MacAddress) && p.MacAddress == player.MacAddress) ||
                    p.IpAddress == player.IpAddress);

            if (existingPlayer != null)
            {
                // Update existing player
                existingPlayer.IpAddress = player.IpAddress;
                existingPlayer.Port = player.Port;
                existingPlayer.Name = player.Name;
                existingPlayer.MacAddress = player.MacAddress;
                existingPlayer.ModelName = player.ModelName;
                existingPlayer.Brand = player.Brand;
                existingPlayer.LastSeenAt = now;
                existingPlayer.IsOnline = true;

                _logger.LogDebug("Updated stored player: {Name} ({IP})", player.Name, player.IpAddress);
            }
            else
            {
                // Add new player
                var storedPlayer = new StoredPlayer
                {
                    IpAddress = player.IpAddress,
                    Port = player.Port,
                    Name = player.Name,
                    MacAddress = player.MacAddress,
                    ModelName = player.ModelName,
                    Brand = player.Brand,
                    DiscoveredAt = now,
                    LastSeenAt = now,
                    IsOnline = true
                };

                _db.StoredPlayers.Add(storedPlayer);
                _logger.LogInformation("Added new stored player: {Name} ({IP})", player.Name, player.IpAddress);
            }
        }

        await _db.SaveChangesAsync();
        _logger.LogInformation("Saved {Count} players to database", players.Count);
    }

    public async Task MarkPlayerOfflineAsync(string ipAddress)
    {
        var player = await _db.StoredPlayers.FirstOrDefaultAsync(p => p.IpAddress == ipAddress);
        if (player != null)
        {
            player.IsOnline = false;
            await _db.SaveChangesAsync();
            _logger.LogDebug("Marked player offline: {IP}", ipAddress);
        }
    }

    public async Task MarkPlayerOnlineAsync(string ipAddress)
    {
        var player = await _db.StoredPlayers.FirstOrDefaultAsync(p => p.IpAddress == ipAddress);
        if (player != null)
        {
            player.IsOnline = true;
            player.LastSeenAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            _logger.LogDebug("Marked player online: {IP}", ipAddress);
        }
    }

    public async Task RemovePlayerAsync(string ipAddress)
    {
        var player = await _db.StoredPlayers.FirstOrDefaultAsync(p => p.IpAddress == ipAddress);
        if (player != null)
        {
            _db.StoredPlayers.Remove(player);
            await _db.SaveChangesAsync();
            _logger.LogInformation("Removed stored player: {IP}", ipAddress);
        }
    }
}

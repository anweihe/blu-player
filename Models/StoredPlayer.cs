namespace BluesoundWeb.Models;

/// <summary>
/// Represents a Bluesound player stored in the database for quick access.
/// Used to avoid mDNS discovery on every page load.
/// </summary>
public class StoredPlayer
{
    public int Id { get; set; }
    public string IpAddress { get; set; } = string.Empty;
    public int Port { get; set; } = 11000;
    public string Name { get; set; } = string.Empty;
    public string? MacAddress { get; set; }
    public string? ModelName { get; set; }
    public string? Brand { get; set; }
    public DateTime DiscoveredAt { get; set; }
    public DateTime LastSeenAt { get; set; }
    public bool IsOnline { get; set; } = true;
}

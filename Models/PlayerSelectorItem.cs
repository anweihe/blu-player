namespace BluesoundWeb.Models;

/// <summary>
/// Represents a player or group for the player selector UI (e.g., footer popup).
/// Groups are represented by their master player with member details.
/// </summary>
public class PlayerSelectorItem
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Model { get; set; } = string.Empty;
    public string Brand { get; set; } = string.Empty;
    public string IpAddress { get; set; } = string.Empty;
    public int Port { get; set; } = 11000;
    public int Volume { get; set; }
    public bool IsFixedVolume { get; set; }
    public bool IsGroup { get; set; }
    public bool IsStereoPaired { get; set; }
    public string? ChannelMode { get; set; }
    public int MemberCount { get; set; } = 1;
    public List<PlayerSelectorMember> Members { get; set; } = new();
}

/// <summary>
/// Represents a member within a grouped player (slave in a multi-room group).
/// </summary>
public class PlayerSelectorMember
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string IpAddress { get; set; } = string.Empty;
    public int Port { get; set; } = 11000;
    public string Brand { get; set; } = string.Empty;
    public string ModelName { get; set; } = string.Empty;
    public int Volume { get; set; }
    public bool IsFixedVolume { get; set; }
    public bool IsStereoPaired { get; set; }
    public string? ChannelMode { get; set; }
}

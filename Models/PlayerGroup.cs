namespace BluesoundWeb.Models;

/// <summary>
/// Represents a group of players (either a multi-room group, stereo pair, or single player)
/// </summary>
public class PlayerGroup
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public GroupType Type { get; set; }
    public BluesoundPlayer? Master { get; set; }
    public List<BluesoundPlayer> Members { get; set; } = new();

    public int TotalMembers => Members.Count + (Master != null ? 1 : 0);

    public string DisplayType => Type switch
    {
        GroupType.StereoPair => "Stereopaar",
        GroupType.MultiRoom => "Gruppe",
        GroupType.Single => "Einzeln",
        _ => "Unbekannt"
    };

    public string TypeBadgeClass => Type switch
    {
        GroupType.StereoPair => "bg-info",
        GroupType.MultiRoom => "bg-success",
        GroupType.Single => "bg-secondary",
        _ => "bg-secondary"
    };
}

public enum GroupType
{
    Single,
    StereoPair,
    MultiRoom
}

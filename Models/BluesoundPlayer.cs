namespace BluesoundWeb.Models;

/// <summary>
/// Represents a Bluesound player discovered on the network
/// </summary>
public class BluesoundPlayer
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string IpAddress { get; set; } = string.Empty;
    public int Port { get; set; } = 11000;
    public string ModelName { get; set; } = string.Empty;
    public string Model { get; set; } = string.Empty;
    public string Brand { get; set; } = string.Empty;
    public string MacAddress { get; set; } = string.Empty;
    public int Volume { get; set; }
    public bool IsFixedVolume { get; set; }

    // Group information
    public bool IsGrouped { get; set; }
    public bool IsMaster { get; set; }
    public string? GroupName { get; set; }
    public string? MasterIp { get; set; }
    public List<string> SlaveIps { get; set; } = new();

    // Stereo pair information
    public bool IsStereoPaired { get; set; }
    public string? ChannelMode { get; set; } // "left", "right", "front", etc.

    // Secondary speaker of a stereo pair (should be hidden from main list)
    public bool IsSecondaryStereoPairSpeaker { get; set; }

    public string DisplayStatus
    {
        get
        {
            if (IsStereoPaired)
            {
                return $"Stereopaar ({ChannelMode})";
            }
            if (IsGrouped)
            {
                if (IsMaster)
                    return $"Gruppe: {GroupName} (Master)";
                return $"Gruppe: {GroupName} (Slave)";
            }
            return "Einzeln";
        }
    }
}

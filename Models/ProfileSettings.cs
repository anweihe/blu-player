namespace BluesoundWeb.Models;

/// <summary>
/// Stores user settings for a profile
/// </summary>
public class ProfileSettings
{
    public int Id { get; set; }

    /// <summary>
    /// Foreign key to UserProfile
    /// </summary>
    public int UserProfileId { get; set; }

    /// <summary>
    /// Qobuz streaming quality format ID (default: 27 = Hi-Res Max)
    /// 5 = MP3 320kbps, 6 = CD 16-bit/44.1kHz, 7 = Hi-Res 24-bit/96kHz, 27 = Hi-Res Max 24-bit/192kHz
    /// </summary>
    public int StreamingQualityFormatId { get; set; } = 27;

    /// <summary>
    /// Selected player type: "browser" or "bluesound"
    /// </summary>
    public string? SelectedPlayerType { get; set; }

    /// <summary>
    /// Display name of the selected player
    /// </summary>
    public string? SelectedPlayerName { get; set; }

    /// <summary>
    /// IP address of the selected Bluesound player
    /// </summary>
    public string? SelectedPlayerIp { get; set; }

    /// <summary>
    /// Port of the selected Bluesound player (default: 11000)
    /// </summary>
    public int? SelectedPlayerPort { get; set; }

    /// <summary>
    /// Model name of the selected Bluesound player
    /// </summary>
    public string? SelectedPlayerModel { get; set; }

    // Navigation property
    public UserProfile? UserProfile { get; set; }
}

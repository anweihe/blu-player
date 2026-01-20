namespace BluesoundWeb.Models;

/// <summary>
/// Stores global application settings (singleton, Id = 1)
/// </summary>
public class GlobalSettings
{
    public int Id { get; set; }

    /// <summary>
    /// The currently active profile ID
    /// </summary>
    public string? ActiveProfileId { get; set; }
}

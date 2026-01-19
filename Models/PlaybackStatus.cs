namespace BluesoundWeb.Models;

/// <summary>
/// Represents the current playback status of a Bluesound player
/// </summary>
public class PlaybackStatus
{
    public string State { get; set; } = "stop"; // play, pause, stop, stream
    public string? Title { get; set; }
    public string? Artist { get; set; }
    public string? Album { get; set; }
    public string? ImageUrl { get; set; }
    public string? Service { get; set; } // Spotify, TuneIn, etc.
    public int? TotalSeconds { get; set; }
    public int? CurrentSeconds { get; set; }
    public string? StreamUrl { get; set; }

    public bool IsPlaying => State == "play" || State == "stream";
    public bool IsPaused => State == "pause";
    public bool IsStopped => State == "stop";

    public string DisplayState => State switch
    {
        "play" => "Wiedergabe",
        "stream" => "Streaming",
        "pause" => "Pausiert",
        "stop" => "Gestoppt",
        _ => "Unbekannt"
    };

    public string? FormattedDuration
    {
        get
        {
            if (TotalSeconds == null || TotalSeconds <= 0) return null;
            var ts = TimeSpan.FromSeconds(TotalSeconds.Value);
            return ts.Hours > 0
                ? $"{ts.Hours}:{ts.Minutes:D2}:{ts.Seconds:D2}"
                : $"{ts.Minutes}:{ts.Seconds:D2}";
        }
    }

    public string? FormattedPosition
    {
        get
        {
            if (CurrentSeconds == null) return null;
            var ts = TimeSpan.FromSeconds(CurrentSeconds.Value);
            return ts.Hours > 0
                ? $"{ts.Hours}:{ts.Minutes:D2}:{ts.Seconds:D2}"
                : $"{ts.Minutes}:{ts.Seconds:D2}";
        }
    }

    public double ProgressPercent
    {
        get
        {
            if (TotalSeconds == null || TotalSeconds <= 0 || CurrentSeconds == null) return 0;
            return (double)CurrentSeconds.Value / TotalSeconds.Value * 100;
        }
    }
}

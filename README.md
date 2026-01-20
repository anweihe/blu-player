# Bluesound Web Controller

A modern web application for controlling Bluesound/BluOS players on your local network, with integrated Qobuz streaming support.

![.NET](https://img.shields.io/badge/.NET-9.0-512BD4)
![License](https://img.shields.io/badge/license-MIT-green)

## Features

### Bluesound Player Control
- **Automatic Discovery** - Finds all Bluesound players on your network via mDNS/Bonjour
- **Player Grouping** - View and manage grouped players
- **Stereo Pair Support** - Properly handles stereo paired speakers
- **Volume Control** - Adjust volume for individual players or groups
- **Playback Control** - Play, pause, skip tracks on any player
- **Now Playing** - View current track information with album art

### Qobuz Integration
- **Secure Login** - Login with your Qobuz credentials (stored locally in browser)
- **Playlist Browser** - View all your Qobuz playlists with cover art
- **Track Playback** - Stream tracks directly in the browser
- **Hi-Res Support** - Shows quality indicators for high-resolution tracks
- **Player Selection** - Choose between browser playback or Bluesound players (Bluesound streaming coming soon)

## Screenshots

*Coming soon*

## Getting Started

### Prerequisites

- [.NET 9.0 SDK](https://dotnet.microsoft.com/download/dotnet/9.0)
- Bluesound players on the same network (for player control)
- Qobuz subscription (for streaming features)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/anweihe/blu-player.git
   cd blu-player
   ```

2. Run the application:
   ```bash
   dotnet run
   ```

3. Open your browser and navigate to:
   ```
   http://localhost:5000
   ```

## Project Structure

```
├── Models/
│   ├── BluesoundPlayer.cs    # Player model with group/stereo pair info
│   ├── PlayerGroup.cs        # ViewModel for grouped display
│   ├── PlaybackStatus.cs     # Current playback state
│   └── QobuzModels.cs        # Qobuz API models
├── Services/
│   ├── BluesoundApiService.cs      # BluOS API communication
│   ├── PlayerDiscoveryService.cs   # mDNS-based player discovery
│   └── QobuzApiService.cs          # Qobuz API integration
├── Pages/
│   ├── Index.cshtml          # Main player control UI
│   └── Qobuz.cshtml          # Qobuz streaming UI
└── Program.cs                # Service registration
```

## BluOS API Reference

The application communicates with Bluesound players via the BluOS HTTP API on port 11000.

### Key Endpoints

| Endpoint | Description |
|----------|-------------|
| `/SyncStatus` | Player info, group status, volume |
| `/Status` | Playback status (play/pause, track info) |
| `/Volume?level=<0-100>` | Set volume |
| `/Play`, `/Pause`, `/Stop` | Playback control |
| `/AddSlave?slave=<IP>` | Add player to group |
| `/RemoveSlave?slave=<IP>` | Remove player from group |

## Technology Stack

- **Backend:** ASP.NET Core 9.0 with Razor Pages
- **Frontend:** Vanilla JavaScript with CSS custom properties
- **Player Discovery:** Zeroconf (mDNS/Bonjour)
- **Qobuz Integration:** Custom implementation based on public API

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Bluesound](https://www.bluesound.com/) for their excellent multi-room audio system
- [Qobuz](https://www.qobuz.com/) for high-resolution music streaming
- Inspired by various open-source Qobuz clients

## Disclaimer

This project is not affiliated with, endorsed by, or connected to Bluesound or Qobuz. All product names, logos, and brands are property of their respective owners.

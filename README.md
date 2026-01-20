# Bluesound Web Controller

A modern web application for controlling Bluesound/BluOS players on your local network, with integrated Qobuz streaming support.

![.NET](https://img.shields.io/badge/.NET-9.0-512BD4)
![License](https://img.shields.io/badge/license-MIT-green)

## Features

### Bluesound Player Control
- **Automatic Discovery** - Finds all Bluesound players on your network via mDNS/Bonjour
- **Player Grouping** - View and manage grouped players
- **Stereo Pair Support** - Properly handles stereo paired speakers
- **Volume Control** - Adjust volume for individual players or groups with a dedicated volume panel
- **Playback Control** - Play, pause, skip tracks on any player
- **Now Playing Bar** - Global persistent playback bar with full-screen popup view
- **Playback Handoff** - Seamlessly switch playback between browser and Bluesound players

### Qobuz Integration
- **Secure Login** - Login with your Qobuz credentials
- **Multi-User Profiles** - Support for multiple user profiles with separate Qobuz accounts
- **Playlist Browser** - View all your Qobuz playlists with cover art
- **Album Browser** - Browse new releases, top playlists, and personalized recommendations
- **Search** - Search for albums, playlists, and tracks
- **Favorites** - Quick access to your favorite albums, playlists, and tracks
- **Playback Queue** - View and manage the current playback queue with persistence
- **Hi-Res Support** - Shows quality indicators for high-resolution tracks
- **Quality Selection** - Choose streaming quality (MP3, CD, Hi-Res)
- **Player Selection** - Stream to browser or directly to Bluesound players

### Technical Features
- **SPA Navigation** - Fast single-page app navigation between pages
- **Responsive Design** - Works on desktop, tablet, and mobile
- **Dark Mode** - Beautiful dark theme (light mode via system preference)
- **Persistent State** - Queue and settings persist across sessions
- **Docker Support** - Ready for deployment with Docker/Coolify

## Getting Started

### Prerequisites

- [.NET 9.0 SDK](https://dotnet.microsoft.com/download/dotnet/9.0)
- Bluesound players on the same network (for player control)
- Qobuz subscription (for streaming features)

### Local Development

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

SQLite is used automatically for local development (database stored in `data/bluesound.db`).

### Docker/Coolify Deployment

The application supports Docker deployment with PostgreSQL for production use.

**Coolify:**
1. Create a new service from this repository
2. Add a PostgreSQL database and link it to the service
3. Set the environment variable:
   ```
   ConnectionStrings__DefaultConnection=${COOLIFY_POSTGRES_CONNECTION_STRING}
   ```
   Or construct it manually:
   ```
   ConnectionStrings__DefaultConnection=Host=${POSTGRES_HOST};Database=${POSTGRES_DB};Username=${POSTGRES_USER};Password=${POSTGRES_PASSWORD}
   ```

**Manual Docker:**
```bash
docker build -t bluesound-web .
docker run -e "ConnectionStrings__DefaultConnection=Host=...;Database=...;Username=...;Password=..." -p 8081:8081 bluesound-web
```

## Project Structure

```
├── Data/
│   └── BluesoundDbContext.cs     # Entity Framework database context
├── Models/
│   ├── BluesoundPlayer.cs        # Player model with group/stereo pair info
│   ├── PlayerGroup.cs            # ViewModel for grouped display
│   ├── PlaybackStatus.cs         # Current playback state
│   ├── UserProfile.cs            # Multi-user profile model
│   ├── PlaybackQueue.cs          # Queue persistence model
│   └── QobuzModels.cs            # Qobuz API models
├── Services/
│   ├── BluesoundApiService.cs    # BluOS API communication
│   ├── PlayerDiscoveryService.cs # mDNS-based player discovery
│   ├── QobuzApiService.cs        # Qobuz API integration
│   ├── SettingsService.cs        # User settings management
│   └── QueueService.cs           # Playback queue management
├── Pages/
│   ├── Index.cshtml              # Home page
│   ├── Players.cshtml            # Player control UI
│   ├── Qobuz.cshtml              # Qobuz streaming UI
│   └── Api/                      # API endpoints
├── wwwroot/
│   ├── css/                      # Stylesheets
│   └── js/                       # JavaScript modules
└── Program.cs                    # Application setup
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
| `/Skip`, `/Back` | Track navigation |
| `/AddSlave?slave=<IP>` | Add player to group |
| `/RemoveSlave?slave=<IP>` | Remove player from group |

## Technology Stack

- **Backend:** ASP.NET Core 9.0 with Razor Pages
- **Database:** SQLite (development) / PostgreSQL (production)
- **ORM:** Entity Framework Core 9.0
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

## Disclaimer

This project is not affiliated with, endorsed by, or connected to Bluesound or Qobuz. All product names, logos, and brands are property of their respective owners.

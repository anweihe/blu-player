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
- **Now Playing Popup** - Full-screen view with album art, progress, and queue
- **Playback Handoff** - Seamlessly switch playback between browser and Bluesound players

### Qobuz Integration
- **Secure Login** - Login with your Qobuz credentials
- **Multi-User Profiles** - Support for multiple user profiles with separate Qobuz accounts
- **Browse Content**
  - New Releases & Album Charts
  - Personalized Recommendations
  - Your Playlists, Albums, Tracks & Artists
- **Artist Pages** - Biography, top tracks, discography with filtering
- **Album Detail** - Track listing with Hi-Res badges, album info
- **Search** - Find albums, tracks, artists, and playlists
- **Context Menus** - Quick navigation to album or artist from any track
- **Playback Queue** - View and manage the current queue
- **Hi-Res Support** - Quality indicators and streaming quality selection (MP3, CD, Hi-Res)

### Navigation
- **Clickable Artists** - Click artist names anywhere to open artist page
- **Context Menus** - Right-click or tap menu button for "Go to Album" / "Go to Artist"
- **Album Cards** - Quick access to album and artist from cover art menus

### Technical Features
- **SPA Navigation** - Fast single-page app navigation
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

**Manual Docker:**
```bash
docker build -t bluesound-web .
docker run -e "ConnectionStrings__DefaultConnection=Host=...;Database=...;Username=...;Password=..." -p 8081:8081 bluesound-web
```

## Project Structure

```
├── Data/
│   └── BluesoundDbContext.cs        # Entity Framework database context
├── Models/
│   ├── BluesoundPlayer.cs           # Player model with group/stereo pair info
│   ├── PlayerGroup.cs               # ViewModel for grouped display
│   ├── PlaybackStatus.cs            # Current playback state (incl. ArtistId)
│   ├── UserProfile.cs               # Multi-user profile model
│   ├── PlaybackQueue.cs             # Queue persistence model
│   ├── SettingsDtos.cs              # DTOs for queue, settings
│   └── QobuzModels.cs               # Qobuz API models
├── Services/
│   ├── BluesoundApiService.cs       # BluOS API communication
│   ├── PlayerDiscoveryService.cs    # mDNS-based player discovery
│   ├── QobuzApiService.cs           # Qobuz API integration
│   ├── SettingsService.cs           # User settings management
│   └── QueueService.cs              # Playback queue management
├── Pages/
│   ├── Index.cshtml                 # Home page (player selection)
│   ├── Players.cshtml               # Player control UI
│   ├── Qobuz.cshtml                 # Qobuz streaming UI
│   ├── Qobuz.cshtml.cs              # Qobuz API handlers
│   ├── _QobuzContent.cshtml         # Qobuz HTML structure
│   └── Shared/_Layout.cshtml        # Layout with global player
├── wwwroot/
│   ├── css/
│   │   ├── qobuz.css                # Main Qobuz styles
│   │   └── now-playing-popup.css    # Now Playing popup styles
│   └── js/
│       ├── global-player.js         # Global mini-player
│       ├── now-playing-swipe.js     # Now Playing popup (swipe & tabs)
│       ├── queue-api.js             # Queue management
│       └── qobuz/
│           ├── qobuz-core.js        # Init, DOM refs, utilities
│           ├── qobuz-auth.js        # Login/logout, token management
│           ├── qobuz-tabs.js        # Tab navigation
│           ├── qobuz-browse.js      # Browse tabs, album/playlist detail
│           ├── qobuz-search.js      # Search functionality
│           ├── qobuz-artist.js      # Artist page
│           ├── qobuz-discography.js # Full discography page
│           ├── qobuz-playback.js    # Playback control
│           └── qobuz-context-menu.js # Context menus (track/album)
└── Program.cs                       # Application setup
```

## BluOS API Reference

The application communicates with Bluesound players via the BluOS HTTP API on port 11000.

### Key Endpoints

| Endpoint | Description |
|----------|-------------|
| `/SyncStatus` | Player info, group status, volume |
| `/Status` | Playback status (play/pause, track info, artistid) |
| `/Playlist` | Current playback queue |
| `/Volume?level=<0-100>` | Set volume |
| `/Play`, `/Pause`, `/Stop` | Playback control |
| `/Skip`, `/Back` | Track navigation |
| `/AddSlave?slave=<IP>` | Add player to group |
| `/RemoveSlave?slave=<IP>` | Remove player from group |

### Status Response Elements

| Element | Description |
|---------|-------------|
| `state` | Playback state: "play", "pause", "stop", "stream" |
| `title1` | Track title |
| `title2` | Artist name |
| `title3` | Album title |
| `image` | Album cover URL |
| `service` | Streaming service (Spotify, Qobuz, TuneIn, etc.) |
| `artistid` | Qobuz artist ID (when playing from Qobuz) |

## Technology Stack

- **Backend:** ASP.NET Core 9.0 with Razor Pages
- **Database:** SQLite (development) / PostgreSQL (production)
- **ORM:** Entity Framework Core 9.0
- **Frontend:** Vanilla JavaScript (ES6+) with CSS custom properties
- **Player Discovery:** Zeroconf (mDNS/Bonjour)
- **Qobuz Integration:** Custom implementation based on public API

## Development

See [CLAUDE.md](CLAUDE.md) for detailed development documentation including:
- JavaScript architecture (IIFE pattern, QobuzApp namespace)
- Static asset caching workarounds
- Context menu system
- Debugging tips

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Bluesound](https://www.bluesound.com/) for their excellent multi-room audio system
- [Qobuz](https://www.qobuz.com/) for high-resolution music streaming

## Disclaimer

This project is not affiliated with, endorsed by, or connected to Bluesound or Qobuz. All product names, logos, and brands are property of their respective owners.

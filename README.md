# Bluesound Web Controller

A modern web application for controlling Bluesound/BluOS players on your local network, with integrated Qobuz streaming support.

![.NET](https://img.shields.io/badge/.NET-10.0-512BD4)
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

### Radio & Streaming
- **TuneIn Radio** - Browse and play internet radio stations
- **Radio Paradise** - Dedicated Radio Paradise integration with quality selection

### Technical Features
- **Angular SPA** - Full Angular 21 single-page application
- **Lazy Loading** - Route-based code splitting for fast initial load
- **Responsive Design** - Works on desktop, tablet, and mobile
- **PWA Support** - Installable as Progressive Web App with offline support
- **Dark Mode** - Beautiful dark theme (light mode via system preference)
- **Persistent State** - Queue and settings persist across sessions
- **Multi-User Profiles** - Multiple user profiles with separate settings and Qobuz accounts
- **Listening History** - Track listening history per profile
- **Docker Support** - Ready for deployment with Docker/Coolify

## Getting Started

### Prerequisites

- [.NET 10.0 SDK](https://dotnet.microsoft.com/download/dotnet/10.0)
- [Node.js](https://nodejs.org/) (for Angular frontend development)
- Bluesound players on the same network (for player control)
- Qobuz subscription (for Qobuz streaming features)

### Local Development

1. Clone the repository:
   ```bash
   git clone https://github.com/anweihe/blu-player.git
   cd blu-player
   ```

2. Install Angular dependencies:
   ```bash
   cd bluesound-angular && npm install && cd ..
   ```

3. Run the application (Angular is built automatically):
   ```bash
   dotnet run
   ```

4. Open your browser and navigate to:
   ```
   http://localhost:5000
   ```

SQLite is used automatically for local development (database stored in `data/bluesound.db`).

> **Tip for frontend development:** Use `cd bluesound-angular && npm start` to run the Angular dev server with hot reload (proxies API calls to the .NET backend).

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
├── Controllers/
│   ├── PlayersController.cs         # Bluesound player API endpoints
│   ├── QobuzController.cs           # Qobuz API proxy endpoints
│   ├── RadioParadiseController.cs   # Radio Paradise API endpoints
│   ├── RatingsController.cs         # Album rating endpoints
│   ├── SettingsController.cs        # User settings & profile endpoints
│   └── TuneInController.cs          # TuneIn radio API endpoints
├── Data/
│   └── BluesoundDbContext.cs        # Entity Framework database context
├── Models/
│   ├── BluesoundPlayer.cs           # Player model with group/stereo pair info
│   ├── PlayerGroup.cs               # ViewModel for grouped display
│   ├── PlaybackStatus.cs            # Current playback state
│   ├── UserProfile.cs               # Multi-user profile model
│   ├── PlaybackQueue.cs             # Queue persistence model
│   ├── ListeningHistory.cs          # Listening history model
│   ├── AlbumRating.cs               # Album rating model
│   ├── StoredPlayer.cs              # Persisted player configuration
│   ├── QobuzModels.cs               # Qobuz API models
│   └── SettingsDtos.cs              # DTOs for queue, settings
├── Services/
│   ├── BluesoundApiService.cs       # BluOS API communication
│   ├── BluesoundPlayerService.cs    # Player state management
│   ├── PlayerDiscoveryService.cs    # mDNS-based player discovery
│   ├── PlayerCacheService.cs        # Player discovery cache
│   ├── StoredPlayerService.cs       # Persisted player management
│   ├── QobuzApiService.cs           # Qobuz API integration
│   ├── AlbumInfoService.cs          # AI-generated album info
│   ├── AlbumRatingService.cs        # Album rating management
│   ├── ListeningHistoryService.cs   # Listening history tracking
│   ├── QueueService.cs              # Playback queue management
│   ├── SettingsService.cs           # User settings management
│   └── EncryptionService.cs         # Credential encryption
├── Pages/                           # Razor Pages shell (hosts Angular SPA)
│   ├── Index.cshtml / Players.cshtml / Qobuz.cshtml
│   ├── TuneIn.cshtml / RadioParadise.cshtml / Settings.cshtml
│   └── Shared/_Layout.cshtml
├── bluesound-angular/               # Angular 21 SPA
│   └── src/app/
│       ├── core/
│       │   ├── models/              # TypeScript interfaces
│       │   ├── services/            # API services, state management
│       │   ├── guards/              # Route guards (auth)
│       │   └── interceptors/        # HTTP interceptors
│       ├── features/
│       │   ├── home/                # Home / dashboard
│       │   ├── players/             # Player control
│       │   ├── qobuz/               # Qobuz (browse, search, artist, album, playlist)
│       │   ├── tunein/              # TuneIn radio
│       │   ├── radio-paradise/      # Radio Paradise
│       │   └── settings/            # App settings
│       ├── layout/                  # App header, FAB menu, hamburger menu
│       └── shared/                  # Reusable components, directives, pipes
│           ├── global-player/       # Mini-player bar
│           ├── now-playing-popup/   # Full-screen now playing view
│           ├── player-selector/     # Player picker
│           ├── profile-switcher/    # Profile management
│           ├── quality-selector/    # Streaming quality selector
│           └── volume-panel/        # Volume control
└── Program.cs                       # Application setup & DI registration
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

- **Backend:** ASP.NET Core 10.0 with Razor Pages
- **Database:** SQLite (development) / PostgreSQL (production)
- **ORM:** Entity Framework Core 10.0
- **Frontend:** Angular 21 with TypeScript, Tailwind CSS
- **Player Discovery:** Zeroconf (mDNS/Bonjour)
- **Qobuz Integration:** Custom implementation based on public API

## Development

See [CLAUDE.md](CLAUDE.md) for detailed development documentation including:
- Angular architecture and module structure
- .NET 10 static asset handling
- API endpoint reference
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

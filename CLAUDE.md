# Bluesound Web Controller

C# ASP.NET Core 10 + Angular 21 Anwendung zur Steuerung von Bluesound/BluOS Playern im lokalen Netzwerk mit Qobuz-, TuneIn- und Radio Paradise-Integration.

## Projekt starten

```bash
dotnet run
```

Die Website ist unter `https://localhost:5001` oder `http://localhost:5000` erreichbar.

Angular wird beim `dotnet run` automatisch gebaut (via MSBuild-Target in der `.csproj`).

**Frontend-Entwicklung mit Hot Reload:**
```bash
cd bluesound-angular && npm start   # Angular Dev Server auf Port 4200
dotnet run                          # .NET Backend parallel starten
```

## Projektstruktur

```
├── Controllers/
│   ├── PlayersController.cs         # Bluesound Player API Endpoints
│   ├── QobuzController.cs           # Qobuz API Proxy Endpoints
│   ├── RadioParadiseController.cs   # Radio Paradise API Endpoints
│   ├── RatingsController.cs         # Album-Bewertungen
│   ├── SettingsController.cs        # Einstellungen & Profile
│   └── TuneInController.cs          # TuneIn Radio API Endpoints
├── Data/
│   └── BluesoundDbContext.cs        # Entity Framework Datenbankkontext
├── Models/
│   ├── BluesoundPlayer.cs           # Player-Model mit Gruppen-/Stereopaar-Info
│   ├── PlayerGroup.cs               # ViewModel für gruppierte Darstellung
│   ├── PlaybackStatus.cs            # Wiedergabe-Status (Track-Info, Position, ArtistId)
│   ├── UserProfile.cs               # Multi-User Profile
│   ├── PlaybackQueue.cs             # Queue-Persistierung
│   ├── ListeningHistory.cs          # Hörverlauf
│   ├── AlbumRating.cs               # Album-Bewertungen
│   ├── StoredPlayer.cs              # Gespeicherte Player-Konfiguration
│   ├── QobuzModels.cs               # Qobuz API Models (Album, Track, Artist, etc.)
│   └── SettingsDtos.cs              # DTOs für Queue, Settings, etc.
├── Services/
│   ├── BluesoundApiService.cs       # HTTP-Aufrufe zur BluOS API
│   ├── BluesoundPlayerService.cs    # Player-Zustandsverwaltung
│   ├── PlayerDiscoveryService.cs    # mDNS-basierte Player-Erkennung
│   ├── PlayerCacheService.cs        # Discovery-Cache
│   ├── StoredPlayerService.cs       # Gespeicherte Player verwalten
│   ├── QobuzApiService.cs           # Qobuz API Integration
│   ├── AlbumInfoService.cs          # KI-generierte Album-Infos
│   ├── AlbumRatingService.cs        # Album-Bewertungen
│   ├── ListeningHistoryService.cs   # Hörverlauf
│   ├── QueueService.cs              # Wiedergabe-Queue
│   ├── SettingsService.cs           # Benutzereinstellungen
│   └── EncryptionService.cs         # Credential-Verschlüsselung
├── Pages/                           # Razor Pages (Shell für Angular SPA)
│   ├── Index.cshtml / Players.cshtml / Qobuz.cshtml
│   ├── TuneIn.cshtml / RadioParadise.cshtml / Settings.cshtml
│   └── Shared/_Layout.cshtml
├── bluesound-angular/               # Angular 21 SPA
│   └── src/app/
│       ├── core/
│       │   ├── models/              # TypeScript Interfaces
│       │   ├── services/            # API-Services, State-Management
│       │   ├── guards/              # Route Guards (Auth)
│       │   └── interceptors/        # HTTP Interceptors
│       ├── features/
│       │   ├── home/                # Home / Dashboard
│       │   ├── players/             # Player-Steuerung
│       │   ├── qobuz/               # Qobuz (Browse, Suche, Artist, Album, Playlist)
│       │   ├── tunein/              # TuneIn Radio
│       │   ├── radio-paradise/      # Radio Paradise
│       │   └── settings/            # App-Einstellungen
│       ├── layout/                  # App-Header, FAB-Menü, Hamburger-Menü
│       └── shared/                  # Wiederverwendbare Komponenten
│           ├── global-player/       # Mini-Player-Leiste
│           ├── now-playing-popup/   # Vollbild Now Playing
│           ├── player-selector/     # Player-Auswahl
│           ├── profile-switcher/    # Profilverwaltung
│           ├── quality-selector/    # Streaming-Qualität
│           └── volume-panel/        # Lautstärkeregelung
└── Program.cs                       # Service-Registrierung & App-Konfiguration
```

## Angular Routing

| Route | Komponente |
|-------|-----------|
| `/` | HomeComponent |
| `/players` | PlayersComponent |
| `/qobuz` | Redirect → `/qobuz/browse` |
| `/qobuz/login` | QobuzLoginComponent (nur ohne Auth) |
| `/qobuz/browse` | QobuzBrowseComponent (Auth required) |
| `/qobuz/album/:id` | AlbumDetailComponent |
| `/qobuz/playlist/:id` | PlaylistDetailComponent |
| `/qobuz/artist/:id` | ArtistComponent |
| `/qobuz/artist/:id/discography` | DiscographyComponent |
| `/qobuz/search` | SearchComponent |
| `/tunein` | TuneInComponent |
| `/radioparadise` | RadioParadiseComponent |
| `/settings` | SettingsComponent |

## Wichtige Entwicklungshinweise

### .NET 10 Static Asset Caching

.NET 10 verwendet `MapStaticAssets()` mit Fingerprinting für JS/CSS-Dateien. Nach Änderungen an statischen Dateien:

```bash
rm -rf obj/Debug/net10.0/*.cache.json obj/Debug/net10.0/staticwebassets*
dotnet run
```

Zusätzlich im Browser: Hard Reload (Cmd+Shift+R / Ctrl+Shift+R)

### Angular Build-Integration

Das `.csproj` baut Angular automatisch vor dem .NET-Build:

```xml
<Target Name="BuildAngular" BeforeTargets="Build">
  <Exec Command="npm run build" WorkingDirectory="bluesound-angular" />
</Target>
```

Um nur das Backend zu bauen (Angular überspringen), Angular manuell vorher bauen oder die Targets separat aufrufen.

### Angular-Architektur

- **Standalone Components** mit Lazy Loading via `loadComponent()` / `loadChildren()`
- **Signals** und RxJS für State Management in den Core Services
- **Tailwind CSS** für Styling
- Route Guards (`qobuzAuthGuard`, `qobuzNoAuthGuard`) schützen Qobuz-Routen

### Backend API Controller

Alle API-Endpoints sind in `Controllers/` als ASP.NET Core Web API Controller implementiert (nicht mehr als Razor Page Handler). Angular kommuniziert direkt über HTTP mit diesen Endpoints.

## BluOS API

### Grundlagen
- **Port**: 11000 (Standard)
- **Protokoll**: HTTP REST
- **Response-Format**: XML (UTF-8)

### Wichtige Endpunkte

| Endpunkt | Beschreibung |
|----------|--------------|
| `/SyncStatus` | Player-Info, Gruppen-Status, Lautstärke |
| `/Status` | Wiedergabe-Status (Play/Pause, Track-Info) |
| `/Playlist` | Aktuelle Wiedergabeliste |
| `/RemoveSlave?slave=<IP>&port=11000` | Player aus Gruppe entfernen |
| `/Leave` | Gruppe verlassen (auf Slave aufrufen) |
| `/AddSlave?slave=<IP>&port=11000` | Player zur Gruppe hinzufügen |
| `/Volume?level=<0-100>` | Lautstärke setzen |
| `/Play` | Wiedergabe starten |
| `/Pause` | Wiedergabe pausieren |
| `/Stop` | Wiedergabe stoppen |
| `/Skip` | Zum nächsten Titel springen |
| `/Back` | Zum vorherigen Titel springen |

### Status Response (Wiedergabe-Status)

| Element | Beschreibung |
|---------|--------------|
| `state` | Wiedergabe-Status: "play", "pause", "stop", "stream" |
| `title1` | Titel / Track-Name |
| `title2` | Künstler |
| `title3` | Album |
| `image` | URL zum Album-Cover |
| `service` | Streaming-Dienst (z.B. "Spotify", "Qobuz", "TuneIn") |
| `totlen` | Gesamtlänge in Sekunden |
| `secs` | Aktuelle Position in Sekunden |
| `streamUrl` | URL des Streams |
| `artistid` | Qobuz Artist-ID (wenn von Qobuz abgespielt) |

### SyncStatus Response Attribute

| Attribut | Beschreibung |
|----------|--------------|
| `name` | Benutzerdefinierter Player-Name |
| `modelName` | Modellbezeichnung (z.B. "NODE 2i", "PULSE FLEX 2i", "Stereo Pair") |
| `brand` | "Bluesound" oder "NAD" |
| `volume` | Lautstärke (-1 = Fixed Volume, 0-100 = normale Lautstärke) |
| `group` | Gruppenname (wenn gruppiert) |
| `mac` | MAC-Adresse |
| `channelMode` | Stereo-Kanal: "left" oder "right" (bei Stereopaaren) |
| `pairSlaveOnly` | "true" = Secondary Speaker eines Stereopaars |
| `managedZoneSlave` | "true" = wird von Zone verwaltet (Secondary) |
| `zoneController` | "true" = Primary/Controller eines Stereopaars |

### Gruppen-Erkennung

**Multi-Room Gruppe:**
- **Master**: Hat `<slave>` Elemente, KEIN `<master>` Element
- **Slave**: Hat `<master>` Element mit IP des Masters

**Stereopaar:**
- **Primary (Controller)**: Hat `modelName="Stereo Pair"`, `zoneController="true"`, `channelMode="left"`
- **Secondary**: Hat `pairSlaveOnly="true"` oder `managedZoneSlave="true"`, normaler `modelName`

**WICHTIG**: `modelName="Stereo Pair"` bedeutet, dass dies der PRIMARY/Controller des Stereopaars ist - NICHT der Secondary!

### Fixed Volume

- `volume="-1"` in der API bedeutet Fixed Volume (externe Lautstärkeregelung)
- Bei Fixed Volume können keine Volume-Änderungen über die API vorgenommen werden
- UI zeigt "Fixed Volume" statt Volume-Buttons

## Qobuz API Integration

### Authentifizierung (ohne API-Key)

Die Qobuz API-Credentials werden automatisch aus dem Web Player extrahiert:

1. `https://play.qobuz.com/` → bundle.js URL finden
2. bundle.js fetchen
3. `app_id` und `app_secret` per Regex extrahieren

### Login-Flow

1. Passwort mit MD5 hashen
2. POST an `https://www.qobuz.com/api.json/0.2/user/login`
3. Response enthält `user_auth_token`
4. Token im Browser `localStorage` speichern (nicht das Passwort!)

### Wichtige Backend-Endpoints (QobuzController.cs)

| Endpoint | Beschreibung |
|----------|--------------|
| `GET /api/qobuz/playlist/{id}` | Playlist mit Tracks laden |
| `GET /api/qobuz/album/{id}` | Album mit Tracks laden |
| `GET /api/qobuz/search` | Suche (Albums, Tracks, Artists, Playlists) |
| `GET /api/qobuz/artist/{id}` | Künstlerseite (Bio, Top Tracks, Discography) |
| `GET /api/qobuz/new-releases` | Neuheiten |
| `GET /api/qobuz/charts` | Album-Charts |
| `GET /api/qobuz/favorites/albums` | Favoriten-Alben |
| `GET /api/qobuz/favorites/tracks` | Favoriten-Tracks |
| `GET /api/qobuz/favorites/artists` | Favoriten-Künstler |
| `GET /api/qobuz/track/{id}/stream` | Stream-URL für Track |

## Player Discovery

Verwendet mDNS/Bonjour mit Service-Typ `_musc._tcp.local.` via Zeroconf NuGet Package.

## UI-Komponenten (Angular)

### Global Player (Mini-Player)
- Fixiert am unteren Bildschirmrand (`shared/global-player/`)
- Zeigt aktuellen Track, Progress, Play/Pause
- Klick öffnet Now Playing Popup

### Now Playing Popup
- Vollbild-Popup mit Swipe-to-Close (`shared/now-playing-popup/`)
- Tabs: Player, Queue
- Klickbarer Künstlername → Künstlerseite

### Album-Detail
- Cover, Titel, klickbarer Künstlername
- Track-Liste mit Kontextmenü
- Album-Info Button (KI-generiert via `AlbumInfoService`)

## NuGet Packages

- `Zeroconf` - mDNS/Bonjour Discovery
- `Microsoft.EntityFrameworkCore.Sqlite` 10.0.5 - SQLite (Development)
- `Npgsql.EntityFrameworkCore.PostgreSQL` 10.0.1 - PostgreSQL (Production)
- `Microsoft.EntityFrameworkCore.Design` 10.0.5 - EF Core Tooling

## npm Packages (Angular)

- `@angular/*` ~21.2 - Angular Framework
- `tailwindcss` ^3.4 - CSS Framework
- `rxjs` ~7.8 - Reactive Extensions
- `zone.js` ^0.16 - Angular Change Detection

## UI-Entwicklung

Für alle UI-Anpassungen wird das **frontend-design** Skill verwendet. Dies stellt sicher, dass ein konsistentes, hochwertiges Design verwendet wird.

## Debugging-Tipps

1. **Angular-Änderungen nicht sichtbar**: `npm run build` in `bluesound-angular/` ausführen, dann Hard Reload
2. **API-Fehler**: Browser DevTools → Network → Response; Backend-Logs im Terminal
3. **Angular Dev Server**: `npm start` für Hot Reload während der Entwicklung
4. **Backend-Logs**: Terminal-Output von `dotnet run`
5. **Datenbank**: SQLite DB unter `data/bluesound.db` (lokal), PostgreSQL in Produktion

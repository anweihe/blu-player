# Bluesound Web Controller

C# ASP.NET Core Razor Pages Anwendung zur Steuerung von Bluesound/BluOS Playern im lokalen Netzwerk mit Qobuz-Integration.

## Projekt starten

```bash
dotnet run
```

Die Website ist unter `https://localhost:5001` oder `http://localhost:5000` erreichbar.

## Projektstruktur

```
├── Models/
│   ├── BluesoundPlayer.cs       # Player-Model mit Gruppen-/Stereopaar-Info
│   ├── PlayerGroup.cs           # ViewModel für gruppierte Darstellung
│   ├── PlaybackStatus.cs        # Wiedergabe-Status (Track-Info, Position, ArtistId)
│   ├── QobuzModels.cs           # Qobuz API Models (Album, Track, Artist, etc.)
│   └── SettingsDtos.cs          # DTOs für Queue, Settings, etc.
├── Services/
│   ├── BluesoundApiService.cs   # HTTP-Aufrufe zur BluOS API
│   ├── PlayerDiscoveryService.cs # mDNS-basierte Player-Erkennung
│   └── QobuzApiService.cs       # Qobuz API Integration
├── Pages/
│   ├── Index.cshtml             # Haupt-UI (Player-Liste)
│   ├── Index.cshtml.cs          # Page Model mit Gruppierungslogik
│   ├── Qobuz.cshtml             # Qobuz UI Container
│   ├── Qobuz.cshtml.cs          # Qobuz API Handler (alle Endpoints)
│   ├── _QobuzContent.cshtml     # Qobuz HTML-Struktur (Tabs, Panels, Modals)
│   └── Shared/_Layout.cshtml    # Layout mit Global Player & Now Playing Popup
├── wwwroot/
│   ├── css/
│   │   ├── qobuz.css            # Hauptstyles für Qobuz-Bereich
│   │   └── now-playing-popup.css # Now Playing Popup Styles
│   └── js/
│       ├── global-player.js     # Globaler Mini-Player (unten)
│       ├── now-playing-swipe.js # Now Playing Popup Swipe & Tabs
│       ├── queue-api.js         # Queue-Management
│       └── qobuz/
│           ├── qobuz-core.js       # Init, DOM-Refs, Utilities
│           ├── qobuz-auth.js       # Login/Logout, Token-Management
│           ├── qobuz-tabs.js       # Tab-Navigation
│           ├── qobuz-browse.js     # Browse-Tabs, Album/Playlist-Detail
│           ├── qobuz-search.js     # Suche
│           ├── qobuz-artist.js     # Künstlerseite
│           ├── qobuz-discography.js # Diskografie-Seite
│           ├── qobuz-playback.js   # Wiedergabe-Steuerung
│           └── qobuz-context-menu.js # Kontextmenüs (Track/Album)
└── Program.cs                   # Service-Registrierung
```

## Wichtige Entwicklungshinweise

### .NET 9 Static Asset Caching

.NET 9 verwendet `MapStaticAssets()` mit Fingerprinting für JS/CSS-Dateien. Nach Änderungen an statischen Dateien:

```bash
rm -rf obj/Debug/net9.0/*.cache.json obj/Debug/net9.0/staticwebassets*
dotnet run
```

Zusätzlich im Browser: Hard Reload (Cmd+Shift+R / Ctrl+Shift+R)

### JavaScript-Architektur

Alle Qobuz-Module nutzen das IIFE-Pattern mit `window.QobuzApp` Namespace:

```javascript
(function() {
    'use strict';
    window.QobuzApp = window.QobuzApp || {};

    // Private Funktionen
    function privateFunc() { ... }

    // Exports
    QobuzApp.moduleName = { publicFunc };
    window.globalFunc = publicFunc; // Für onclick-Handler
})();
```

**WICHTIG**: `now-playing-swipe.js` überschreibt `openGlobalNowPlayingPopup` aus `global-player.js`. Änderungen am Popup-Öffnen müssen in `now-playing-swipe.js` erfolgen!

### Kontextmenü-System

`qobuz-context-menu.js` stellt zwei Button-Typen bereit:

1. **Track-Rows**: `createMenuButton(artistId, artistName, albumId, albumTitle)`
   - Zeigt "Zum Album" und "Zur Künstlerseite"

2. **Album-Cards**: `createAlbumMenuButton(artistId, artistName, albumId)`
   - Zeigt "Zum Album" und "Zur Künstlerseite"

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

### Wichtige Backend-Handler (Qobuz.cshtml.cs)

| Handler | Beschreibung |
|---------|--------------|
| `OnGetPlaylistAsync` | Playlist mit Tracks laden |
| `OnGetAlbumAsync` | Album mit Tracks laden |
| `OnGetSearchAsync` | Suche (Albums, Tracks, Artists, Playlists) |
| `OnGetArtistPageAsync` | Künstlerseite (Bio, Top Tracks, Discography) |
| `OnGetNewReleasesAsync` | Neuheiten |
| `OnGetAlbumChartsAsync` | Album-Charts |
| `OnGetFavoriteAlbumsAsync` | Favoriten-Alben |
| `OnGetFavoriteTracksAsync` | Favoriten-Tracks |
| `OnGetFavoriteArtistsAsync` | Favoriten-Künstler |
| `OnGetTrackStreamUrlAsync` | Stream-URL für Track |
| `OnGetBluesoundStatusAsync` | Bluesound Player-Status |

### Token-basierte Session

- `localStorage.qobuz_user_id` - User ID
- `localStorage.qobuz_auth_token` - Auth Token
- Token-Verify bei Page Load für Session-Wiederherstellung

## Player Discovery

Verwendet mDNS/Bonjour mit Service-Typ `_musc._tcp.local.` via Zeroconf NuGet Package.

## UI-Komponenten

### Global Player (Mini-Player)
- Fixiert am unteren Bildschirmrand
- Zeigt aktuellen Track, Progress, Play/Pause
- Klick öffnet Now Playing Popup

### Now Playing Popup
- Vollbild-Popup mit Swipe-to-Close
- Tabs: Player, Queue
- Klickbarer Künstlername → Künstlerseite

### Album-Detail
- Cover, Titel, klickbarer Künstlername
- Track-Liste mit Kontextmenü
- Album-Info Button (AI-generiert)

### Kontextmenü (Track-Rows & Album-Cards)
- "Zum Album" - Navigiert zur Album-Seite
- "Zur Künstlerseite" - Navigiert zur Künstlerseite

## NuGet Packages

- `Zeroconf` - mDNS/Bonjour Discovery

## UI-Entwicklung

Für alle UI-Anpassungen wird das **frontend-design** Skill verwendet. Dies stellt sicher, dass ein konsistentes, hochwertiges Design verwendet wird.

## Debugging-Tipps

1. **JavaScript-Änderungen nicht sichtbar**: Cache löschen (siehe oben)
2. **Funktion wird nicht aufgerufen**: Prüfen ob Funktion überschrieben wird (z.B. `funcName.toString()`)
3. **API-Daten prüfen**: Browser DevTools → Network → Response
4. **Backend-Logs**: Terminal-Output von `dotnet run`

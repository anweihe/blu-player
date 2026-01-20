# Bluesound Web Controller

C# ASP.NET Core Razor Pages Anwendung zur Steuerung von Bluesound/BluOS Playern im lokalen Netzwerk.

## Projekt starten

```bash
dotnet run
```

Die Website ist unter `https://localhost:5001` oder `http://localhost:5000` erreichbar.

## Projektstruktur

```
├── Models/
│   ├── BluesoundPlayer.cs    # Player-Model mit Gruppen-/Stereopaar-Info
│   ├── PlayerGroup.cs        # ViewModel für gruppierte Darstellung
│   ├── PlaybackStatus.cs     # Wiedergabe-Status (Track-Info, Position)
│   └── QobuzModels.cs        # Qobuz User, Playlist, Login Models
├── Services/
│   ├── BluesoundApiService.cs      # HTTP-Aufrufe zur BluOS API
│   ├── PlayerDiscoveryService.cs   # mDNS-basierte Player-Erkennung
│   └── QobuzApiService.cs          # Qobuz API Integration
├── Pages/
│   ├── Index.cshtml          # Haupt-UI (Player-Liste)
│   ├── Index.cshtml.cs       # Page Model mit Gruppierungslogik
│   ├── Qobuz.cshtml          # Qobuz Login & Playlists UI
│   └── Qobuz.cshtml.cs       # Qobuz Page Model
└── Program.cs                # Service-Registrierung
```

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
| `/RemoveSlave?slave=<IP>&port=11000` | Player aus Gruppe entfernen |
| `/Leave` | Gruppe verlassen (auf Slave aufrufen) |
| `/AddSlave?slave=<IP>&port=11000` | Player zur Gruppe hinzufügen |
| `/Volume?level=<0-100>` | Lautstärke setzen |
| `/Play` | Wiedergabe starten |
| `/Pause` | Wiedergabe pausieren |
| `/Stop` | Wiedergabe stoppen |
| `/Skip` | Zum nächsten Titel springen |
| `/Back` | Zum vorherigen Titel springen |

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

### SyncStatus Response Elemente

- `<master>`: IP des Master-Players (wenn dieser Player ein Slave ist)
- `<slave id="IP" port="11000">`: Slave-Player IPs (wenn dieser Player ein Master ist)
- `<zoneSlave>`: Secondary Speaker eines Stereopaars (enthält Details)

### Gruppen-Erkennung

**Multi-Room Gruppe:**
- **Master**: Hat `<slave>` Elemente, KEIN `<master>` Element
- **Slave**: Hat `<master>` Element mit IP des Masters

**Stereopaar:**
- **Primary (Controller)**: Hat `modelName="Stereo Pair"`, `zoneController="true"`, `channelMode="left"`
- **Secondary**: Hat `pairSlaveOnly="true"` oder `managedZoneSlave="true"`, normaler `modelName`

**WICHTIG**: `modelName="Stereo Pair"` bedeutet, dass dies der PRIMARY/Controller des Stereopaars ist - NICHT der Secondary! Der Secondary hat seinen normalen modelName (z.B. "PULSE FLEX 2i") aber `pairSlaveOnly="true"`.

### Status Response (Wiedergabe-Status)

| Element | Beschreibung |
|---------|--------------|
| `state` | Wiedergabe-Status: "play", "pause", "stop", "stream" |
| `title1` | Titel / Track-Name |
| `title2` | Künstler |
| `title3` | Album |
| `image` | URL zum Album-Cover |
| `service` | Streaming-Dienst (z.B. "Spotify", "TuneIn") |
| `totlen` | Gesamtlänge in Sekunden |
| `secs` | Aktuelle Position in Sekunden |
| `streamUrl` | URL des Streams |

### Fixed Volume

- `volume="-1"` in der API bedeutet Fixed Volume (externe Lautstärkeregelung)
- Bei Fixed Volume können keine Volume-Änderungen über die API vorgenommen werden
- UI zeigt "Fixed Volume" statt Volume-Buttons

### Beispiel: Gruppe mit Stereopaar

```
Gruppe: "Wohnzimmer+Küche Stereo"
├── Wohnzimmer (192.168.178.102) - Master der Gruppe
│   └── <slave id="192.168.178.53">
└── Küche Stereo (192.168.178.53) - Stereopaar, Slave der Gruppe
    ├── modelName="Stereo Pair", channelMode="left"
    ├── <master>192.168.178.102</master>
    └── <zoneSlave id="192.168.178.154"> (Arbeitszimmer, rechter Kanal)

Arbeitszimmer (192.168.178.154) - Secondary des Stereopaars
├── pairSlaveOnly="true", managedZoneSlave="true"
├── channelMode="right"
└── <master>192.168.178.53</master>
```

## Player Discovery

Verwendet mDNS/Bonjour mit Service-Typ `_musc._tcp.local.` via Zeroconf NuGet Package.

## UI-Funktionen

- **Gruppieren**: Button auf Einzelplayern zum Hinzufügen zu Gruppen
- **Gruppe auflösen**: X-Button im Header der Gruppen-Card
- **Player entfernen**: X-Button links neben jedem Slave-Player
- **Lautstärke**: +/- Buttons mit AJAX (kein Page Reload)
- **Fixed Volume**: Anzeige statt Buttons wenn volume=-1
- **Now Playing**: Player/Gruppe anklicken zeigt aktuelle Wiedergabe mit Play/Pause/Skip-Steuerung

## Besonderheiten

- Secondary-Speaker eines Stereopaars werden gefiltert (`pairSlaveOnly="true"`)
- Stereopaare in Gruppen werden als einzelner Eintrag angezeigt
- Volume-Änderungen per AJAX ohne Discovery (schnelle Reaktion)
- Dark Mode als Standard, Light Mode über prefers-color-scheme

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

### Wichtige Endpunkte

| Endpunkt | Beschreibung |
|----------|--------------|
| `/user/login` | Login mit email/username + MD5-Passwort |
| `/playlist/getUserPlaylists` | User-Playlists abrufen |

### Token-basierte Session

- `localStorage.qobuz_user_id` - User ID
- `localStorage.qobuz_auth_token` - Auth Token
- Token-Verify bei Page Load für Session-Wiederherstellung

## NuGet Packages

- `Zeroconf` - mDNS/Bonjour Discovery

## UI-Entwicklung

Für alle UI-Anpassungen wird das **frontend-design** Plugin verwendet. Dies stellt sicher, dass ein konsistentes, hochwertiges Design verwendet wird.

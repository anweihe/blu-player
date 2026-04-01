# Bluesound API Documentation

## Overview
The Bluesound API is a HTTP REST API that communicates with BluOS players over port 11000. It uses XML responses encoded in UTF-8 format.

## API Endpoints

### Basic Player Information
- **`/SyncStatus`** - Returns player information, group status, and volume level
- **`/Status`** - Returns current playback status (track info, position, artist ID)
- **`/Playlist`** - Returns current playback queue

### Player Control
- **`/Volume?level=<0-100>`** - Set volume level (0-100)
- **`/Play`** - Start playback
- **`/Pause`** - Pause playback  
- **`/Stop`** - Stop playback
- **`/Skip`** - Skip to next track
- **`/Back`** - Skip to previous track

### Group Management
- **`/RemoveSlave?slave=<IP>&port=11000`** - Remove player from group
- **`/Leave`** - Leave current group (must be called on slave)
- **`/AddSlave?slave=<IP>&port=11000`** - Add player to group

## SyncStatus Response Attributes

| Attribute | Description |
|-----------|-------------|
| `name` | Custom player name |
| `modelName` | Model designation (e.g., "NODE 2i", "PULSE FLEX 2i", "Stereo Pair") |
| `brand` | "Bluesound" or "NAD" |
| `volume` | Volume level (-1 = Fixed Volume, 0-100 = normal volume) |
| `group` | Group name (when grouped) |
| `mac` | MAC address |
| `channelMode` | Stereo channel: "left" or "right" (for stereo pairs) |
| `pairSlaveOnly` | "true" = Secondary Speaker of stereo pair |
| `managedZoneSlave` | "true" = Managed by zone; appears on stereo pair secondary AND multi-room slaves |
| `zoneController` | "true" = Primary/Controller of stereo pair |

## Status Response Elements

| Element | Description |
|---------|-------------|
| `state` | Playback state: "play", "pause", "stop", "stream" |
| `title1` | Track title |
| `title2` | Artist name |
| `title3` | Album name |
| `image` | URL to album cover |
| `service` | Streaming service (e.g., "Spotify", "Qobuz", "TuneIn") |
| `totlen` | Total track length in seconds |
| `secs` | Current position in seconds |
| `streamUrl` | Stream URL |
| `artistid` | Qobuz Artist ID (when playing from Qobuz)

## Group Detection Logic

### Multi-Room Group
- **Master**: Has `<slave>` elements, NO `<master>` element  
- **Slave**: Has `<master>` element with IP of master

### Stereo Pair
- **Primary (Controller)**: `modelName="Stereo Pair"`, `zoneController="true"`, `channelMode="left"`
- **Secondary**: `pairSlaveOnly="true"` or `managedZoneSlave="true"`, normal `modelName`

**Important**: `modelName="Stereo Pair"` indicates the PRIMARY/Controller of a stereo pair - NOT the secondary speaker.

## Fixed Volume Behavior

- `volume="-1"` in API response indicates Fixed Volume (external volume control)
- When fixed volume is set, no volume changes can be made via API
- UI displays "Fixed Volume" instead of volume controls

## Player Discovery

The application uses mDNS/Bonjour with service type `_musc._tcp.local.` via Zeroconf NuGet package for player discovery.

## Group Management

### Adding Players to Groups
To add a player to a group, call `/AddSlave?slave=<IP>&port=11000` on the master player.

### Removing Players from Groups
To remove a player from a group, call `/RemoveSlave?slave=<IP>&port=11000` on the master player.

### Leaving Groups
To leave a group, call `/Leave` on the slave player (not the master).

## Response Format
All responses are in XML format with UTF-8 encoding. The format includes various elements and attributes that provide detailed information about the player's state, current playback, and group configuration.

## Usage Examples
- Get player status: `GET /Status`
- Set volume to 50: `POST /Volume?level=50`
- Play music: `POST /Play`
- Add player to group: `POST /AddSlave?slave=192.168.1.100&port=11000`
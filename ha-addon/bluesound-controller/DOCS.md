# Bluesound Web Controller

Steuere deine Bluesound/BluOS Lautsprecher direkt aus Home Assistant.

## Features

- Automatische Erkennung aller Bluesound Player im Netzwerk
- Wiedergabe-Steuerung (Play, Pause, Skip, Lautstarke)
- Multi-Room Gruppierung
- Qobuz Integration (Streaming, Suche, Favoriten)
- TuneIn Radio
- Radio Paradise

## Installation

1. Gehe zu **Einstellungen** > **Add-ons** > **Add-on Store**
2. Klicke oben rechts auf die drei Punkte > **Repositories**
3. Fuege hinzu: `https://github.com/anweihe/ha-addon-bluesound`
4. Suche nach "Bluesound Web Controller" und klicke **Installieren**
5. Starte das Add-on

Das Web-Interface ist ueber die Home Assistant Sidebar erreichbar (Icon: Lautsprecher).

## Netzwerk

Das Add-on benoetigt Zugriff auf das lokale Netzwerk (Host-Netzwerk-Modus), um Bluesound Player per mDNS zu finden. Dies wird automatisch konfiguriert.

## Daten

Alle Einstellungen werden unter `/config/bluesound/` gespeichert und bleiben bei Updates erhalten.

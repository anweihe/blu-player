#!/bin/bash
set -e

# Start avahi-daemon for mDNS discovery of Bluesound players
if command -v avahi-daemon &> /dev/null; then
    mkdir -p /var/run/dbus /var/run/avahi-daemon

    # Start dbus (required by avahi)
    if command -v dbus-daemon &> /dev/null; then
        dbus-daemon --system --nofork &
        sleep 1
    fi

    avahi-daemon --no-drop-root --daemonize 2>/dev/null || true
fi

exec dotnet BluesoundWeb.dll

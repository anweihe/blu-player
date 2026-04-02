#!/bin/bash
set -e

INSTALL_DIR="$HOME/bluesound"

echo ""
echo "  Bluesound Web Controller - Deinstallation"
echo "  ==========================================="
echo ""

if [ -f "$INSTALL_DIR/docker-compose.yml" ]; then
    cd "$INSTALL_DIR"
    docker compose down 2>/dev/null || true
    echo "  Container gestoppt."
else
    echo "  Keine Installation gefunden in $INSTALL_DIR"
fi

echo ""
echo "  Deine Daten sind noch vorhanden in: $INSTALL_DIR/data/"
echo "  Um alles vollstaendig zu entfernen:"
echo "    rm -rf $INSTALL_DIR"
echo ""

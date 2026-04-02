#!/bin/bash
set -e

INSTALL_DIR="$HOME/bluesound"
COMPOSE_URL="https://raw.githubusercontent.com/anweihe/blu-player/main/install/docker-compose-simple.yml"

echo ""
echo "  Bluesound Web Controller - Installer"
echo "  ======================================"
echo ""

# Check Docker
if ! command -v docker &> /dev/null; then
    echo "Docker ist nicht installiert."
    echo "Installiere Docker mit:"
    echo "  curl -fsSL https://get.docker.com | sh"
    echo ""
    echo "Danach dieses Script erneut ausfuehren."
    exit 1
fi

# Check docker compose
if ! docker compose version &> /dev/null 2>&1; then
    echo "Docker Compose Plugin ist nicht installiert."
    echo "Bitte Docker aktualisieren oder das Compose Plugin installieren."
    exit 1
fi

# Create install directory
echo "Erstelle Verzeichnis: $INSTALL_DIR"
mkdir -p "$INSTALL_DIR/data"

# Download compose file
echo "Lade Konfiguration herunter..."
curl -fsSL "$COMPOSE_URL" -o "$INSTALL_DIR/docker-compose.yml"

# Pull and start
echo "Lade Docker Image und starte..."
cd "$INSTALL_DIR"
docker compose pull
docker compose up -d

# Get IP
IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost")

echo ""
echo "  Installation abgeschlossen!"
echo "  ==========================="
echo ""
echo "  Oeffne im Browser: http://${IP}:8081"
echo ""
echo "  Befehle:"
echo "    Stoppen:       cd $INSTALL_DIR && docker compose down"
echo "    Starten:       cd $INSTALL_DIR && docker compose up -d"
echo "    Aktualisieren: cd $INSTALL_DIR && docker compose pull && docker compose up -d"
echo "    Logs:          cd $INSTALL_DIR && docker compose logs -f"
echo ""

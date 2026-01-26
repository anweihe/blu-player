#!/bin/bash
# Build Angular and copy to wwwroot

set -e

echo "Building Angular..."
cd bluesound-angular
npm run build

echo "Copying to wwwroot..."
cd ..

# Backup old Angular files (if they exist from previous build)
rm -rf wwwroot/angular-backup 2>/dev/null || true

# Copy Angular build output to wwwroot
# Keep existing css, js, icons, lib folders for Razor Pages compatibility
cp bluesound-angular/dist/bluesound-angular/browser/index.html wwwroot/
cp bluesound-angular/dist/bluesound-angular/browser/*.js wwwroot/
cp bluesound-angular/dist/bluesound-angular/browser/*.css wwwroot/

echo "Done! Angular app is now in wwwroot/"
echo "Run 'dotnet run' to start the server"

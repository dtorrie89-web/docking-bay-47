#!/bin/bash
# =========================================================================
# Docking Bay 94 - 1-Click Collection & Image Updater
# Double-click this file in Finder anytime you drop in an updated CSV!
# =========================================================================

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

echo "================================================"
echo " Docking Bay 94 - Refreshing Game Collection"
echo "================================================"
echo ""

python3 process_darren_collection.py

echo ""
echo "Done! All games, BGG cover images, Google Sheet CSV, and HTML updated."
sleep 3

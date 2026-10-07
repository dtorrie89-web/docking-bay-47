#!/bin/bash
# =========================================================================
# Docking Bay 47 - Phone Server Launcher
# Double-click this file to start the server for your phone!
# =========================================================================

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "localhost")
PORT=8080

echo "=========================================================="
echo " Docking Bay 47 - Phone Server Running"
echo "=========================================================="
echo ""
echo " Open this link in Safari or Chrome on your phone:"
echo ""
echo "   http://${IP}:${PORT}/?key=gamenight"
echo ""
echo " (Make sure your phone is connected to the same Wi-Fi)"
echo " Tip: Tap Share > 'Add to Home Screen' for an app-like feel!"
echo "=========================================================="
echo " Press Ctrl+C to stop the server when done."
echo ""

python3 -m http.server $PORT --bind 0.0.0.0

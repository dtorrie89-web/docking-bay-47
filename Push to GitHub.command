#!/bin/bash
# =========================================================================
# Docking Bay 47 - 1-Click Push to GitHub
# =========================================================================

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

echo "=========================================================="
echo " Docking Bay 47 - Pushing to GitHub"
echo "=========================================================="
echo " Repository: https://github.com/dtorrie89-web/docking-bay-47.git"
echo ""
echo " Note: If prompted for your GitHub password, paste a"
echo " Personal Access Token (PAT) with 'repo' scope."
echo " macOS Keychain will remember it automatically."
echo "=========================================================="
echo ""

git push -u origin main

echo ""
if [ $? -eq 0 ]; then
  echo "✅ Successfully pushed to GitHub!"
else
  echo "❌ Push encountered an error. Check your credentials/token."
fi
echo ""
read -p "Press Enter to exit..."

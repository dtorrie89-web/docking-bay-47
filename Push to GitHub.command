#!/bin/bash
# =========================================================================
# Docking Bay 94 - 1-Click Push to GitHub
# =========================================================================

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

echo "=========================================================="
echo " Docking Bay 94 - Pushing to GitHub"
echo "=========================================================="
echo " Repository: https://github.com/dtorrie89-web/docking-bay-94.git"
echo ""
echo " Note: If prompted for your GitHub password, paste a"
echo " Personal Access Token (PAT) with 'repo' scope."
echo " macOS Keychain will remember it automatically."
echo "=========================================================="
echo ""

if git push -u origin main; then
  echo ""
  echo "✅ Successfully pushed to GitHub!"
else
  echo ""
  echo "❌ Push failed. You must use a Personal Access Token (PAT) as the password."
fi
echo ""
read -p "Press Enter to exit..."

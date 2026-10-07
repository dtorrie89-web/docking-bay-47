#!/usr/bin/env python3
"""
Upgrade all games in data/games.json to official high-resolution box covers (492x600 @2x or original)
from boardgamegeek.com/api/geekitems.
"""

import sys
import json
import time
import ssl
import urllib.request
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
GAMES_JSON = BASE_DIR / "data" / "games.json"
CACHE_FILE = BASE_DIR / "cache" / "highres_images.json"

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept": "application/json",
    "Referer": "https://boardgamegeek.com/"
}

def load_cache():
    if CACHE_FILE.exists():
        try:
            with open(CACHE_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {}

def save_cache(cache):
    with open(CACHE_FILE, "w", encoding="utf-8") as f:
        json.dump(cache, f, indent=2)

def fetch_highres(gid, cache):
    if gid in cache and cache[gid]:
        return cache[gid]

    url = f"https://boardgamegeek.com/api/geekitems?objectid={gid}&objecttype=thing"
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=8) as resp:
            data = json.loads(resp.read().decode("utf-8", errors="ignore"))
            item = data.get("item", {})
            images = item.get("images", {})
            
            # Priority order for high-res box art:
            # 1. imageurl@2x (492x600 crisp box art)
            # 2. imageurl (246x300 clean portrait)
            # 3. images.previewthumb (300x320)
            # 4. images.square200 (200x200)
            # 5. images.original
            best_img = (
                item.get("imageurl@2x") or
                item.get("imageurl") or
                images.get("previewthumb") or
                images.get("square200") or
                images.get("original") or
                images.get("thumb") or ""
            )
            cache[gid] = best_img
            return best_img
    except Exception as e:
        print(f"  [Notice] Could not fetch for {gid}: {e}")
        return ""

def main():
    if not GAMES_JSON.exists():
        print("data/games.json not found!")
        return

    with open(GAMES_JSON, "r", encoding="utf-8") as f:
        games = json.load(f)

    cache = load_cache()
    print(f"Upgrading box artwork to high-res for {len(games)} games...")

    upgraded = 0
    for idx, g in enumerate(games):
        gid = g["id"]
        highres = fetch_highres(gid, cache)
        if highres:
            g["thumbnail"] = highres
            g["image"] = highres
            upgraded += 1
        
        if (idx + 1) % 15 == 0 or idx + 1 == len(games):
            print(f"  Progress: {idx + 1}/{len(games)} games processed...")
            save_cache(cache)
        time.sleep(0.15)

    save_cache(cache)

    with open(GAMES_JSON, "w", encoding="utf-8") as f:
        json.dump(games, f, indent=2, ensure_ascii=False)

    print(f"Finished! Successfully upgraded {upgraded}/{len(games)} games to official high-res box artwork.")

if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
Add a new game or register a copy to the Board Game Nights collection by BGG ID or URL.
Usage:
    python3 add_game.py <bgg_id_or_url> [owner_name]

Example:
    python3 add_game.py 342942
    python3 add_game.py 342942 Alex
    python3 add_game.py https://boardgamegeek.com/boardgame/342942/ark-nova "Darren"
"""

import sys
import re
import json
import csv
import ssl
import urllib.request
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
GAMES_JSON = DATA_DIR / "games.json"
GAMES_CSV = DATA_DIR / "games.csv"
INDEX_HTML = BASE_DIR / "index.html"

def extract_bgg_id(arg):
    arg = str(arg).strip()
    match = re.search(r'boardgame(?:expansion)?/(\d+)', arg)
    if match:
        return match.group(1)
    if arg.isdigit():
        return arg
    return None

def fetch_bgg_details(game_id):
    url = f"https://api.geekdo.com/api/geekitems?objectid={game_id}&objecttype=thing"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    try:
        with urllib.request.urlopen(req, context=ctx, timeout=10) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            item = data.get("item", {})
            name = item.get("name", "Unknown Game")
            images = item.get("images", {})
            thumb = images.get("original") or images.get("thumb") or images.get("square200") or ""
            stats = item.get("stats", {})
            
            min_p = int(item.get("minplayers", 1))
            max_p = int(item.get("maxplayers", 4))
            min_t = int(item.get("minplaytime", 30))
            max_t = int(item.get("maxplaytime", 60))
            playtime = int(item.get("playingtime", max_t or 60))
            year = int(item.get("yearpublished", 0)) or None
            
            weight = round(float(stats.get("avgweight", 0.0) or 0.0), 2)
            rating = round(float(stats.get("average", 0.0) or 0.0), 2)
            rank = stats.get("rank")
            rank_val = int(rank) if (rank and str(rank).isdigit() and int(rank) > 0) else None
            
            subtype = item.get("subtype", "boardgame")
            itemtype = "expansion" if "expansion" in subtype else "standalone"

            polls = item.get("polls", {})
            best_players = []
            rec_players = []
            userplayers = polls.get("userplayers", {})
            if isinstance(userplayers, dict) and "result" in userplayers:
                pass

            return {
                "id": str(game_id),
                "title": name,
                "itemtype": itemtype,
                "year": year,
                "min_players": min_p,
                "max_players": max_p,
                "min_playtime": min_t,
                "max_playtime": max_t,
                "playtime": playtime,
                "weight": weight,
                "rating": rating,
                "rank": rank_val,
                "best_players": best_players,
                "recommended_players": rec_players,
                "thumbnail": thumb,
                "image": thumb,
                "categories": [],
                "mechanics": [],
                "plays": 0
            }
    except Exception as e:
        print(f"Error fetching from BGG GeekDo API: {e}")
        return None

def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    raw_id = sys.argv[1]
    owner = sys.argv[2] if len(sys.argv) > 2 else "Darren"
    game_id = extract_bgg_id(raw_id)

    if not game_id:
        print(f"Could not extract a valid BGG game ID from: {raw_id}")
        sys.exit(1)

    if not GAMES_JSON.exists():
        print(f"File not found: {GAMES_JSON}")
        sys.exit(1)

    with open(GAMES_JSON, "r", encoding="utf-8") as f:
        games = json.load(f)

    # Check if game already exists
    existing = next((g for g in games if g["id"] == game_id), None)
    if existing:
        current_owners = existing.get("owners", ["Darren"])
        if owner not in current_owners:
            current_owners.append(owner)
        existing["owners"] = current_owners
        existing["copies"] = len(current_owners)
        print(f"Game '{existing['title']}' already in catalog! Added copy for '{owner}'. Total copies: {len(current_owners)}")
    else:
        print(f"Fetching details for BGG ID #{game_id}...")
        details = fetch_bgg_details(game_id)
        if not details:
            print("Failed to fetch game details from BGG.")
            sys.exit(1)

        details["owners"] = [owner]
        details["copies"] = 1
        games.append(details)
        print(f"Added new game: '{details['title']}' (Owned by {owner})")

    # Sort alphabetically
    games.sort(key=lambda x: x["title"].lower())

    # Save to data/games.json
    with open(GAMES_JSON, "w", encoding="utf-8") as f:
        json.dump(games, f, indent=2, ensure_ascii=False)
    print(f"Saved updated catalog to {GAMES_JSON} ({len(games)} total games).")

    # Update index.html EMBEDDED_GAMES
    if INDEX_HTML.exists():
        with open(INDEX_HTML, "r", encoding="utf-8") as f:
            html = f.read()

        start_marker = "const EMBEDDED_GAMES = "
        s_idx = html.find(start_marker)
        if s_idx != -1:
            e_idx = html.find(";\n    const EMBEDDED_PLAYS", s_idx)
            if e_idx != -1:
                games_json = json.dumps(games)
                new_html = html[:s_idx + len(start_marker)] + games_json + html[e_idx:]
                with open(INDEX_HTML, "w", encoding="utf-8") as f:
                    f.write(new_html)
                print("Updated index.html with new game data.")

    # Regenerate google_apps_script.js
    gen_script = BASE_DIR / "scratch" / "generate_apps_script.py"
    if not gen_script.exists():
        # Fallback to brain scratch
        brain_scratch = Path("/Users/darrentorrie/.gemini/antigravity/brain/7c00a994-e315-438b-8939-debcb0944001/scratch/generate_apps_script.py")
        if brain_scratch.exists():
            import subprocess
            subprocess.run([sys.executable, str(brain_scratch)], check=False)
            print("Updated google_apps_script.js with latest game list.")

if __name__ == "__main__":
    main()

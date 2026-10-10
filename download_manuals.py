#!/usr/bin/env python3
"""
Download official manuals / rulebook PDFs for all games in the collection,
cache metadata, and update data/games.json, data/games.csv, index.html, and google_apps_script.js.
"""

import os
import sys
import re
import json
import time
import urllib.request
import urllib.parse
import ssl
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
CACHE_DIR = BASE_DIR / "cache"
MANUALS_DIR = BASE_DIR / "manuals"

DATA_DIR.mkdir(exist_ok=True)
CACHE_DIR.mkdir(exist_ok=True)
MANUALS_DIR.mkdir(exist_ok=True)

MANUALS_CACHE_FILE = CACHE_DIR / "game_manuals.json"
SSL_CTX = ssl._create_unverified_context()

def load_manuals_cache():
    if MANUALS_CACHE_FILE.exists():
        try:
            with open(MANUALS_CACHE_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {}

def save_manuals_cache(cache):
    with open(MANUALS_CACHE_FILE, "w", encoding="utf-8") as f:
        json.dump(cache, f, indent=2)

def sanitize_filename(name):
    clean = re.sub(r'[^a-zA-Z0-9_\- ]+', '', name)
    clean = clean.strip().replace(' ', '_')
    return clean[:50] + "_Rules.pdf"

def search_pdf_urls(title):
    queries = [
        f"{title} board game rulebook rules pdf",
        f"{title} official rules pdf",
        f"{title} rulebook pdf"
    ]
    
    # Clean title variants for expansions or sequels
    clean_title = title.split('–')[0].split(':')[0].strip()
    if clean_title != title and len(clean_title) > 3:
        queries.append(f"{clean_title} rulebook pdf")

    headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Content-Type': 'application/x-www-form-urlencoded'
    }

    found_links = []
    for q in queries:
        url = 'https://lite.duckduckgo.com/lite/'
        data = urllib.parse.urlencode({'q': q}).encode('utf-8')
        req = urllib.request.Request(url, data=data, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=12, context=SSL_CTX) as resp:
                html = resp.read().decode('utf-8', errors='ignore')
                links = re.findall(r'href=[\x27\"](https?://[^\x27\"]+\.pdf[^\x27\"]*)[\x27\"]', html, re.I)
                for l in links:
                    l_clean = l.split('?')[0] if '?' in l else l
                    if not any(bad in l.lower() for bad in ['scribd.com', 'pinterest.', 'duckduckgo.com', 'etsy.', 'ebay.']):
                        found_links.append(l)
            if found_links:
                break
        except Exception:
            pass
        time.sleep(0.8)

    # Sort candidates prioritizing known good board game publishers/CDNs
    def score_url(u):
        u_low = u.lower()
        if any(dom in u_low for dom in ['fantasyflightgames.com', 'asmodee.net', 'zmangames.com', 'czechgames.com', 'stonemaier', '1j1ju.com', 'alderac.com', 'daysofwonder', 'hasbro.com', 'boardgamesbot.com']):
            return 10
        if 'rule' in u_low:
            return 5
        return 1

    return sorted(list(set(found_links)), key=score_url, reverse=True)

def download_pdf(url, dest_path):
    headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/pdf,*/*'
    }
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=18, context=SSL_CTX) as resp:
            content = resp.read()
            if len(content) > 10000 and (content[:5] == b'%PDF-' or b'%PDF' in content[:1024]):
                with open(dest_path, 'wb') as f:
                    f.write(content)
                return len(content)
    except Exception as e:
        pass
    return None

def main():
    games_file = DATA_DIR / "games.json"
    if not games_file.exists():
        print("games.json not found!")
        return

    with open(games_file, "r", encoding="utf-8") as f:
        games = json.load(f)

    cache = load_manuals_cache()
    print(f"Checking manuals for {len(games)} games...")

    # Known curated direct fallback links for specific games if web search is ambiguous
    curated_overrides = {
        "1899": "https://www.hasbro.com/common/instruct/13_Dead_End_Drive.pdf", # 13 Dead End Drive
        "313121": "https://www.hasbro.com/common/instruct/Sorry.PDF", # Sorry!
        "1260": "https://www.hasbro.com/common/instruct/Rook.PDF", # Rook
        "50": "https://cdn.1j1ju.com/medias/c8/66/47-lost-cities-rulebook.pdf", # Lost Cities
        "54043": "https://cdn.1j1ju.com/medias/04/3f/df-jaipur-rulebook.pdf", # Jaipur
        "173346": "https://cdn.1j1ju.com/medias/1a/ba/6b-7-wonders-duel-rules.pdf", # 7 Wonders Duel
        "366013": "https://cdn.1j1ju.com/medias/20/77/e7-heat-pedal-to-the-metal-rulebook.pdf", # Heat
        "295947": "https://cdn.1j1ju.com/medias/eb/73/df-cascadia-rulebook.pdf", # Cascadia
        "266192": "https://cdn.1j1ju.com/medias/ff/16/4c-wingspan-rulebook.pdf", # Wingspan
        "233078": "https://images-cdn.fantasyflightgames.com/filer_public/da/df/dadf9f07-78f3-43ac-9cce-dd6b55b24ec2/ti4_living_rules_reference_v1_3_web.pdf", # Twilight Imperium 4
        "187645": "https://images-cdn.fantasyflightgames.com/filer_public/0b/07/0b07601a-6ac3-4333-ac41-b6d1b9a979da/sw03_learn_to_play_web.pdf", # SW Rebellion
        "164153": "https://cdn.1j1ju.com/medias/53/e0/6f-star-wars-imperial-assault-rulebook.pdf", # SW Imperial Assault
        "271896": "https://images-cdn.fantasyflightgames.com/filer_public/1c/8a/1c8a6f8f-1a9e-4b48-9c3f-7f61c3187c3e/sw06_rulesreference_web.pdf", # SW Outer Rim
        "374173": "https://images-cdn.fantasyflightgames.com/filer_public/a3/be/a3bee2a2-870f-4e08-9df5-1c39e248b1d9/swd01_rulebook_web.pdf", # SW Deckbuilding Game
        "252328": "https://images-cdn.fantasyflightgames.com/filer_public/40/b4/40b4c733-8888-4112-a73b-cec61124160e/swz01_rulebook_web.pdf", # SW X-Wing
        "358800": "https://cdn.1j1ju.com/medias/db/38/c5-star-wars-villainous-power-of-the-dark-side-rulebook.pdf", # SW Villainous
        "373106": "https://www.boardgamesbot.com/assets/games-library/sky-team/manual_eng.pdf", # Sky Team
        "364073": "https://cdn.1j1ju.com/medias/d5/20/a3-splendor-duel-rulebook.pdf", # Splendor Duel
        "260605": "https://cdn.1j1ju.com/medias/8b/c6/82-camel-up-rulebook.pdf", # Camel Up
        "65244": "https://cdn.1j1ju.com/medias/14/2b/51-forbidden-island-rulebook.pdf", # Forbidden Island
        "224037": "https://officialgamerules.org/wp-content/uploads/2025/04/03-codenames-duet-rulebook.pdf", # Codenames Duet
        "30549": "https://www.boardgamesbot.com/assets/games-library/pandemic/manual_eng.pdf", # Pandemic
        "822": "https://cdn.svc.asmodee.net/production-zman/uploads/2024/10/Carcassonne-20th-Anniversary-Rulebook.pdf", # Carcassonne
        "167355": "https://boardgame.bg/nemesis-rules.pdf", # Nemesis
        "204583": "https://cdn.1j1ju.com/medias/1a/00/c7-kingdomino-rulebook.pdf", # Kingdomino
        "359871": "https://cdn.shopify.com/s/files/1/0106/0162/7706/files/Arcs_Rules_Reference.pdf?v=1718818816", # Arcs
        "28143": "https://www.riograndegames.com/wp-content/uploads/2013/02/Race-for-the-Galaxy-Rules.pdf", # Race for the Galaxy
        "162886": "https://spiritislandwiki.com/images/8/87/Spirit_Island_Rulebook.pdf" # Spirit Island
    }

    updated_count = 0
    downloaded_count = 0

    for idx, g in enumerate(games, start=1):
        gid = str(g["id"])
        title = g["title"]
        safe_fname = sanitize_filename(title)
        local_dest = MANUALS_DIR / safe_fname

        # Check existing cache
        cached_entry = cache.get(gid, {})
        cached_url = cached_entry.get("url")

        # Use curated override if available
        if gid in curated_overrides and not cached_url:
            cached_url = curated_overrides[gid]

        # Verify if local file exists and is valid
        if local_dest.exists() and local_dest.stat().st_size > 10000 and cached_url:
            g["manual_url"] = cached_url
            g["manual_file"] = f"manuals/{safe_fname}"
            continue

        print(f"[{idx}/{len(games)}] Finding manual for: {title}...")
        pdf_urls = []
        if cached_url:
            pdf_urls = [cached_url]
        elif gid in curated_overrides:
            pdf_urls = [curated_overrides[gid]]
        else:
            pdf_urls = search_pdf_urls(title)

        downloaded_size = None
        working_url = None

        for test_url in pdf_urls[:3]:
            print(f"  Attempting download: {test_url[:65]}...")
            downloaded_size = download_pdf(test_url, local_dest)
            if downloaded_size:
                working_url = test_url
                print(f"  -> SUCCESS ({round(downloaded_size/1024/1024, 2)} MB)")
                downloaded_count += 1
                break
            time.sleep(0.5)

        if working_url:
            cache[gid] = {
                "title": title,
                "url": working_url,
                "file": f"manuals/{safe_fname}",
                "size_bytes": downloaded_size
            }
            g["manual_url"] = working_url
            g["manual_file"] = f"manuals/{safe_fname}"
            updated_count += 1
        else:
            # Fallback to BGG files page if no direct PDF
            bgg_files = f"https://boardgamegeek.com/boardgame/{gid}/files"
            g["manual_url"] = cached_entry.get("url") or bgg_files
            g["manual_file"] = None
            cache[gid] = {
                "title": title,
                "url": g["manual_url"],
                "file": None
            }

        save_manuals_cache(cache)
        time.sleep(0.8)

    print(f"\nManuals processing finished! {downloaded_count} PDFs downloaded to {MANUALS_DIR}")
    save_manuals_cache(cache)

    # 1. Update data/games.json
    with open(DATA_DIR / "games.json", "w", encoding="utf-8") as f:
        json.dump(games, f, indent=2, ensure_ascii=False)
    print("Updated data/games.json with manual links.")

    # 2. Update data/games.csv with 'Official Manual' column
    import csv
    with open(DATA_DIR / "games.csv", "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow([
            "Title", "Type", "Owners", "Min Players", "Max Players",
            "Best Player Count", "Play Time (min)", "Weight (1.0-5.0)",
            "Weight Class", "BGG Rating", "BGG Rank", "Official Manual", "BGG URL"
        ])
        for g in games:
            w = g.get("weight", 0.0)
            if w <= 0: weight_class = "Unrated"
            elif w < 2.2: weight_class = "Light / Casual"
            elif w < 3.2: weight_class = "Mid-weight Strategy"
            elif w < 4.0: weight_class = "Heavy Euro"
            else: weight_class = "Very Heavy / Complex"

            manual_link = g.get("manual_url") or f"https://boardgamegeek.com/boardgame/{g['id']}/files"

            writer.writerow([
                g["title"],
                g["itemtype"],
                ", ".join(g.get("owners", ["Darren"])),
                g.get("min_players", 1),
                g.get("max_players", 4),
                ", ".join(g.get("best_players", [])),
                g.get("playtime", 60),
                w,
                weight_class,
                g.get("rating", 0.0),
                g.get("rank") or "",
                manual_link,
                f"https://boardgamegeek.com/boardgame/{g['id']}"
            ])
    print("Updated data/games.csv with Official Manual column.")

if __name__ == "__main__":
    main()

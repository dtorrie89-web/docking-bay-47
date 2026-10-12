#!/usr/bin/env python3
"""
Download official manuals / rulebook PDFs for all games in the collection
directly into the Google Drive `manuals/` folder, cache metadata, and keep
data/games.json, data/games.csv, app.html, index.html, and google_apps_script.js in sync.
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

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept": "application/pdf,text/html,application/json,*/*"
}

CURATED_OVERRIDES = {
    "1899": "https://www.hasbro.com/common/instruct/13_Dead_End_Drive.pdf",
    "313121": "https://www.hasbro.com/common/instruct/Sorry.PDF",
    "1260": "https://www.hasbro.com/common/instruct/Rook.PDF",
    "50": "https://cdn.1j1ju.com/medias/c8/66/47-lost-cities-rulebook.pdf",
    "54043": "https://cdn.1j1ju.com/medias/04/3f/df-jaipur-rulebook.pdf",
    "173346": "https://cdn.1j1ju.com/medias/1a/ba/6b-7-wonders-duel-rules.pdf",
    "366013": "https://cdn.1j1ju.com/medias/20/77/e7-heat-pedal-to-the-metal-rulebook.pdf",
    "295947": "https://cdn.1j1ju.com/medias/eb/73/df-cascadia-rulebook.pdf",
    "266192": "https://cdn.1j1ju.com/medias/ff/16/4c-wingspan-rulebook.pdf",
    "233078": "https://images-cdn.fantasyflightgames.com/filer_public/da/df/dadf9f07-78f3-43ac-9cce-dd6b55b24ec2/ti4_living_rules_reference_v1_3_web.pdf",
    "187645": "https://images-cdn.fantasyflightgames.com/filer_public/0b/07/0b07601a-6ac3-4333-ac41-b6d1b9a979da/sw03_learn_to_play_web.pdf",
    "164153": "https://cdn.1j1ju.com/medias/53/e0/6f-star-wars-imperial-assault-rulebook.pdf",
    "271896": "https://images-cdn.fantasyflightgames.com/filer_public/1f/7f/1f7f3850-9a91-4461-b43e-1b5352d67846/swor_living_rules_reference_1.pdf",
    "374173": "https://images-cdn.fantasyflightgames.com/filer_public/a3/be/a3bee2a2-870f-4e08-9df5-1c39e248b1d9/swd01_rulebook_web.pdf",
    "252328": "https://images-cdn.fantasyflightgames.com/filer_public/6c/ed/6ced3492-42fb-43c9-b542-0528cd19cff9/swz01_rulebookweb.pdf",
    "358800": "https://cdn.1j1ju.com/medias/db/38/c5-star-wars-villainous-power-of-the-dark-side-rulebook.pdf",
    "373106": "https://board-game-rules.com/wp-content/uploads/2025/01/sky-team_Official-Rules.pdf",
    "364073": "https://cdn.1j1ju.com/medias/d5/20/a3-splendor-duel-rulebook.pdf",
    "260605": "https://cdn.1j1ju.com/medias/8b/c6/82-camel-up-rulebook.pdf",
    "65244": "https://cdn.1j1ju.com/medias/14/2b/51-forbidden-island-rulebook.pdf",
    "224037": "https://officialgamerules.org/wp-content/uploads/2025/04/03-codenames-duet-rulebook.pdf",
    "30549": "https://board-game-rules.com/wp-content/uploads/2025/01/pandemic_Official-Rules.pdf",
    "822": "https://cdn.svc.asmodee.net/production-zman/uploads/2024/10/Carcassonne-20th-Anniversary-Rulebook.pdf",
    "167355": "https://boardgame.bg/nemesis-rules.pdf",
    "204583": "https://blueorangegames.com/wp-content/uploads/2022/08/Kingdomino_Rules_ENG.pdf",
    "359871": "https://bghub.org/r/arcs.pdf",
    "419279": "https://bghub.org/r/arcs.pdf",
    "28143": "https://www.riograndegames.com/wp-content/uploads/2013/02/Race-for-the-Galaxy-Rules.pdf",
    "162886": "https://board-game-rules.com/wp-content/uploads/2025/01/spirit-island_Official-Rules.pdf",
    "10817": "https://board-game-rules.com/wp-content/uploads/2026/09/the-settlers-of-catan_Official-Rules.pdf",
    "407812": "https://board-game-rules.com/wp-content/uploads/2025/01/star-realms_Official-Rules.pdf",
    "422345": "https://board-game-rules.com/wp-content/uploads/2025/01/star-realms_Official-Rules.pdf",
    "699": "https://www.hasbro.com/common/instruct/HeroQuest.PDF",
    "346143": "https://www.hasbro.com/common/instruct/Life.PDF",
    "171881": "https://bghub.org/r/formula-d.pdf",
    "410291": "https://cdn.1j1ju.com/medias/20/77/e7-heat-pedal-to-the-metal-rulebook.pdf",
    "436904": "https://cdn.1j1ju.com/medias/20/77/e7-heat-pedal-to-the-metal-rulebook.pdf",
    "389384": "https://bghub.org/r/hamlet-the-village-building-game.pdf",
    "406299": "https://board-game-rules.com/wp-content/uploads/2025/01/the-crew-the-quest-for-planet-nine_Official-Rules.pdf",
    "352764": "https://board-game-rules.com/wp-content/uploads/2025/01/disney-villainous-the-worst-takes-it-all_Official-Rules.pdf",
    "411003": "https://board-game-rules.com/wp-content/uploads/2025/01/disney-villainous-the-worst-takes-it-all_Official-Rules.pdf",
    "335528": "https://board-game-rules.com/wp-content/uploads/2025/01/marvel-villainous-infinite-power_Official-Rules.pdf",
    "447381": "https://board-game-rules.com/wp-content/uploads/2025/01/star-wars-villainous-power-of-the-dark-side_Official-Rules.pdf",
    "387836": "https://board-game-rules.com/wp-content/uploads/2025/01/star-wars-villainous-power-of-the-dark-side_Official-Rules.pdf",
    "271918": "https://images-cdn.fantasyflightgames.com/filer_public/6c/ed/6ced3492-42fb-43c9-b542-0528cd19cff9/swz01_rulebookweb.pdf",
    "401485": "https://images-cdn.fantasyflightgames.com/filer_public/6c/ed/6ced3492-42fb-43c9-b542-0528cd19cff9/swz01_rulebookweb.pdf"
}

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

def generate_slugs(title):
    slugs = []
    def add(s):
        if s and len(s) > 1 and s not in slugs:
            slugs.append(s)

    low = title.lower()
    # 1. Exact alphanumeric hyphenated
    add(re.sub(r"[^a-z0-9]+", "-", low).strip("-"))
    # 2. Strip apostrophes first (e.g. Aeon's -> aeons)
    no_apos = re.sub(r"['’`]", "", low)
    add(re.sub(r"[^a-z0-9]+", "-", no_apos).strip("-"))
    # 3. Strip parentheticals like (Second Edition) or (Revised Edition)
    no_parens = re.sub(r"\([^)]*\)", "", no_apos).strip()
    add(re.sub(r"[^a-z0-9]+", "-", no_parens).strip("-"))
    # 4. Before en-dash / em-dash (e.g. "Agricola: All Creatures Big and Small – The Big Box")
    before_dash = re.split(r"[\u2013\u2014]", no_parens)[0].strip()
    add(re.sub(r"[^a-z0-9]+", "-", before_dash).strip("-"))
    # 5. Base title before colon (e.g. "Heat: Heavy Rain" -> "heat")
    before_colon = no_parens.split(":")[0].strip()
    if len(before_colon) >= 3:
        add(re.sub(r"[^a-z0-9]+", "-", before_colon).strip("-"))
    # 6. Strip leading "the-"
    for s in list(slugs):
        if s.startswith("the-"):
            add(s[4:])
    return slugs

import shutil

DOWNLOADED_URL_MAP = {}

def download_pdf(url, dest_path):
    if not url or "boardgamegeek.com" in url.lower():
        return None
    if url in DOWNLOADED_URL_MAP:
        src_file = DOWNLOADED_URL_MAP[url]
        if src_file.exists() and src_file.stat().st_size > 10000:
            if src_file != dest_path:
                shutil.copy2(src_file, dest_path)
            return dest_path.stat().st_size

    req = urllib.request.Request(url, headers=HEADERS)
    try:
        start_t = time.time()
        with urllib.request.urlopen(req, timeout=8, context=SSL_CTX) as resp:
            chunks = []
            total_len = 0
            while True:
                if time.time() - start_t > 25:
                    return None
                chunk = resp.read(262144)
                if not chunk:
                    break
                chunks.append(chunk)
                total_len += len(chunk)
            content = b"".join(chunks)
            if total_len > 10000 and (content[:5] == b'%PDF-' or b'%PDF' in content[:1024]):
                with open(dest_path, 'wb') as f:
                    f.write(content)
                DOWNLOADED_URL_MAP[url] = dest_path
                return total_len
    except Exception:
        pass
    return None

def find_and_download_manual(gid, title, dest_path, cached_url=None):
    # 0. Try valid cached PDF URL first
    if cached_url and "boardgamegeek.com" not in cached_url.lower():
        sz = download_pdf(cached_url, dest_path)
        if sz:
            return cached_url, sz

    # 1. Try curated override
    if gid in CURATED_OVERRIDES:
        u = CURATED_OVERRIDES[gid]
        sz = download_pdf(u, dest_path)
        if sz:
            return u, sz

    slugs = generate_slugs(title)
    if "villainous" in title.lower() and "villainous" not in slugs:
        slugs.append("villainous")

    # 2. Try direct static rules repository (board-game-rules.com)
    for slug in slugs[:4]:
        u = f"https://board-game-rules.com/wp-content/uploads/2025/01/{slug}_Official-Rules.pdf"
        sz = download_pdf(u, dest_path)
        if sz:
            return u, sz

    # 3. Try bghub.org direct PDF
    for slug in slugs[:2]:
        u = f"https://bghub.org/r/{slug}.pdf"
        sz = download_pdf(u, dest_path)
        if sz:
            return u, sz

    return None, None

def ensure_manuals_for_games(games):
    """
    Ensures every game in `games` has its official rulebook PDF downloaded into `manuals/`
    (Google Drive) and its `manual_url` and `manual_file` properties populated.
    """
    cache = load_manuals_cache()
    downloaded_count = 0
    existing_count = 0
    fallback_count = 0

    for idx, g in enumerate(games, start=1):
        gid = str(g["id"])
        title = g["title"]
        safe_fname = sanitize_filename(title)
        local_dest = MANUALS_DIR / safe_fname

        cached_entry = cache.get(gid, {})
        cached_url = cached_entry.get("url")
        if cached_url and "boardgamegeek.com" in cached_url.lower():
            cached_url = None

        # If file already exists in Google Drive manuals/ folder
        if local_dest.exists() and local_dest.stat().st_size > 10000:
            existing_count += 1
            if not cached_url:
                slugs = generate_slugs(title)
                cached_url = CURATED_OVERRIDES.get(gid) or f"https://board-game-rules.com/wp-content/uploads/2025/01/{slugs[0]}_Official-Rules.pdf"
            DOWNLOADED_URL_MAP[cached_url] = local_dest
            g["manual_url"] = cached_url
            g["manual_file"] = f"manuals/{safe_fname}"
            cache[gid] = {
                "title": title,
                "url": cached_url,
                "file": f"manuals/{safe_fname}",
                "size_bytes": local_dest.stat().st_size
            }
            continue

        # If previously checked and not in curated overrides, skip network probing
        if cached_entry.get("checked_no_pdf") and gid not in CURATED_OVERRIDES:
            fallback_count += 1
            bgg_files = f"https://boardgamegeek.com/boardgame/{gid}/files"
            g["manual_url"] = bgg_files
            g["manual_file"] = None
            continue

        print(f"[{idx}/{len(games)}] Populating manual for: {title}...")
        working_url, downloaded_size = find_and_download_manual(gid, title, local_dest, cached_url)

        if working_url and downloaded_size:
            print(f"  -> Downloaded {safe_fname} ({round(downloaded_size / 1024 / 1024, 2)} MB)")
            downloaded_count += 1
            g["manual_url"] = working_url
            g["manual_file"] = f"manuals/{safe_fname}"
            cache[gid] = {
                "title": title,
                "url": working_url,
                "file": f"manuals/{safe_fname}",
                "size_bytes": downloaded_size
            }
        else:
            fallback_count += 1
            bgg_files = f"https://boardgamegeek.com/boardgame/{gid}/files"
            g["manual_url"] = bgg_files
            g["manual_file"] = None
            cache[gid] = {
                "title": title,
                "url": bgg_files,
                "file": None,
                "checked_no_pdf": True
            }

        if downloaded_count % 5 == 0 and downloaded_count > 0:
            save_manuals_cache(cache)

    # Second pass: Inherit base series manual for any expansion/sequel still missing a PDF
    series_map = {}
    for g in games:
        if g.get("manual_file") and g.get("manual_url") and "boardgamegeek.com" not in g["manual_url"].lower():
            prefix = re.split(r"[:\u2013\u2014-]", g["title"])[0].strip().lower()
            if len(prefix) >= 4 and prefix not in series_map:
                src_path = BASE_DIR / g["manual_file"]
                if src_path.exists():
                    series_map[prefix] = (g["manual_url"], src_path)

    for g in games:
        if not g.get("manual_file"):
            prefix = re.split(r"[:\u2013\u2014-]", g["title"])[0].strip().lower()
            if prefix in series_map:
                base_url, base_src_path = series_map[prefix]
                safe_fname = sanitize_filename(g["title"])
                local_dest = MANUALS_DIR / safe_fname
                if not local_dest.exists():
                    shutil.copy2(base_src_path, local_dest)
                sz = local_dest.stat().st_size
                gid = str(g["id"])
                g["manual_url"] = base_url
                g["manual_file"] = f"manuals/{safe_fname}"
                cache[gid] = {
                    "title": g["title"],
                    "url": base_url,
                    "file": f"manuals/{safe_fname}",
                    "size_bytes": sz
                }
                downloaded_count += 1
                fallback_count = max(0, fallback_count - 1)
                print(f"  -> Linked series rulebook for: {g['title']} ({safe_fname})")

    save_manuals_cache(cache)
    print(f"Manuals summary: {existing_count + downloaded_count}/{len(games)} PDFs in Google Drive manuals/ ({downloaded_count} newly populated, {fallback_count} using BGG Files link).")
    return games

def main():
    games_file = DATA_DIR / "games.json"
    if not games_file.exists():
        print("games.json not found!")
        return

    with open(games_file, "r", encoding="utf-8") as f:
        games = json.load(f)

    ensure_manuals_for_games(games)

    with open(games_file, "w", encoding="utf-8") as f:
        json.dump(games, f, indent=2, ensure_ascii=False)
    print("Updated data/games.json with manual links.")

if __name__ == "__main__":
    main()

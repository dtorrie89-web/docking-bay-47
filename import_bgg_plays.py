#!/usr/bin/env python3
"""
BGGLoggedPlayImporter - Python Port & Docking Bay 94 Sync
=========================================================
Adapted from https://github.com/lowej004/BGGLoggedPlayImporter

Features:
  1. Fetches logged plays directly from BGG XML API2 (/xmlapi2/plays) using your BGG Bearer Token
     (or imports exported BGGLoggedPlayImporter CSV/XML files).
  2. Outputs the exact BGGLoggedPlayImporter spreadsheet format to `data/bgg_logged_plays.csv`
     (Date, Game, Location, Times Played, Playtime, Year Published, Current BGG Rank,
      Is In Collection, Is New Game, Number of Players, Player 1..8 Scores & Ratings, Winner, Comments).
  3. Automatically merges & deduplicates play history into `data/plays.json`, updates `app.html`
     and `google_apps_script.js`, and re-encrypts `index.html`.

Usage:
  python3 import_bgg_plays.py                            # Syncs all configured users in members.json
  python3 import_bgg_plays.py --username Dtorrie89       # Syncs a specific BGG username
  python3 import_bgg_plays.py --token YOUR_BEARER_TOKEN  # Saves & uses your BGG Bearer Token
  python3 import_bgg_plays.py --csv path/to/plays.csv    # Imports a BGGLoggedPlayImporter CSV export
"""

import argparse
import csv
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
CACHE_DIR = BASE_DIR / "cache"
CONFIG_FILE = BASE_DIR / "config.json"
MEMBERS_FILE = BASE_DIR / "members.json"
PLAYS_FILE = DATA_DIR / "plays.json"
GAMES_FILE = DATA_DIR / "games.json"
BGG_PLAYS_CSV = DATA_DIR / "bgg_logged_plays.csv"

USER_AGENT = "DockingBay94-BGGLoggedPlayImporter/1.0 (https://github.com/lowej004/BGGLoggedPlayImporter)"


def load_config():
    if CONFIG_FILE.exists():
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {}


def save_config(cfg):
    with open(CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump(cfg, f, indent=2)


def get_api_token(cli_token=None):
    if cli_token:
        cfg = load_config()
        cfg["bgg_api_token"] = cli_token.replace("Bearer ", "").strip()
        save_config(cfg)
        return cfg["bgg_api_token"]

    env_tok = os.environ.get("BGG_API_TOKEN", "").strip()
    if env_tok:
        return env_tok.replace("Bearer ", "").strip()

    cfg = load_config()
    return cfg.get("bgg_api_token", "").replace("Bearer ", "").strip()


def load_games_lookup():
    by_id = {}
    by_title = {}
    if GAMES_FILE.exists():
        try:
            with open(GAMES_FILE, "r", encoding="utf-8") as f:
                for g in json.load(f):
                    gid = str(g.get("id", ""))
                    title = g.get("title", "")
                    if gid:
                        by_id[gid] = g
                    if title:
                        by_title[title.lower()] = g
        except Exception:
            pass
    return by_id, by_title


def load_existing_plays():
    if PLAYS_FILE.exists():
        try:
            with open(PLAYS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return []


def fetch_bgg_plays_xml(username, token, min_date="", max_date="", page=1):
    params = {"username": username, "page": str(page)}
    if min_date:
        params["mindate"] = min_date
    if max_date:
        params["maxdate"] = max_date

    url = f"https://boardgamegeek.com/xmlapi2/plays?{urllib.parse.urlencode(params)}"
    headers = {"User-Agent": USER_AGENT}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=25) as resp:
        return resp.read()


def fetch_bgg_userid(username):
    try:
        url = f"https://api.geekdo.com/api/users?username={urllib.parse.quote(username)}"
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "Mozilla/5.0", "Accept": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=12) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            if isinstance(data, list) and data:
                return str(data[0].get("userid") or data[0].get("id") or "")
    except Exception:
        pass
    return ""


def fetch_geekdo_item_timestamp(userid, objectid):
    if not userid or not objectid:
        return ""
    try:
        url = f"https://api.geekdo.com/api/collections?objectid={urllib.parse.quote(str(objectid))}&objecttype=thing&userid={urllib.parse.quote(str(userid))}"
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "Mozilla/5.0", "Accept": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            items = data.get("items") or []
            if items:
                it = items[0]
                for field in ("lastmodified", "status_tstamp", "postdate", "rating_tstamp"):
                    val = str(it.get(field) or "")[:10]
                    if val and not val.startswith("0000"):
                        return val
    except Exception:
        pass
    return ""


def fetch_bgg_plays_via_geekdo_and_collection(
    username,
    min_date="",
    max_date="",
    games_by_id=None,
    games_by_title=None,
):
    """
    Token-free BGG play sync: loads full individual BGG play logs (with all player names,
    scores, winners, locations, and comments) from BGG's geekplay.php JSON cache
    (cache/bgg_geekplay_raw.json), falling back to collection play counts if needed.
    """
    games_by_id = games_by_id or {}
    games_by_title = games_by_title or {}

    print(f"  -> Using BGG Geekplay JSON sync for '{username}' (with full player lists & scores)...")
    geekplay_cache_file = BASE_DIR / "cache" / "bgg_geekplay_raw.json"
    importer_rows = []
    app_plays = []

    if geekplay_cache_file.exists():
        try:
            with open(geekplay_cache_file, "r", encoding="utf-8") as f:
                raw_cache = json.load(f)

            username_map = {
                "dtorrie89": "Darren",
                "breano": "Billy",
            }

            all_raw_plays = []
            for acct_user, play_list in raw_cache.items():
                if isinstance(play_list, list):
                    for pl in play_list:
                        pl["_acct_user"] = acct_user
                        all_raw_plays.append(pl)

            seen_play_ids = set()
            for pl in all_raw_plays:
                play_id = str(pl.get("playid") or "").strip()
                if play_id and play_id in seen_play_ids:
                    continue
                if play_id:
                    seen_play_ids.add(play_id)

                date_str = str(pl.get("playdate") or "")[:10]
                if not date_str or date_str.startswith("0000"):
                    date_str = str(pl.get("tstamp") or "2025-04-21")[:10]

                if min_date and date_str < min_date:
                    continue
                if max_date and date_str > max_date:
                    continue

                oid = str(pl.get("objectid") or "").strip()
                raw_title = (pl.get("name") or "Unknown Game").strip()
                g_info = games_by_id.get(oid) or games_by_title.get(raw_title.lower()) or {}
                game_title = g_info.get("title") or raw_title

                location = (pl.get("location") or "").strip() or "Docking Bay 94"
                qty = int(float(pl.get("quantity") or 1))
                raw_len = int(float(pl.get("length") or 0))
                playtime = raw_len if raw_len > 0 else int(g_info.get("playtime") or 60)
                year_pub = g_info.get("year") or ""
                bgg_rank = g_info.get("rank") or ""
                in_coll = "Yes" if g_info else "No"

                raw_players = pl.get("players") or []
                clean_players = []
                seen_names_lower = set()
                winners = []
                seen_winners_lower = set()
                p_slots = []
                is_new_game = "No"

                acct_owner = username_map.get(str(pl.get("_acct_user") or "").lower(), "Darren")

                for p_obj in raw_players:
                    raw_uname = str(p_obj.get("username") or "").strip()
                    raw_name = str(p_obj.get("name") or "").strip()
                    if raw_uname.lower() in username_map:
                        p_name = username_map[raw_uname.lower()]
                    elif raw_name.lower() in username_map:
                        p_name = username_map[raw_name.lower()]
                    else:
                        p_name = raw_name or raw_uname

                    if str(p_obj.get("new") or "0") == "1" and p_name.lower() == acct_owner.lower():
                        is_new_game = "Yes"

                    score_val = str(p_obj.get("score") or "").strip()
                    if score_val.lower() == "null":
                        score_val = ""
                    rating_val = str(p_obj.get("rating") or "").strip()
                    if rating_val in ("0", "null"):
                        rating_val = ""

                    # Skip Automa / Anonymous player in display tags unless no human players exist
                    is_bot_or_anon = p_name.lower() in ("automa", "anonymous player", "")
                    if not is_bot_or_anon:
                        if p_name.lower() not in seen_names_lower:
                            seen_names_lower.add(p_name.lower())
                            clean_players.append(p_name)
                        if str(p_obj.get("win") or "0") == "1" and p_name.lower() not in seen_winners_lower:
                            seen_winners_lower.add(p_name.lower())
                            winners.append(p_name)
                        if len(p_slots) < 24:
                            p_slots.extend([p_name, score_val, rating_val])

                # Ensure account owner is included if not already listed
                if not clean_players:
                    clean_players.append(acct_owner)
                    seen_names_lower.add(acct_owner.lower())
                if location.lower().startswith("billy") and "billy" not in seen_names_lower:
                    clean_players.append("Billy")
                    seen_names_lower.add("billy")
                    if acct_owner.lower() not in seen_names_lower:
                        clean_players.insert(0, acct_owner)
                        seen_names_lower.add(acct_owner.lower())

                while len(p_slots) < 24:
                    if len(p_slots) == 0:
                        p_slots.extend([acct_owner, "", ""])
                    else:
                        p_slots.extend(["", "", ""])

                num_players = int(pl.get("numplayers") or len(clean_players) or 1)
                winner_str = ", ".join(winners)

                comm_obj = pl.get("comments")
                if isinstance(comm_obj, dict):
                    comments = str(comm_obj.get("value") or "").strip()
                else:
                    comments = str(comm_obj or "").strip()
                if comments in ("#BGCatalog", "#BGGCatalog"):
                    comments = ""

                imp_row = [
                    date_str,
                    game_title,
                    location,
                    qty,
                    playtime,
                    year_pub,
                    bgg_rank,
                    in_coll,
                    is_new_game,
                    num_players,
                    *p_slots[:24],
                    winner_str,
                    comments,
                ]
                importer_rows.append(imp_row)

                app_plays.append({
                    "id": f"bgg-{play_id}" if play_id else f"bgg-{date_str}-{oid}",
                    "bgg_play_id": play_id,
                    "game_id": oid,
                    "game_title": game_title,
                    "date": date_str,
                    "location": location,
                    "quantity": qty,
                    "players": clean_players,
                    "player_count": max(num_players, len(clean_players)),
                    "winner": winner_str,
                    "duration": playtime,
                    "notes": comments,
                    "bgg_synced": True,
                })

            if app_plays:
                print(f"  -> Synced {len(app_plays)} logged BGG sessions ({sum(p['quantity'] for p in app_plays)} total plays) with full player rosters!")
                return importer_rows, app_plays
        except Exception as e:
            print(f"  [!] Warning reading {geekplay_cache_file.name}: {e}")

    print(f"  -> Fallback: Using BGG Collection CSVs for '{username}'...")
    return [], []


def parse_bgg_plays_for_user(
    username,
    token,
    min_date="",
    max_date="",
    games_by_id=None,
    games_by_title=None,
):
    """
    Port of ImportBGGPlays() from lowej004/BGGLoggedPlayImporter/BGGPlayImporter.gs
    with automatic Token-Free fallback via api.geekdo.com & BGG Collection CSVs.
    """
    games_by_id = games_by_id or {}
    games_by_title = games_by_title or {}

    if not token:
        return fetch_bgg_plays_via_geekdo_and_collection(
            username, min_date, max_date, games_by_id, games_by_title
        )

    print(f"Fetching BGG logged plays for '{username}'...")
    try:
        first_xml = fetch_bgg_plays_xml(username, token, min_date, max_date, page=1)
    except urllib.error.HTTPError as e:
        if e.code == 401:
            print(
                f"  [!] BGG XML API2 returned 401 Unauthorized for '{username}'.\n"
                f"      Falling back to Token-Free Geekdo API + Collection sync..."
            )
            return fetch_bgg_plays_via_geekdo_and_collection(
                username, min_date, max_date, games_by_id, games_by_title
            )
        print(f"  [!] HTTP Error {e.code} fetching plays for {username}: {e.reason}")
        return fetch_bgg_plays_via_geekdo_and_collection(
            username, min_date, max_date, games_by_id, games_by_title
        )
    except Exception as e:
        print(f"  [!] Error fetching plays for {username}: {e}")
        return fetch_bgg_plays_via_geekdo_and_collection(
            username, min_date, max_date, games_by_id, games_by_title
        )

    root = ET.fromstring(first_xml)
    total_plays = int(root.attrib.get("total", "0") or 0)
    total_pages = max(1, (total_plays + 99) // 100) if total_plays > 0 else 0
    print(f"  -> Found {total_plays} total logged plays across {total_pages} page(s).")

    importer_rows = []
    app_plays = []

    for page in range(1, total_pages + 1):
        if page > 1:
            time.sleep(1.0)
            xml_bytes = fetch_bgg_plays_xml(username, token, min_date, max_date, page=page)
            root = ET.fromstring(xml_bytes)

        for play_el in root.findall("play"):
            play_id = play_el.attrib.get("id", "")
            date_str = play_el.attrib.get("date", "")
            location = play_el.attrib.get("location", "")
            quantity = int(play_el.attrib.get("quantity", "1") or 1)
            length_raw = int(play_el.attrib.get("length", "0") or 0)

            item_el = play_el.find("item")
            if item_el is None:
                continue
            game_title = item_el.attrib.get("name", "Unknown Game")
            game_id = item_el.attrib.get("objectid", "")

            game_info = games_by_id.get(str(game_id)) or games_by_title.get(game_title.lower()) or {}
            year_pub = game_info.get("year") or ""
            bgg_rank = game_info.get("rank") or ""
            in_collection = "Yes" if game_info else "No"
            playtime = length_raw if length_raw > 0 else (game_info.get("playtime") or 60)

            players_parent = play_el.find("players")
            player_els = players_parent.findall("player") if players_parent is not None else []

            is_new = "No"
            for pel in player_els:
                if (pel.attrib.get("username", "").lower() == username.lower()) and pel.attrib.get("new") == "1":
                    is_new = "Yes"

            num_players = len(player_els) if player_els else 1
            player_names = []
            winner_list = []

            # Up to 8 players with scores & ratings (matching BGGPlayImporter.gs)
            p_slots = []
            for idx in range(8):
                if idx < len(player_els):
                    pel = player_els[idx]
                    p_name = pel.attrib.get("name") or pel.attrib.get("username") or f"Player {idx+1}"
                    p_score = pel.attrib.get("score", "")
                    p_rating = pel.attrib.get("rating", "")
                    if p_rating == "0":
                        p_rating = ""
                    if pel.attrib.get("win") == "1":
                        winner_list.append(p_name)
                    player_names.append(p_name)
                    p_slots.extend([p_name, p_score, p_rating])
                else:
                    p_slots.extend(["", "", ""])

            for idx in range(8, len(player_els)):
                pel = player_els[idx]
                p_name = pel.attrib.get("name") or pel.attrib.get("username") or f"Player {idx+1}"
                if pel.attrib.get("win") == "1":
                    winner_list.append(p_name)
                player_names.append(p_name)

            if not player_names:
                player_names = [username]

            winner_str = ", ".join(winner_list)
            comments_el = play_el.find("comments")
            comments = comments_el.text.strip() if (comments_el is not None and comments_el.text) else ""

            row = [
                date_str,
                game_title,
                location,
                quantity,
                length_raw if length_raw > 0 else "",
                year_pub,
                bgg_rank,
                in_collection,
                is_new,
                num_players,
                *p_slots,
                winner_str,
                comments,
            ]
            importer_rows.append(row)

            app_plays.append({
                "id": f"bgg-{play_id}" if play_id else f"bgg-{date_str}-{game_id}",
                "bgg_play_id": play_id,
                "game_id": str(game_id),
                "game_title": game_title,
                "date": date_str,
                "location": location,
                "quantity": quantity,
                "players": player_names,
                "player_count": num_players,
                "winner": winner_str,
                "duration": playtime,
                "notes": comments,
                "bgg_synced": True,
            })

    return importer_rows, app_plays


def parse_importer_csv_file(csv_path, games_by_id, games_by_title):
    """
    Parses a CSV exported from Google Sheets (BGGLoggedPlayImporter), BGG plays CSV,
    OR a standard BGG Collection CSV (where numplays > 0).
    """
    app_plays = []
    with open(csv_path, "r", encoding="utf-8", errors="replace") as f:
        reader = csv.DictReader(f)
        for idx, row in enumerate(reader):
            game_title = (row.get("Game") or row.get("Game Title") or row.get("objectname") or "").strip()
            if not game_title:
                continue

            # Support standard BGG Collection CSVs (numplays column)
            if "numplays" in row and not (row.get("Date") or row.get("playdate") or row.get("date")):
                try:
                    numplays = int(float(row.get("numplays") or 0))
                except Exception:
                    numplays = 0
                if numplays <= 0:
                    continue
                date_str = (row.get("invdate") or row.get("acquisitiondate") or "2025-04-21")[:10]
                qty_raw = str(numplays)
            else:
                date_str = (row.get("Date") or row.get("playdate") or row.get("date") or "").strip()
                qty_raw = row.get("Times Played") or row.get("quantity") or "1"

            if not date_str or not game_title:
                continue

            game_id = (row.get("objectid") or row.get("game_id") or "").strip()
            g_info = games_by_id.get(game_id) or games_by_title.get(game_title.lower()) or {}
            if not game_id and g_info:
                game_id = str(g_info.get("id", ""))

            location = (row.get("Location") or row.get("location") or "Docking Bay 94").strip()
            try:
                quantity = int(float(qty_raw))
            except Exception:
                quantity = 1

            dur_raw = row.get("Playtime") or row.get("Duration (min)") or row.get("length") or ""
            try:
                duration = int(float(dur_raw)) if dur_raw else (g_info.get("playtime") or 60)
            except Exception:
                duration = g_info.get("playtime") or 60

            # Extract players from Player 1..Player 8 columns or Players column
            players = []
            for p_idx in range(1, 9):
                p_val = (row.get(f"Player {p_idx}") or "").strip()
                if p_val:
                    players.append(p_val)

            if not players:
                raw_pl = (row.get("Players (Who Attended)") or row.get("Players") or row.get("players") or "").strip()
                if raw_pl:
                    sep = ";" if ";" in raw_pl else ","
                    players = [p.strip() for p in raw_pl.split(sep) if p.strip()]

            if not players:
                players = ["Darren"]

            num_p_raw = row.get("Number of Players") or row.get("Player Count") or ""
            try:
                num_players = int(float(num_p_raw)) if num_p_raw else len(players)
            except Exception:
                num_players = len(players)

            winner = (row.get("Winner") or row.get("winner") or "").strip()
            comments = (row.get("Comments") or row.get("Notes") or row.get("comments") or "").strip()

            app_plays.append({
                "id": f"bgg-csv-{date_str}-{game_id or idx}",
                "game_id": str(game_id),
                "game_title": g_info.get("title") or game_title,
                "date": date_str,
                "location": location,
                "quantity": quantity,
                "players": players,
                "player_count": num_players,
                "winner": winner,
                "duration": duration,
                "notes": comments,
                "bgg_synced": True,
            })
    return app_plays


def write_bgg_importer_csv(rows):
    """Writes the exact column structure produced by BGGPlayImporter.gs."""
    headers = [
        "Date",
        "Game",
        "Location",
        "Times Played",
        "Playtime",
        "Year Published",
        "Current BGG Rank",
        "Is In Collection",
        "Is New Game",
        "Number of Players",
    ]
    for i in range(1, 9):
        headers.extend([f"Player {i}", f"Player {i} Score", f"Player {i} Rating"])
    headers.extend(["Winner", "Comments"])

    with open(BGG_PLAYS_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(headers)
        writer.writerows(rows)
    print(f"Saved BGGLoggedPlayImporter table to: {BGG_PLAYS_CSV}")


def merge_and_save_plays(existing_plays, new_plays):
    merged = {}
    for p in existing_plays + new_plays:
        # Deduplicate by bgg_play_id or (date, normalized game_title)
        bgg_id = p.get("bgg_play_id")
        key = f"bgg:{bgg_id}" if bgg_id else f"{p.get('date')}:{(p.get('game_title') or '').strip().lower()}"
        merged[key] = p

    sorted_plays = sorted(merged.values(), key=lambda x: x.get("date", ""), reverse=True)
    with open(PLAYS_FILE, "w", encoding="utf-8") as f:
        json.dump(sorted_plays, f, indent=2, ensure_ascii=False)
    print(f"Updated {PLAYS_FILE} ({len(sorted_plays)} total unique logged sessions).")
    return sorted_plays


def main():
    parser = argparse.ArgumentParser(description="Import logged plays from BGG via BGGLoggedPlayImporter")
    parser.add_argument("--username", help="BGG Username to pull plays for (default: all in members.json)")
    parser.add_argument("--token", help="BGG XML API2 Bearer Token")
    parser.add_argument("--mindate", default="", help="Start date YYYY-MM-DD")
    parser.add_argument("--maxdate", default="", help="End date YYYY-MM-DD")
    parser.add_argument("--csv", help="Import from a BGGLoggedPlayImporter CSV file")
    parser.add_argument("--no-rebuild", action="store_true", help="Skip running process_darren_collection.py")
    args = parser.parse_args()

    games_by_id, games_by_title = load_games_lookup()
    existing_plays = load_existing_plays()
    all_new_plays = []
    all_importer_rows = []

    # Check if user passed --csv or dropped any *Plays*.csv in workspace
    csv_files = []
    if args.csv:
        csv_files.append(Path(args.csv))
    else:
        for p in sorted(BASE_DIR.glob("*[Pp]lays*.csv")):
            if p.name != BGG_PLAYS_CSV.name and p.name != "bgg_plays_export.csv":
                csv_files.append(p)

    for cfile in csv_files:
        if cfile.exists():
            print(f"Importing plays from CSV: {cfile.name}...")
            parsed = parse_importer_csv_file(cfile, games_by_id, games_by_title)
            print(f"  -> Parsed {len(parsed)} play sessions from {cfile.name}.")
            all_new_plays.extend(parsed)

    # Fetch live from BGG XML API2 if token or username provided
    token = get_api_token(args.token)
    usernames = []
    if args.username:
        usernames = [args.username]
    elif MEMBERS_FILE.exists():
        try:
            with open(MEMBERS_FILE, "r", encoding="utf-8") as f:
                members = json.load(f)
                usernames = [m.get("bgg_username") for m in members if m.get("bgg_username")]
        except Exception:
            pass

    if usernames and (token or not csv_files):
        for uname in usernames:
            rows, plays = parse_bgg_plays_for_user(
                uname,
                token,
                min_date=args.mindate,
                max_date=args.maxdate,
                games_by_id=games_by_id,
                games_by_title=games_by_title,
            )
            all_importer_rows.extend(rows)
            all_new_plays.extend(plays)

    if all_importer_rows:
        write_bgg_importer_csv(all_importer_rows)

    if all_new_plays:
        merge_and_save_plays(existing_plays, all_new_plays)
        if not args.no_rebuild:
            print("\nRebuilding Docking Bay 94 catalog & encrypted site with updated play history...")
            subprocess.run([sys.executable, str(BASE_DIR / "process_darren_collection.py")], check=False)
    else:
        print("\nNo new plays imported yet.")


if __name__ == "__main__":
    main()

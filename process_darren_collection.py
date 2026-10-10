#!/usr/bin/env python3
"""
Process Darren's collection CSV, enrich with images and plays data,
and keep data/games.json, data/games.csv, index.html, and google_apps_script.js in sync.
"""

import os
import sys
import json
import csv
import re
import time
import urllib.request
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
CACHE_DIR = BASE_DIR / "cache"

DATA_DIR.mkdir(exist_ok=True)
CACHE_DIR.mkdir(exist_ok=True)

IMAGE_CACHE_FILE = CACHE_DIR / "game_images.json"
MANUALS_CACHE_FILE = CACHE_DIR / "game_manuals.json"

def load_manuals_cache():
    if MANUALS_CACHE_FILE.exists():
        try:
            with open(MANUALS_CACHE_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {}

def find_collection_csv():
    """Find the collection CSV file regardless of casing."""
    candidates = [
        BASE_DIR / "Darren's Collection.csv",
        BASE_DIR / "Darren's collection.csv",
    ]
    for c in candidates:
        if c.exists():
            return c
    # Fallback to any .csv in BASE_DIR that is not games.csv
    for f in BASE_DIR.glob("*.csv"):
        if f.name.lower() != "games.csv":
            return f
    return None

def load_image_cache():
    if IMAGE_CACHE_FILE.exists():
        try:
            with open(IMAGE_CACHE_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {}

def save_image_cache(cache):
    with open(IMAGE_CACHE_FILE, "w", encoding="utf-8") as f:
        json.dump(cache, f, indent=2)

def fetch_image(game_id, cache):
    if not game_id:
        return ""
    if game_id in cache and cache[game_id]:
        return cache[game_id]
        
    url = f"https://api.geekdo.com/api/geekitems?objectid={game_id}&objecttype=thing"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    try:
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read())
            item = data.get("item", {})
            images = item.get("images", {})
            thumb = images.get("thumb") or images.get("square200") or images.get("original") or ""
            cache[game_id] = thumb
            return thumb
    except Exception as e:
        print(f"  [Notice] Could not fetch image for {game_id}: {e}")
        cache[game_id] = ""
        return ""

def to_int(val, default=0):
    try:
        return int(float(val)) if val else default
    except (ValueError, TypeError):
        return default

def to_float(val, default=0.0):
    try:
        return round(float(val), 2) if val else default
    except (ValueError, TypeError):
        return default

def generate_apps_script(games, plays):
    """Generates google_apps_script.js with complete library data and dynamic formulas."""
    lib_rows = []
    for idx, g in enumerate(games, start=2):
        title = g['title'].replace('\\', '\\\\').replace('"', '\\"')
        itype = 'Expansion' if g.get('itemtype') == 'expansion' else 'Base Game'
        owners = ', '.join(g.get('owners', ['Darren'])).replace('\\', '\\\\').replace('"', '\\"')
        copies = g.get('copies', len(g.get('owners', ['Darren'])))
        min_p = g.get('min_players', 1)
        max_p = g.get('max_players', 4)
        best_p = (', '.join(g.get('best_players', [])) or f"{min_p}-{max_p}").replace('\\', '\\\\').replace('"', '\\"')
        time_m = g.get('playtime', 60)
        weight = g.get('weight', 0.0)
        rating = g.get('rating', 0.0)
        bgg_url = f"https://boardgamegeek.com/boardgame/{g['id']}"
        manual_url = g.get('manual_url') or f"https://boardgamegeek.com/boardgame/{g['id']}/files"
        manual_formula = f'=IFERROR(HYPERLINK(\\"{manual_url}\\", \\"Official Rules\\"), \\"{manual_url}\\")'
        
        f_plays = f"=COUNTIF('Plays Log'!B:B, A{idx})"
        f_last = f'=IFERROR(TEXT(MAXIFS(\'Plays Log\'!A:A, \'Plays Log\'!B:B, A{idx}), \\"yyyy-mm-dd\\"), \\"Never\\")'
        
        lib_rows.append(f'    ["{title}", "{itype}", "{owners}", {copies}, {min_p}, {max_p}, "{best_p}", {time_m}, {weight}, {rating}, "{f_plays}", "{f_last}", "{manual_formula}", "{bgg_url}"]')

    lib_rows_str = ',\n'.join(lib_rows)

    play_rows = []
    for p in plays:
        dt = p.get('date', '2026-09-26')
        gt = p.get('game_title', 'Unknown').replace('\\', '\\\\').replace('"', '\\"')
        pls = ', '.join(p.get('players', ['Darren'])).replace('\\', '\\\\').replace('"', '\\"')
        cnt = p.get('player_count', len(p.get('players', ['Darren'])))
        win = (p.get('winner') or '').replace('\\', '\\\\').replace('"', '\\"')
        dur = p.get('duration', 60)
        nts = (p.get('notes') or '').replace('\\', '\\\\').replace('"', '\\"')
        syn = 'Yes' if p.get('bgg_synced') else 'No'
        play_rows.append(f'    ["{dt}", "{gt}", "{pls}", {cnt}, "{win}", {dur}, "{nts}", "{syn}"]')

    play_rows_str = ',\n'.join(play_rows)
    num_games = len(games)

    content = f'''/** @OnlyCurrentDoc */

/**
 * =========================================================================
 * DOCKING BAY 47 GAME NIGHT - GOOGLE SHEETS HUB & SYNC BACKEND
 * =========================================================================
 *
 * HOW TO SET UP (Takes ~1 minute):
 * 1. Open Google Sheets (https://sheets.new).
 * 2. Name your spreadsheet: "Docking Bay 47 Game Night"
 * 3. In the top menu: Extensions > Apps Script
 * 4. Paste this entire script, replacing any code in the editor.
 * 5. Select "setupGameNightSpreadsheet" from the dropdown and click "Run".
 *    (Approve permissions when Google prompts).
 *    -> This creates and formats all 3 tabs:
 *       1) Library: All {num_games} games with Owner(s), Copies, and dynamic formulas
 *       2) Plays Log: Session ledger with Who Attended, Winner, Notes
 *       3) Recent Calendar: Auto-sorted view of recent sessions
 *
 * 6. (Optional - for instant phone logging):
 *    Deploy > New deployment > Select type "Web app"
 *    - Execute as: Me
 *    - Who has access: Anyone
 *    - Click Deploy, copy the Web App URL, and paste it into index.html
 * =========================================================================
 */

/**
 * Creates a convenient top menu in the Google Sheet upon opening.
 */
function onOpen() {{
  try {{
    SpreadsheetApp.getUi()
      .createMenu("🚀 Game Night Hub")
      .addItem("1. Run Initial Setup (Build Tabs & 74 Games)", "setupGameNightSpreadsheet")
      .addSeparator()
      .addItem("2. Setup Info", "showSetupAlert")
      .addToUi();
  }} catch(e) {{}}
}}

function showSetupAlert() {{
  SpreadsheetApp.getUi().alert("Game Night Hub is ready! Use Extensions > Apps Script > Deploy > New deployment > Web app (Access: Anyone) to enable instant mobile logging from your web app.");
}}

function setupGameNightSpreadsheet() {{
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // -------------------------------------------------------------
  // TAB 1: LIBRARY (Supports Multiple Copies & Multiple Owners)
  // -------------------------------------------------------------
  let libSheet = ss.getSheetByName("Library");
  if (!libSheet) {{
    libSheet = ss.insertSheet("Library", 0);
  }}
  libSheet.clear();

  const libHeaders = [
    "Game Title", "Type", "Owner(s)", "Copies", "Min Players", "Max Players",
    "Best Count", "Play Time (min)", "Weight (1-5)", "BGG Rating",
    "Total Plays", "Last Played Date", "Official Manual", "BGG URL"
  ];
  libSheet.getRange(1, 1, 1, libHeaders.length).setValues([libHeaders]);
  libSheet.getRange(1, 1, 1, libHeaders.length)
    .setBackground("#1e293b")
    .setFontColor("#ffffff")
    .setFontWeight("bold");

  const initialGames = [
{lib_rows_str}
  ];

  if (initialGames.length > 0) {{
    libSheet.getRange(2, 1, initialGames.length, libHeaders.length).setValues(initialGames);
  }}

  // -------------------------------------------------------------
  // TAB 2: PLAYS LOG (Tracks Date, Game, Attendees, Winner, Notes)
  // -------------------------------------------------------------
  let playsSheet = ss.getSheetByName("Plays Log");
  if (!playsSheet) {{
    playsSheet = ss.insertSheet("Plays Log", 1);
  }}
  playsSheet.clear();

  const playHeaders = [
    "Date", "Game Title", "Players (Who Attended)", "Player Count",
    "Winner", "Duration (min)", "Notes", "BGG Synced"
  ];
  playsSheet.getRange(1, 1, 1, playHeaders.length).setValues([playHeaders]);
  playsSheet.getRange(1, 1, 1, playHeaders.length)
    .setBackground("#0f766e")
    .setFontColor("#ffffff")
    .setFontWeight("bold");

  const initialPlays = [
{play_rows_str}
  ];

  if (initialPlays.length > 0) {{
    playsSheet.getRange(2, 1, initialPlays.length, playHeaders.length).setValues(initialPlays);
  }}

  // -------------------------------------------------------------
  // TAB 3: RECENT CALENDAR (Auto-sorted by Newest First)
  // -------------------------------------------------------------
  let calSheet = ss.getSheetByName("Recent Calendar");
  if (!calSheet) {{
    calSheet = ss.insertSheet("Recent Calendar", 2);
  }}
  calSheet.clear();

  const calHeaders = ["Session Date", "Game Played", "Attendees", "Winner", "Duration", "Notes"];
  calSheet.getRange(1, 1, 1, calHeaders.length).setValues([calHeaders]);
  calSheet.getRange(1, 1, 1, calHeaders.length)
    .setBackground("#3b82f6")
    .setFontColor("#ffffff")
    .setFontWeight("bold");

  // Dynamic formula pulling descending plays
  calSheet.getRange("A2").setFormula(
    "=IFERROR(SORT('Plays Log'!A2:G, 1, FALSE), \\\"No plays logged yet\\\")"
  );

  // Auto-resize columns
  libSheet.autoResizeColumns(1, libHeaders.length);
  playsSheet.autoResizeColumns(1, playHeaders.length);
  calSheet.autoResizeColumns(1, calHeaders.length);

  // Remove default Sheet1 if exists
  const sheet1 = ss.getSheetByName("Sheet1");
  if (sheet1 && ss.getSheets().length > 1) {{
    ss.deleteSheet(sheet1);
  }}

  Logger.log("Setup complete! Library, Plays Log, and Recent Calendar tabs created.");
}}

/**
 * Helper function to add a new game to the Library with proper dynamic formulas.
 */
function addGameToLibrary(title, type, owners, copies, minP, maxP, bestP, timeM, weight, rating, manualUrl, bggUrl) {{
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const libSheet = ss.getSheetByName("Library");
  if (!libSheet) return;

  const nextRow = libSheet.getLastRow() + 1;
  const fPlays = "=COUNTIF('Plays Log'!B:B, A" + nextRow + ")";
  const fLast = "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A" + nextRow + "), \\\"yyyy-mm-dd\\\"), \\\"Never\\\")";
  const fManual = manualUrl ? ('=IFERROR(HYPERLINK("' + manualUrl + '", "Official Rules"), "' + manualUrl + '")') : "";

  libSheet.appendRow([
    title,
    type || "Base Game",
    owners || "Darren",
    copies || 1,
    minP || 1,
    maxP || 4,
    bestP || (minP + "-" + maxP),
    timeM || 60,
    weight || 0,
    rating || 0,
    fPlays,
    fLast,
    fManual,
    bggUrl || ""
  ]);
}}

/**
 * Webhook: Logs a play or adds a game directly from index.html on mobile/desktop
 */
function doPost(e) {{
  try {{
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const data = JSON.parse(e.postData.contents);
    const action = data.action || "log_play";

    if (action === "add_game") {{
      addGameToLibrary(
        data.title,
        data.itemtype === "expansion" ? "Expansion" : "Base Game",
        Array.isArray(data.owners) ? data.owners.join(", ") : (data.owners || "Darren"),
        data.copies || (Array.isArray(data.owners) ? data.owners.length : 1),
        data.min_players,
        data.max_players,
        Array.isArray(data.best_players) ? data.best_players.join(", ") : data.best_players,
        data.playtime,
        data.weight,
        data.rating,
        data.manual_url || (data.id ? ("https://boardgamegeek.com/boardgame/" + data.id + "/files") : ""),
        data.id ? ("https://boardgamegeek.com/boardgame/" + data.id) : ""
      );
      return ContentService.createTextOutput(JSON.stringify({{ status: "success", message: "Game added to Library!" }}))
        .setMimeType(ContentService.MimeType.JSON);
    }}

    // Default: Log Play
    let playsSheet = ss.getSheetByName("Plays Log");
    if (!playsSheet) {{
      setupGameNightSpreadsheet();
      playsSheet = ss.getSheetByName("Plays Log");
    }}

    const date = data.date || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
    const gameTitle = data.game_title || "Unknown Game";
    const players = Array.isArray(data.players) ? data.players.join(", ") : (data.players || "Darren");
    const playerCount = data.player_count || (Array.isArray(data.players) ? data.players.length : 1);
    const winner = data.winner || "";
    const duration = data.duration || 60;
    const notes = data.notes || "";
    const bggSynced = data.bgg_synced ? "Yes" : "No";

    playsSheet.appendRow([
      date,
      gameTitle,
      players,
      playerCount,
      winner,
      duration,
      notes,
      bggSynced
    ]);

    return ContentService.createTextOutput(JSON.stringify({{
      status: "success",
      message: "Play successfully logged in Google Sheets!",
      data: data
    }})).setMimeType(ContentService.MimeType.JSON);

  }} catch (err) {{
    return ContentService.createTextOutput(JSON.stringify({{
      status: "error",
      message: err.toString()
    }})).setMimeType(ContentService.MimeType.JSON);
  }}
}}

/**
 * GET Endpoint: Allows index.html to fetch live plays directly from Google Sheet
 */
function doGet(e) {{
  try {{
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const playsSheet = ss.getSheetByName("Plays Log");
    if (!playsSheet) {{
      return ContentService.createTextOutput(JSON.stringify([])).setMimeType(ContentService.MimeType.JSON);
    }}

    const rows = playsSheet.getDataRange().getValues();
    if (rows.length <= 1) {{
      return ContentService.createTextOutput(JSON.stringify([])).setMimeType(ContentService.MimeType.JSON);
    }}

    const plays = [];
    for (let i = 1; i < rows.length; i++) {{
      const r = rows[i];
      if (!r[0]) continue;
      plays.push({{
        date: Utilities.formatDate(new Date(r[0]), Session.getScriptTimeZone(), "yyyy-MM-dd"),
        game_title: r[1],
        players: r[2] ? r[2].toString().split(",").map(p => p.trim()) : [],
        player_count: r[3],
        winner: r[4],
        duration: r[5],
        notes: r[6],
        bgg_synced: (r[7] === "Yes")
      }});
    }}

    plays.sort((a, b) => new Date(b.date) - new Date(a.date));

    return ContentService.createTextOutput(JSON.stringify(plays))
      .setMimeType(ContentService.MimeType.JSON);

  }} catch (err) {{
    return ContentService.createTextOutput(JSON.stringify({{ error: err.toString() }}))
      .setMimeType(ContentService.MimeType.JSON);
  }}
}}
'''
    with open(BASE_DIR / 'google_apps_script.js', 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Generated google_apps_script.js with {num_games} games.")

def main():
    csv_file = find_collection_csv()
    if not csv_file:
        print("Error: No collection CSV found in workspace directory.")
        return

    print(f"Reading collection from: {csv_file.name}...")
    image_cache = load_image_cache()

    # Load plays data
    plays_map = {}
    plays_list = []
    plays_file = DATA_DIR / "plays.json"
    if plays_file.exists():
        try:
            with open(plays_file, "r", encoding="utf-8") as f:
                plays_list = json.load(f)
                for p in plays_list:
                    gid = str(p.get("game_id", ""))
                    gt = p.get("game_title", "").strip().lower()
                    p_date = p.get("date")
                    for k in (gid, gt):
                        if not k:
                            continue
                        if k not in plays_map:
                            plays_map[k] = {"count": 0, "last_played": None}
                        plays_map[k]["count"] += 1
                        if p_date and (plays_map[k]["last_played"] is None or p_date > plays_map[k]["last_played"]):
                            plays_map[k]["last_played"] = p_date
        except Exception as e:
            print(f"  [Notice] Could not parse plays.json: {e}")

    # Load existing catalog for thumbnails/metadata fallback
    existing_map = {}
    json_path = DATA_DIR / "games.json"
    if json_path.exists():
        try:
            with open(json_path, "r", encoding="utf-8") as f:
                for eg in json.load(f):
                    existing_map[str(eg.get("id"))] = eg
        except Exception:
            pass

    games_raw = []
    with open(csv_file, "r", encoding="utf-8", errors="replace") as f:
        reader = csv.DictReader(f)
        fieldnames = [col.strip() for col in (reader.fieldnames or [])]

        is_curated_format = "Title" in fieldnames or "Play Time (min)" in fieldnames

        for row in reader:
            if is_curated_format:
                title = row.get("Title", "").strip()
                if not title:
                    continue
                
                url = row.get("BGG URL", "").strip()
                m = re.search(r'/boardgame/(\d+)', url)
                gid = m.group(1) if m else ""
                if not gid:
                    # fallback slug
                    gid = re.sub(r'[^a-zA-Z0-9]', '', title).lower()

                itemtype = row.get("Type", "standalone").strip()
                owners_raw = row.get("Owners", "Darren")
                owners = [o.strip() for o in owners_raw.split(",") if o.strip()] or ["Darren"]

                min_players = to_int(row.get("Min Players"), 1)
                max_players = to_int(row.get("Max Players"), 4)
                best_raw = row.get("Best Player Count", "")
                best_players = [p.strip() for p in best_raw.split(",") if p.strip()] if best_raw else []

                playtime = to_int(row.get("Play Time (min)"), 60)
                weight = to_float(row.get("Weight (1.0-5.0)"))
                rating = to_float(row.get("BGG Rating"))
                rank_val = to_int(row.get("BGG Rank"))
                rank = rank_val if rank_val > 0 else None

                games_raw.append({
                    "id": gid,
                    "title": title,
                    "itemtype": itemtype,
                    "year": None,
                    "min_players": min_players,
                    "max_players": max_players,
                    "min_playtime": playtime,
                    "max_playtime": playtime,
                    "playtime": playtime,
                    "weight": weight,
                    "rating": rating,
                    "rank": rank,
                    "best_players": best_players,
                    "recommended_players": [],
                    "owners": owners,
                    "thumbnail": "",
                    "categories": [],
                    "mechanics": [],
                    "plays": 0,
                    "last_played": None
                })
            else:
                # Raw BGG export format
                if row.get("own") != "1":
                    continue
                gid = row.get("objectid", "").strip()
                title = row.get("objectname", "").strip()
                itemtype = row.get("itemtype", "standalone").strip()
                if not title:
                    continue

                avgweight = to_float(row.get("avgweight"))
                avgrating = to_float(row.get("average"))
                min_players = to_int(row.get("minplayers"), 1)
                max_players = to_int(row.get("maxplayers"), 4)
                playtime = to_int(row.get("playingtime"), 60)
                min_time = to_int(row.get("minplaytime")) or playtime
                max_time = to_int(row.get("maxplaytime")) or playtime
                year = to_int(row.get("yearpublished")) or None
                rank_val = to_int(row.get("rank"))
                rank = rank_val if rank_val > 0 else None

                best_raw = row.get("bggbestplayers", "")
                best_players = [p.strip() for p in best_raw.split(",") if p.strip()] if best_raw else []
                rec_raw = row.get("bggrecplayers", "")
                rec_players = [p.strip() for p in rec_raw.split(",") if p.strip()] if rec_raw else []

                games_raw.append({
                    "id": gid,
                    "title": title,
                    "itemtype": itemtype,
                    "year": year,
                    "min_players": min_players,
                    "max_players": max_players,
                    "min_playtime": min_time,
                    "max_playtime": max_time,
                    "playtime": playtime or max_time or 60,
                    "weight": avgweight,
                    "rating": avgrating,
                    "rank": rank,
                    "best_players": best_players,
                    "recommended_players": rec_players,
                    "owners": ["Darren"],
                    "thumbnail": "",
                    "categories": [],
                    "mechanics": [],
                    "plays": 0,
                    "last_played": None
                })

    # Deduplicate and merge multiple copies
    merged_games = {}
    for g in games_raw:
        gid = g["id"]
        title_lower = g["title"].lower()
        key = gid if gid else title_lower

        if key not in merged_games:
            # Check existing data
            if gid in existing_map:
                eg = existing_map[gid]
                if eg.get("thumbnail"): g["thumbnail"] = eg["thumbnail"]
                if eg.get("image"): g["image"] = eg["image"]
                if eg.get("year"): g["year"] = eg["year"]

            # Merge plays
            p_info = plays_map.get(gid) or plays_map.get(title_lower)
            if p_info:
                g["plays"] = p_info["count"]
                g["last_played"] = p_info["last_played"]

            g["copies"] = len(g["owners"]) if len(g["owners"]) > 0 else 1
            merged_games[key] = g
        else:
            # Game is owned multiple times! Increment copies and merge owners
            for o in g.get("owners", []):
                if o not in merged_games[key]["owners"]:
                    merged_games[key]["owners"].append(o)
            merged_games[key]["copies"] = len(merged_games[key]["owners"])

    games = list(merged_games.values())
    print(f"Processed {len(games)} unique owned games ({sum(1 for x in games if x['itemtype'] != 'expansion')} base, {sum(1 for x in games if x['itemtype'] == 'expansion')} expansions).")

    # Fetch/verify cover art
    print("Checking cover artwork...")
    for idx, g in enumerate(games):
        gid = g["id"]
        if not g.get("thumbnail"):
            thumb = fetch_image(gid, image_cache)
            g["thumbnail"] = thumb
            g["image"] = thumb
        else:
            image_cache[gid] = g["thumbnail"]

    save_image_cache(image_cache)

    # Enrich with manuals / rulebooks
    manuals_cache = load_manuals_cache()
    for g in games:
        gid = str(g["id"])
        m_entry = manuals_cache.get(gid, {})
        g["manual_url"] = m_entry.get("url") or f"https://boardgamegeek.com/boardgame/{gid}/files"
        g["manual_file"] = m_entry.get("file")

    # Sort alphabetically by title
    games_sorted = sorted(games, key=lambda x: x["title"].lower())

    # Save data/games.json
    with open(DATA_DIR / "games.json", "w", encoding="utf-8") as f:
        json.dump(games_sorted, f, indent=2, ensure_ascii=False)
    print(f"Saved JSON catalog to: {DATA_DIR / 'games.json'}")

    # Save data/games.csv
    with open(DATA_DIR / "games.csv", "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow([
            "Title", "Type", "Owners", "Min Players", "Max Players",
            "Best Player Count", "Play Time (min)", "Weight (1.0-5.0)",
            "Weight Class", "BGG Rating", "BGG Rank", "Official Manual", "BGG URL"
        ])
        for g in games_sorted:
            w = g["weight"]
            if w <= 0: weight_class = "Unrated"
            elif w < 2.2: weight_class = "Light / Casual"
            elif w < 3.2: weight_class = "Mid-weight Strategy"
            elif w < 4.0: weight_class = "Heavy Euro"
            else: weight_class = "Very Heavy / Complex"

            writer.writerow([
                g["title"],
                g["itemtype"],
                ", ".join(g["owners"]),
                g["min_players"],
                g["max_players"],
                ", ".join(g["best_players"]),
                g["playtime"],
                g["weight"],
                weight_class,
                g["rating"],
                g["rank"] or "",
                g.get("manual_url") or f"https://boardgamegeek.com/boardgame/{g['id']}/files",
                f"https://boardgamegeek.com/boardgame/{g['id']}"
            ])
    print(f"Saved Google Sheets CSV to: {DATA_DIR / 'games.csv'}")

    # Auto-sync index.html
    index_html_path = BASE_DIR / "index.html"
    if index_html_path.exists():
        with open(index_html_path, "r", encoding="utf-8") as f:
            html = f.read()

        # Update chip counts in HTML
        base_count = sum(1 for x in games_sorted if x["itemtype"] != "expansion")
        total_count = len(games_sorted)
        exp_count = sum(1 for x in games_sorted if x["itemtype"] == "expansion")

        html = re.sub(
            r'<div class="chip active" data-type="standalone">Base Games \(\d+\)</div>',
            f'<div class="chip active" data-type="standalone">Base Games ({base_count})</div>',
            html
        )
        html = re.sub(
            r'<div class="chip" data-type="all">All Items \(\d+\)</div>',
            f'<div class="chip" data-type="all">All Items ({total_count})</div>',
            html
        )
        html = re.sub(
            r'<div class="chip" data-type="expansion">Expansions \(\d+\)</div>',
            f'<div class="chip" data-type="expansion">Expansions ({exp_count})</div>',
            html
        )

        # Update EMBEDDED_GAMES
        s_marker = "const EMBEDDED_GAMES = "
        s_idx = html.find(s_marker)
        if s_idx != -1:
            e_idx = html.find(";\n    const EMBEDDED_PLAYS", s_idx)
            if e_idx != -1:
                html = html[:s_idx + len(s_marker)] + json.dumps(games_sorted) + html[e_idx:]

        with open(index_html_path, "w", encoding="utf-8") as f:
            f.write(html)
        print("Synced updated collection & chips into index.html.")

    # Generate google_apps_script.js
    generate_apps_script(games_sorted, plays_list)
    print("Done!")

if __name__ == "__main__":
    main()

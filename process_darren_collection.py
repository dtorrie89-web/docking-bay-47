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
import ssl
import urllib.request
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
CACHE_DIR = BASE_DIR / "cache"

DATA_DIR.mkdir(exist_ok=True)
CACHE_DIR.mkdir(exist_ok=True)

IMAGE_CACHE_FILE = CACHE_DIR / "game_images.json"
MANUALS_CACHE_FILE = CACHE_DIR / "game_manuals.json"
HIGHRES_CACHE_FILE = CACHE_DIR / "highres_images.json"

ssl_ctx = ssl.create_default_context()
ssl_ctx.check_hostname = False
ssl_ctx.verify_mode = ssl.CERT_NONE

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept": "application/json",
    "Referer": "https://boardgamegeek.com/"
}

def load_manuals_cache():
    if MANUALS_CACHE_FILE.exists():
        try:
            with open(MANUALS_CACHE_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {}

def extract_owner_from_path(csv_path):
    """Extract owner name from filename (e.g. 'Billy\'s Collection.csv' -> 'Billy')."""
    stem = csv_path.stem
    m = re.match(r"^([a-zA-Z0-9\s_-]+?)('s|\b)\s*collection", stem, re.IGNORECASE)
    if m:
        owner = m.group(1).strip()
        if owner:
            return owner
    cleaned = re.sub(r"['’]s?\s+collection.*$", "", stem, flags=re.IGNORECASE).strip()
    return cleaned if cleaned else "Darren"

def find_collection_csvs():
    """Find all collection CSV files in BASE_DIR (e.g. Darren's, Billy's, etc.)."""
    csvs = []
    for f in sorted(BASE_DIR.glob("*.csv")):
        name_lower = f.name.lower()
        if "collection" in name_lower and name_lower != "games.csv":
            csvs.append(f)
    if not csvs:
        for c in [BASE_DIR / "Darren's Collection.csv", BASE_DIR / "Darren's collection.csv"]:
            if c.exists():
                csvs.append(c)
    if not csvs:
        for f in sorted(BASE_DIR.glob("*.csv")):
            if f.name.lower() != "games.csv":
                csvs.append(f)
    return csvs

def load_image_cache():
    cache = {}
    if IMAGE_CACHE_FILE.exists():
        try:
            with open(IMAGE_CACHE_FILE, "r", encoding="utf-8") as f:
                cache.update(json.load(f))
        except Exception:
            pass
    if HIGHRES_CACHE_FILE.exists():
        try:
            with open(HIGHRES_CACHE_FILE, "r", encoding="utf-8") as f:
                h_cache = json.load(f)
                for k, v in h_cache.items():
                    if v:
                        cache[k] = v
        except Exception:
            pass
    return cache

def save_image_cache(cache):
    with open(IMAGE_CACHE_FILE, "w", encoding="utf-8") as f:
        json.dump(cache, f, indent=2)
    with open(HIGHRES_CACHE_FILE, "w", encoding="utf-8") as f:
        json.dump(cache, f, indent=2)

def fetch_image(game_id, cache):
    if not game_id:
        return ""
    if game_id in cache and cache[game_id] and "__small" not in cache[game_id]:
        return cache[game_id]
        
    url = f"https://boardgamegeek.com/api/geekitems?objectid={game_id}&objecttype=thing"
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, context=ssl_ctx, timeout=8) as resp:
            data = json.loads(resp.read().decode("utf-8", errors="ignore"))
            item = data.get("item", {})
            images = item.get("images", {})
            thumb = (
                item.get("imageurl@2x") or
                item.get("imageurl") or
                images.get("previewthumb") or
                images.get("square200") or
                images.get("original") or
                images.get("thumb") or ""
            )
            cache[game_id] = thumb
            time.sleep(0.15)
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
 * DOCKING BAY 94 GAME NIGHT - GOOGLE SHEETS HUB & SYNC BACKEND
 * =========================================================================
 *
 * HOW TO SET UP (Takes ~1 minute):
 * 1. Open Google Sheets (https://sheets.new).
 * 2. Name your spreadsheet: "Docking Bay 94 Game Night"
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
      .addItem("1. Run Initial Setup (Build Tabs & {num_games} Games)", "setupGameNightSpreadsheet")
      .addSeparator()
      .addItem("2. Import BGG Logged Plays (BGGLoggedPlayImporter)", "openBGGPlayImporterDialog")
      .addItem("3. Configure BGG API Bearer Token", "promptBGGToken")
      .addSeparator()
      .addItem("4. Setup Info", "showSetupAlert")
      .addToUi();
  }} catch(e) {{}}
}}

function promptBGGToken() {{
  const ui = SpreadsheetApp.getUi();
  const props = PropertiesService.getUserProperties();
  const current = props.getProperty("BGG_API_TOKEN") || "";
  const resp = ui.prompt(
    "BGG XML API2 Bearer Token",
    "Enter your BoardGameGeek API Bearer Token (from https://boardgamegeek.com/using_the_xml_api):\\n" +
    (current ? "(Current token is saved)" : ""),
    ui.ButtonSet.OK_CANCEL
  );
  if (resp.getSelectedButton() === ui.Button.OK) {{
    const val = resp.getResponseText().replace(/^Bearer\\s+/i, "").trim();
    if (val) {{
      props.setProperty("BGG_API_TOKEN", val);
      ui.alert("BGG Bearer Token saved! You can now run 'Import BGG Logged Plays'.");
    }}
  }}
}}

/**
 * Opens the BGGLoggedPlayImporter dialog (adapted from lowej004/BGGLoggedPlayImporter)
 */
function openBGGPlayImporterDialog() {{
  const props = PropertiesService.getUserProperties();
  const usernameVar = props.getProperty("BGGUsername") || "Dtorrie89";
  const minDateVar = props.getProperty("BGGMinDate") || "2020-01-01";
  const maxDateVar = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
  const tokenVar = props.getProperty("BGG_API_TOKEN") || "";

  const htmlStr = `
    <div style="font-family:Roboto,Arial,sans-serif; padding:8px; color:#1e293b; font-size:13px;">
      <p style="margin-top:0; color:#475569;">
        Pulls logged play history from BoardGameGeek (via <b>lowej004/BGGLoggedPlayImporter</b>) into the <b>BGG Logged Plays</b> tab and syncs into your <b>Plays Log</b> &amp; web app.
      </p>
      <table style="width:100%; border-collapse:collapse;">
        <tr>
          <td style="padding:6px 0; font-weight:bold;">BGG Username:</td>
          <td><input type="text" id="username" value="${{usernameVar}}" style="width:100%; padding:5px; box-sizing:border-box;"></td>
        </tr>
        <tr>
          <td style="padding:6px 0; font-weight:bold;">BGG Bearer Token (Optional):</td>
          <td><input type="password" id="token" value="${{tokenVar}}" placeholder="Leave blank for automatic token-free sync" style="width:100%; padding:5px; box-sizing:border-box;"></td>
        </tr>
        <tr>
          <td style="padding:6px 0;">Start Date:</td>
          <td><input type="date" id="minDate" value="${{minDateVar}}" style="width:100%; padding:5px; box-sizing:border-box;"></td>
        </tr>
        <tr>
          <td style="padding:6px 0;">End Date:</td>
          <td><input type="date" id="maxDate" value="${{maxDateVar}}" style="width:100%; padding:5px; box-sizing:border-box;"></td>
        </tr>
        <tr>
          <td style="padding:4px 0;">Include Playtime:</td>
          <td><input type="checkbox" id="incPlaytime" checked></td>
        </tr>
        <tr>
          <td style="padding:4px 0;">Include Year &amp; Rank:</td>
          <td><input type="checkbox" id="incGameYearRank" checked></td>
        </tr>
        <tr>
          <td style="padding:4px 0;">Include In Collection:</td>
          <td><input type="checkbox" id="incInCollection" checked></td>
        </tr>
        <tr>
          <td style="padding:4px 0;">Include Players &amp; Scores:</td>
          <td><input type="checkbox" id="incPlayers" checked></td>
        </tr>
        <tr>
          <td style="padding:4px 0;">Include Comments:</td>
          <td><input type="checkbox" id="incComments" checked></td>
        </tr>
        <tr>
          <td style="padding:4px 0; font-weight:bold; color:#0f766e;">Sync to Game Night Plays Log:</td>
          <td><input type="checkbox" id="syncToPlaysLog" checked></td>
        </tr>
      </table>
      <div style="margin-top:14px; display:flex; justify-content:space-between; align-items:center;">
        <span id="statusMsg" style="color:#2563eb; font-weight:bold;"></span>
        <button id="submitButton" onclick="runImport()" style="background:#2563eb; color:#fff; border:none; padding:8px 16px; border-radius:5px; font-weight:bold; cursor:pointer;">Import Plays from BGG</button>
      </div>
    </div>
    <script>
      function runImport() {{
        document.getElementById('submitButton').disabled = true;
        document.getElementById('statusMsg').textContent = 'Importing from BGG...';
        var u = document.getElementById('username').value.trim();
        var t = document.getElementById('token').value.trim();
        var minD = document.getElementById('minDate').value;
        var maxD = document.getElementById('maxDate').value;
        var incTime = document.getElementById('incPlaytime').checked;
        var incYR = document.getElementById('incGameYearRank').checked;
        var incColl = document.getElementById('incInCollection').checked;
        var incPl = document.getElementById('incPlayers').checked;
        var incComm = document.getElementById('incComments').checked;
        var syncLog = document.getElementById('syncToPlaysLog').checked;

        google.script.run
          .withSuccessHandler(function(msg) {{
            document.getElementById('statusMsg').style.color = '#059669';
            document.getElementById('statusMsg').textContent = msg;
            document.getElementById('submitButton').disabled = false;
          }})
          .withFailureHandler(function(err) {{
            document.getElementById('statusMsg').style.color = '#dc2626';
            document.getElementById('statusMsg').textContent = 'Error: ' + err.message;
            document.getElementById('submitButton').disabled = false;
          }})
          .ImportBGGPlays(u, t, minD, maxD, incTime, incYR, incYR, incColl, true, incPl, incPl, incComm, syncLog);
      }}
    </script>
  `;
  const html = HtmlService.createHtmlOutput(htmlStr).setWidth(420).setHeight(430);
  SpreadsheetApp.getUi().showModalDialog(html, "BGG Logged Play Importer");
}}

/**
 * Port of lowej004/BGGLoggedPlayImporter (BGGPlayImporter.gs) integrated with Docking Bay 94
 * Supports both BGG XML API2 Bearer Token AND Token-Free BGG Geekdo JSON API sync.
 */
function ImportBGGPlays(
  username,
  tokenInput,
  minDate,
  maxDate,
  includePlaytime,
  includeGameYear,
  includeGameRank,
  includeInCollection,
  includeNewGame,
  includePlayers,
  includePlayerScoresAndRatings,
  includeComments,
  syncToPlaysLog
) {{
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const userProperties = PropertiesService.getUserProperties();
  if (tokenInput) {{
    userProperties.setProperty("BGG_API_TOKEN", tokenInput.replace(/^Bearer\\s+/i, "").trim());
  }}
  const token = userProperties.getProperty("BGG_API_TOKEN") || "";

  userProperties.setProperties({{
    BGGUsername: username,
    BGGMinDate: minDate,
    BGGMaxDate: maxDate
  }});

  let bggSheet = ss.getSheetByName("BGG Logged Plays");
  if (!bggSheet) {{
    bggSheet = ss.insertSheet("BGG Logged Plays");
  }}
  bggSheet.clearContents();

  // Header row matching lowej004/BGGLoggedPlayImporter
  const headerRow = ["Date", "Game", "Location", "Times Played"];
  if (includePlaytime) headerRow.push("Playtime");
  if (includeGameYear) headerRow.push("Year Published");
  if (includeGameRank) headerRow.push("Current BGG Rank");
  if (includeInCollection) headerRow.push("Is In Collection");
  if (includeNewGame) headerRow.push("Is New Game");
  headerRow.push("Number of Players");
  if (includePlayers) {{
    if (includePlayerScoresAndRatings) {{
      for (let p = 1; p <= 8; p++) {{
        headerRow.push("Player " + p, "Player " + p + " Score", "Player " + p + " Rating");
      }}
      headerRow.push("Winner");
    }} else {{
      for (let p = 1; p <= 8; p++) headerRow.push("Player " + p);
      headerRow.push("Winner");
    }}
  }}
  if (includeComments) headerRow.push("Comments");
  bggSheet.appendRow(headerRow);
  bggSheet.getRange(1, 1, 1, headerRow.length).setBackground("#1e293b").setFontColor("#ffffff").setFontWeight("bold");

  // Build fast lookup from Library tab
  const libSheet = ss.getSheetByName("Library");
  const libIds = new Set();
  const libPlayedGames = [];
  if (libSheet && libSheet.getLastRow() > 1) {{
    const libValues = libSheet.getRange(2, 1, libSheet.getLastRow() - 1, 14).getValues();
    for (let r = 0; r < libValues.length; r++) {{
      const titleStr = String(libValues[r][0] || "");
      const ownerStr = String(libValues[r][1] || "Darren");
      const durVal = parseInt(libValues[r][6], 10) || 60;
      const playsCount = parseInt(libValues[r][10], 10) || 0;
      const lastPlayedVal = libValues[r][11] instanceof Date
        ? Utilities.formatDate(libValues[r][11], Session.getScriptTimeZone(), "yyyy-MM-dd")
        : String(libValues[r][11] || "");
      const urlStr = String(libValues[r][13] || "");
      const m = urlStr.match(/\\/boardgame\\/(\\d+)/);
      const gid = m ? m[1] : "";
      if (gid) libIds.add(gid);
      if (playsCount > 0) {{
        libPlayedGames.push({{
          id: gid,
          title: titleStr,
          owner: ownerStr.split(",")[0].trim() || "Darren",
          duration: durVal,
          plays: playsCount,
          lastPlayed: lastPlayedVal
        }});
      }}
    }}
  }}

  // Deduplicate against Plays Log if syncing
  const playsSheet = ss.getSheetByName("Plays Log");
  const existingPlayKeys = new Set();
  if (playsSheet && playsSheet.getLastRow() > 1) {{
    const pVals = playsSheet.getRange(2, 1, playsSheet.getLastRow() - 1, 2).getValues();
    for (let i = 0; i < pVals.length; i++) {{
      const d = pVals[i][0] instanceof Date
        ? Utilities.formatDate(pVals[i][0], Session.getScriptTimeZone(), "yyyy-MM-dd")
        : String(pVals[i][0]);
      const g = String(pVals[i][1] || "").toLowerCase().trim();
      existingPlayKeys.add(d + "|" + g);
    }}
  }}

  const opt = {{
    method: "get",
    headers: token ? {{ Authorization: "Bearer " + token }} : {{}},
    muteHttpExceptions: true
  }};

  const firstUrl =
    "https://boardgamegeek.com/xmlapi2/plays?username=" +
    encodeURIComponent(username) +
    (minDate ? "&mindate=" + minDate : "") +
    (maxDate ? "&maxdate=" + maxDate : "") +
    "&page=1";

  const firstResp = token ? UrlFetchApp.fetch(firstUrl, opt) : null;

  // Token-Free Fallback via BGG Geekdo JSON API + Library Tab if no token or 401
  if (!firstResp || firstResp.getResponseCode() !== 200) {{
    let bggUserId = 3876153;
    try {{
      const uResp = UrlFetchApp.fetch("https://api.geekdo.com/api/users?username=" + encodeURIComponent(username), {{ muteHttpExceptions: true }});
      if (uResp.getResponseCode() === 200) {{
        const uJson = JSON.parse(uResp.getContentText());
        if (uJson && uJson.id) bggUserId = uJson.id;
      }}
    }} catch (e) {{}}

    let importedCount = 0;
    for (let i = 0; i < libPlayedGames.length; i++) {{
      const g = libPlayedGames[i];
      let dateStr = g.lastPlayed || "2026-02-01";
      if (g.id) {{
        try {{
          const cUrl = "https://api.geekdo.com/api/collections?objectid=" + encodeURIComponent(g.id) + "&objecttype=thing&userid=" + bggUserId;
          const cResp = UrlFetchApp.fetch(cUrl, {{ muteHttpExceptions: true }});
          if (cResp.getResponseCode() === 200) {{
            const cJson = JSON.parse(cResp.getContentText());
            if (cJson && cJson.items && cJson.items.length > 0) {{
              const rawTs = cJson.items[0].lastmodified || cJson.items[0].status_tstamp || cJson.items[0].postdate || "";
              if (rawTs.length >= 10) dateStr = rawTs.slice(0, 10);
            }}
          }}
        }} catch (e) {{}}
      }}
      if (minDate && dateStr < minDate) continue;
      if (maxDate && dateStr > maxDate) continue;

      const thisRow = [dateStr, g.title, "BGG Collection Sync", g.plays];
      if (includePlaytime) thisRow.push(g.duration);
      if (includeGameYear) thisRow.push("");
      if (includeGameRank) thisRow.push("");
      if (includeInCollection) thisRow.push("Yes");
      if (includeNewGame) thisRow.push("No");
      thisRow.push(1);
      if (includePlayers) {{
        for (let pIdx = 0; pIdx < 8; pIdx++) {{
          const pName = pIdx === 0 ? g.owner : "";
          if (includePlayerScoresAndRatings) thisRow.push(pName, "", "");
          else thisRow.push(pName);
        }}
        thisRow.push("");
      }}
      const commentStr = "Synced from BGG (" + g.plays + " logged play" + (g.plays > 1 ? "s" : "") + ")";
      if (includeComments) thisRow.push(commentStr);

      bggSheet.appendRow(thisRow);
      importedCount++;

      if (syncToPlaysLog && playsSheet) {{
        const key = dateStr + "|" + g.title.toLowerCase().trim();
        if (!existingPlayKeys.has(key)) {{
          existingPlayKeys.add(key);
          playsSheet.appendRow([dateStr, g.title, g.owner, 1, "", g.duration, commentStr, "Yes"]);
        }}
      }}
    }}
    bggSheet.autoResizeColumns(1, Math.min(headerRow.length, 15));
    return "Synced " + importedCount + " played games from BGG (Token-Free Mode) for " + username + "!";
  }}

  const firstDoc = XmlService.parse(firstResp.getContentText());
  const firstRoot = firstDoc.getRootElement();
  const totalNumberOfPlays = parseInt(firstRoot.getAttribute("total").getValue(), 10) || 0;
  const totalNumberOfPages = Math.ceil(totalNumberOfPlays / 100);

  let importedCount = 0;
  for (let h = 1; h <= totalNumberOfPages; h++) {{
    const pageUrl =
      "https://boardgamegeek.com/xmlapi2/plays?username=" +
      encodeURIComponent(username) +
      (minDate ? "&mindate=" + minDate : "") +
      (maxDate ? "&maxdate=" + maxDate : "") +
      "&page=" + h;
    const xml = (h === 1) ? firstResp.getContentText() : UrlFetchApp.fetch(pageUrl, opt).getContentText();
    const doc = XmlService.parse(xml);
    const entries = doc.getRootElement().getChildren("play");

    for (let i = 0; i < entries.length; i++) {{
      const entry = entries[i];
      const date = entry.getAttribute("date") ? entry.getAttribute("date").getValue() : "";
      const location = entry.getAttribute("location") ? entry.getAttribute("location").getValue() : "";
      const timesPlayed = entry.getAttribute("quantity") ? entry.getAttribute("quantity").getValue() : "1";
      const item = entry.getChildren("item")[0];
      const game = item.getAttribute("name").getValue();
      const gameId = item.getAttribute("objectid").getValue();

      const thisRow = [date, game, location, timesPlayed];
      const rawLength = entry.getAttribute("length") ? entry.getAttribute("length").getValue() : "0";
      const playtime = rawLength !== "0" ? rawLength : "";

      if (includePlaytime) thisRow.push(playtime);
      if (includeGameYear) thisRow.push("");
      if (includeGameRank) thisRow.push("");
      if (includeInCollection) thisRow.push(libIds.has(gameId) ? "Yes" : "No");

      let isNew = "No";
      let numberOfPlayers = 1;
      const playerNames = [];
      let winner = "";
      const playersNode = entry.getChild("players");

      if (playersNode !== null) {{
        const players = playersNode.getChildren("player");
        numberOfPlayers = players.length || 1;
        for (let pIdx = 0; pIdx < players.length; pIdx++) {{
          const pl = players[pIdx];
          const pUname = pl.getAttribute("username") ? pl.getAttribute("username").getValue() : "";
          const pName = pl.getAttribute("name") ? pl.getAttribute("name").getValue() : (pUname || ("Player " + (pIdx + 1)));
          if (pUname.toLowerCase() === username.toLowerCase() && pl.getAttribute("new") && pl.getAttribute("new").getValue() === "1") {{
            isNew = "Yes";
          }}
          if (pl.getAttribute("win") && pl.getAttribute("win").getValue() === "1") {{
            winner = winner ? (winner + ", " + pName) : pName;
          }}
          playerNames.push(pName);
        }}

        if (includeNewGame) thisRow.push(isNew);
        thisRow.push(numberOfPlayers);

        if (includePlayers) {{
          for (let pIdx = 0; pIdx < 8; pIdx++) {{
            const pl = players[pIdx];
            const pName = pl ? (pl.getAttribute("name") ? pl.getAttribute("name").getValue() : "") : "";
            const pScore = pl ? (pl.getAttribute("score") ? pl.getAttribute("score").getValue() : "") : "";
            const pRatingRaw = pl ? (pl.getAttribute("rating") ? pl.getAttribute("rating").getValue() : "0") : "0";
            const pRating = pRatingRaw !== "0" ? pRatingRaw : "";
            if (includePlayerScoresAndRatings) {{
              thisRow.push(pName, pScore, pRating);
            }} else {{
              thisRow.push(pName);
            }}
          }}
          thisRow.push(winner);
        }}
      }} else {{
        if (includeNewGame) thisRow.push(isNew);
        thisRow.push(1);
        if (includePlayers) {{
          for (let pIdx = 0; pIdx < 8; pIdx++) {{
            if (includePlayerScoresAndRatings) thisRow.push("", "", "");
            else thisRow.push("");
          }}
          thisRow.push("");
        }}
      }}

      let comments = "";
      if (entry.getChildren("comments").length > 0) {{
        comments = entry.getChildren("comments")[0].getText();
      }}
      if (includeComments) thisRow.push(comments);

      bggSheet.appendRow(thisRow);
      importedCount++;

      if (syncToPlaysLog && playsSheet) {{
        const key = date + "|" + game.toLowerCase().trim();
        if (!existingPlayKeys.has(key)) {{
          existingPlayKeys.add(key);
          playsSheet.appendRow([
            date,
            game,
            playerNames.length > 0 ? playerNames.join(", ") : username,
            numberOfPlayers,
            winner,
            playtime || 60,
            comments,
            "Yes"
          ]);
        }}
      }}
    }}
  }}

  bggSheet.autoResizeColumns(1, Math.min(headerRow.length, 15));
  return "Imported " + importedCount + " BGG plays for " + username + "!";
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
    csv_files = find_collection_csvs()
    if not csv_files:
        print("Error: No collection CSV found in workspace directory.")
        return

    print(f"Discovered {len(csv_files)} collection CSV file(s): {[f.name for f in csv_files]}")
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
                    p_qty = to_int(p.get("quantity"), 1) or 1
                    for k in (gid, gt):
                        if not k:
                            continue
                        if k not in plays_map:
                            plays_map[k] = {"count": 0, "last_played": None}
                        plays_map[k]["count"] += p_qty
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
    for csv_file in csv_files:
        owner_name = extract_owner_from_path(csv_file)
        print(f"Reading collection for '{owner_name}' from: {csv_file.name}...")
        with open(csv_file, "r", encoding="utf-8", errors="replace") as f:
            reader = csv.DictReader(f)
            fieldnames = [col.strip() for col in (reader.fieldnames or [])]

            is_curated_format = "Title" in fieldnames or "Play Time (min)" in fieldnames
            added_for_owner = 0

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
                    owners_raw = row.get("Owners", owner_name)
                    owners = [o.strip() for o in owners_raw.split(",") if o.strip()] or [owner_name]

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
                    added_for_owner += 1
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

                    csv_plays = to_int(row.get("numplays"), 0)

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
                        "owners": [owner_name],
                        "thumbnail": "",
                        "categories": [],
                        "mechanics": [],
                        "plays": csv_plays,
                        "last_played": None
                    })
                    added_for_owner += 1
        print(f"  -> Added {added_for_owner} games owned by {owner_name}.")

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
                g["plays"] = max(g.get("plays", 0), p_info["count"])
                g["last_played"] = p_info["last_played"]

            g["copies"] = len(g["owners"]) if len(g["owners"]) > 0 else 1
            merged_games[key] = g
        else:
            # Game is owned multiple times! Increment copies and merge owners
            for o in g.get("owners", []):
                if o not in merged_games[key]["owners"]:
                    merged_games[key]["owners"].append(o)
            merged_games[key]["copies"] = len(merged_games[key]["owners"])
            merged_games[key]["plays"] = max(merged_games[key].get("plays", 0), g.get("plays", 0))

    games = list(merged_games.values())
    print(f"Processed {len(games)} unique owned games ({sum(1 for x in games if x['itemtype'] != 'expansion')} base, {sum(1 for x in games if x['itemtype'] == 'expansion')} expansions).")

    # Fetch/verify official high-res cover art
    print("Checking official cover artwork...")
    for idx, g in enumerate(games):
        gid = g["id"]
        cached_img = image_cache.get(gid, "")
        if cached_img and "__small" not in cached_img:
            g["thumbnail"] = cached_img
            g["image"] = cached_img
        elif not g.get("thumbnail") or "__small" in g.get("thumbnail", ""):
            thumb = fetch_image(gid, image_cache)
            g["thumbnail"] = thumb
            g["image"] = thumb
        else:
            image_cache[gid] = g["thumbnail"]

    save_image_cache(image_cache)

    # Enrich & download official manuals / rulebook PDFs to Google Drive
    print("Checking and populating official manuals in Google Drive...")
    import download_manuals
    download_manuals.ensure_manuals_for_games(games)

    # Pair owned expansions to their parent base game
    print("Pairing expansions to base games...")
    base_games_list = [g for g in games if g.get("itemtype") != "expansion" and not g.get("is_expansion")]
    base_by_title_lower = {b["title"].lower().strip(): b for b in base_games_list}
    explicit_parent_map = {
        "eclipse: rise of the ancients": "Eclipse: New Dawn for the Galaxy",
        "eclipse: shadow of the rift": "Eclipse: New Dawn for the Galaxy",
        "eclipse: ship pack one": "Eclipse: New Dawn for the Galaxy",
        "hamlet: by the lake": "Hamlet: The Village Building Game",
        "heat: heavy rain": "Heat: Pedal to the Metal",
        "heat: tunnel vision": "Heat: Pedal to the Metal",
        "star wars: unlimited – shadows of the galaxy": "Star Wars: Unlimited – Intro Battle: Hoth",
        "settlers of new catan (fan expansion for catan)": None
    }

    for g in games:
        g["expansions"] = []
        g["parent_game_id"] = None
        g["parent_game_title"] = None

    for exp in games:
        if exp.get("itemtype") != "expansion" and not exp.get("is_expansion"):
            continue
        exp_title = exp["title"].strip()
        exp_lower = exp_title.lower()
        matched_base = None

        if exp_lower in explicit_parent_map:
            target = explicit_parent_map[exp_lower]
            if target and target.lower() in base_by_title_lower:
                matched_base = base_by_title_lower[target.lower()]

        if not matched_base:
            for b in base_games_list:
                bt_lower = b["title"].lower().strip()
                if exp_lower.startswith(bt_lower + ":") or exp_lower.startswith(bt_lower + " –") or exp_lower.startswith(bt_lower + " -") or exp_lower.startswith(bt_lower + " "):
                    matched_base = b
                    break

        if not matched_base and ":" in exp_title:
            prefix = exp_title.split(":")[0].strip().lower()
            if prefix in base_by_title_lower:
                matched_base = base_by_title_lower[prefix]

        if matched_base:
            exp["parent_game_id"] = matched_base["id"]
            exp["parent_game_title"] = matched_base["title"]
            matched_base["expansions"].append({
                "id": exp["id"],
                "title": exp["title"],
                "year": exp.get("year"),
                "owners": exp.get("owners", []),
                "manual_url": exp.get("manual_url"),
                "manual_file": exp.get("manual_file"),
                "thumbnail": exp.get("thumbnail"),
                "image": exp.get("image")
            })

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

    # Auto-sync app.html
    app_html_path = BASE_DIR / "app.html"
    if app_html_path.exists():
        with open(app_html_path, "r", encoding="utf-8") as f:
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

        # Update EMBEDDED_PLAYS
        p_marker = "const EMBEDDED_PLAYS = "
        p_idx = html.find(p_marker)
        if p_idx != -1:
            pe_idx = html.find(";\n    let allPlays", p_idx)
            if pe_idx != -1:
                html = html[:p_idx + len(p_marker)] + json.dumps(plays_list) + html[pe_idx:]

        with open(app_html_path, "w", encoding="utf-8") as f:
            f.write(html)
        print("Synced updated collection & chips into app.html.")

    # Auto-encrypt app.html into AES-256 vault index.html
    encrypt_script = BASE_DIR / "encrypt_site.js"
    if encrypt_script.exists():
        import subprocess
        subprocess.run(["node", str(encrypt_script), "gamenight"], check=False)

    # Generate google_apps_script.js
    generate_apps_script(games_sorted, plays_list)
    print("Done!")

if __name__ == "__main__":
    main()

/** @OnlyCurrentDoc */

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
 *       1) Library: All 157 games with Owner(s), Copies, and dynamic formulas
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
function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu("🚀 Game Night Hub")
      .addItem("1. Run Initial Setup (Build Tabs & 157 Games)", "setupGameNightSpreadsheet")
      .addSeparator()
      .addItem("2. Import BGG Logged Plays (BGGLoggedPlayImporter)", "openBGGPlayImporterDialog")
      .addItem("3. Configure BGG API Bearer Token", "promptBGGToken")
      .addSeparator()
      .addItem("4. Setup Info", "showSetupAlert")
      .addToUi();
  } catch(e) {}
}

function promptBGGToken() {
  const ui = SpreadsheetApp.getUi();
  const props = PropertiesService.getUserProperties();
  const current = props.getProperty("BGG_API_TOKEN") || "";
  const resp = ui.prompt(
    "BGG XML API2 Bearer Token",
    "Enter your BoardGameGeek API Bearer Token (from https://boardgamegeek.com/using_the_xml_api):\n" +
    (current ? "(Current token is saved)" : ""),
    ui.ButtonSet.OK_CANCEL
  );
  if (resp.getSelectedButton() === ui.Button.OK) {
    const val = resp.getResponseText().replace(/^Bearer\s+/i, "").trim();
    if (val) {
      props.setProperty("BGG_API_TOKEN", val);
      ui.alert("BGG Bearer Token saved! You can now run 'Import BGG Logged Plays'.");
    }
  }
}

/**
 * Opens the BGGLoggedPlayImporter dialog (adapted from lowej004/BGGLoggedPlayImporter)
 */
function openBGGPlayImporterDialog() {
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
          <td><input type="text" id="username" value="${usernameVar}" style="width:100%; padding:5px; box-sizing:border-box;"></td>
        </tr>
        <tr>
          <td style="padding:6px 0; font-weight:bold;">BGG Bearer Token (Optional):</td>
          <td><input type="password" id="token" value="${tokenVar}" placeholder="Leave blank for automatic token-free sync" style="width:100%; padding:5px; box-sizing:border-box;"></td>
        </tr>
        <tr>
          <td style="padding:6px 0;">Start Date:</td>
          <td><input type="date" id="minDate" value="${minDateVar}" style="width:100%; padding:5px; box-sizing:border-box;"></td>
        </tr>
        <tr>
          <td style="padding:6px 0;">End Date:</td>
          <td><input type="date" id="maxDate" value="${maxDateVar}" style="width:100%; padding:5px; box-sizing:border-box;"></td>
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
      function runImport() {
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
          .withSuccessHandler(function(msg) {
            document.getElementById('statusMsg').style.color = '#059669';
            document.getElementById('statusMsg').textContent = msg;
            document.getElementById('submitButton').disabled = false;
          })
          .withFailureHandler(function(err) {
            document.getElementById('statusMsg').style.color = '#dc2626';
            document.getElementById('statusMsg').textContent = 'Error: ' + err.message;
            document.getElementById('submitButton').disabled = false;
          })
          .ImportBGGPlays(u, t, minD, maxD, incTime, incYR, incYR, incColl, true, incPl, incPl, incComm, syncLog);
      }
    </script>
  `;
  const html = HtmlService.createHtmlOutput(htmlStr).setWidth(420).setHeight(430);
  SpreadsheetApp.getUi().showModalDialog(html, "BGG Logged Play Importer");
}

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
) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const userProperties = PropertiesService.getUserProperties();
  if (tokenInput) {
    userProperties.setProperty("BGG_API_TOKEN", tokenInput.replace(/^Bearer\s+/i, "").trim());
  }
  const token = userProperties.getProperty("BGG_API_TOKEN") || "";

  userProperties.setProperties({
    BGGUsername: username,
    BGGMinDate: minDate,
    BGGMaxDate: maxDate
  });

  let bggSheet = ss.getSheetByName("BGG Logged Plays");
  if (!bggSheet) {
    bggSheet = ss.insertSheet("BGG Logged Plays");
  }
  bggSheet.clearContents();

  // Header row matching lowej004/BGGLoggedPlayImporter
  const headerRow = ["Date", "Game", "Location", "Times Played"];
  if (includePlaytime) headerRow.push("Playtime");
  if (includeGameYear) headerRow.push("Year Published");
  if (includeGameRank) headerRow.push("Current BGG Rank");
  if (includeInCollection) headerRow.push("Is In Collection");
  if (includeNewGame) headerRow.push("Is New Game");
  headerRow.push("Number of Players");
  if (includePlayers) {
    if (includePlayerScoresAndRatings) {
      for (let p = 1; p <= 8; p++) {
        headerRow.push("Player " + p, "Player " + p + " Score", "Player " + p + " Rating");
      }
      headerRow.push("Winner");
    } else {
      for (let p = 1; p <= 8; p++) headerRow.push("Player " + p);
      headerRow.push("Winner");
    }
  }
  if (includeComments) headerRow.push("Comments");
  bggSheet.appendRow(headerRow);
  bggSheet.getRange(1, 1, 1, headerRow.length).setBackground("#1e293b").setFontColor("#ffffff").setFontWeight("bold");

  // Build fast lookup from Library tab
  const libSheet = ss.getSheetByName("Library");
  const libIds = new Set();
  const libPlayedGames = [];
  if (libSheet && libSheet.getLastRow() > 1) {
    const libValues = libSheet.getRange(2, 1, libSheet.getLastRow() - 1, 14).getValues();
    for (let r = 0; r < libValues.length; r++) {
      const titleStr = String(libValues[r][0] || "");
      const ownerStr = String(libValues[r][1] || "Darren");
      const durVal = parseInt(libValues[r][6], 10) || 60;
      const playsCount = parseInt(libValues[r][10], 10) || 0;
      const lastPlayedVal = libValues[r][11] instanceof Date
        ? Utilities.formatDate(libValues[r][11], Session.getScriptTimeZone(), "yyyy-MM-dd")
        : String(libValues[r][11] || "");
      const urlStr = String(libValues[r][13] || "");
      const m = urlStr.match(/\/boardgame\/(\d+)/);
      const gid = m ? m[1] : "";
      if (gid) libIds.add(gid);
      if (playsCount > 0) {
        libPlayedGames.push({
          id: gid,
          title: titleStr,
          owner: ownerStr.split(",")[0].trim() || "Darren",
          duration: durVal,
          plays: playsCount,
          lastPlayed: lastPlayedVal
        });
      }
    }
  }

  // Deduplicate against Plays Log if syncing
  const playsSheet = ss.getSheetByName("Plays Log");
  const existingPlayKeys = new Set();
  if (playsSheet && playsSheet.getLastRow() > 1) {
    const pVals = playsSheet.getRange(2, 1, playsSheet.getLastRow() - 1, 2).getValues();
    for (let i = 0; i < pVals.length; i++) {
      const d = pVals[i][0] instanceof Date
        ? Utilities.formatDate(pVals[i][0], Session.getScriptTimeZone(), "yyyy-MM-dd")
        : String(pVals[i][0]);
      const g = String(pVals[i][1] || "").toLowerCase().trim();
      existingPlayKeys.add(d + "|" + g);
    }
  }

  const opt = {
    method: "get",
    headers: token ? { Authorization: "Bearer " + token } : {},
    muteHttpExceptions: true
  };

  const firstUrl =
    "https://boardgamegeek.com/xmlapi2/plays?username=" +
    encodeURIComponent(username) +
    (minDate ? "&mindate=" + minDate : "") +
    (maxDate ? "&maxdate=" + maxDate : "") +
    "&page=1";

  const firstResp = token ? UrlFetchApp.fetch(firstUrl, opt) : null;

  // Token-Free Fallback via BGG Geekdo JSON API + Library Tab if no token or 401
  if (!firstResp || firstResp.getResponseCode() !== 200) {
    let bggUserId = 3876153;
    try {
      const uResp = UrlFetchApp.fetch("https://api.geekdo.com/api/users?username=" + encodeURIComponent(username), { muteHttpExceptions: true });
      if (uResp.getResponseCode() === 200) {
        const uJson = JSON.parse(uResp.getContentText());
        if (uJson && uJson.id) bggUserId = uJson.id;
      }
    } catch (e) {}

    let importedCount = 0;
    for (let i = 0; i < libPlayedGames.length; i++) {
      const g = libPlayedGames[i];
      let dateStr = g.lastPlayed || "2026-02-01";
      if (g.id) {
        try {
          const cUrl = "https://api.geekdo.com/api/collections?objectid=" + encodeURIComponent(g.id) + "&objecttype=thing&userid=" + bggUserId;
          const cResp = UrlFetchApp.fetch(cUrl, { muteHttpExceptions: true });
          if (cResp.getResponseCode() === 200) {
            const cJson = JSON.parse(cResp.getContentText());
            if (cJson && cJson.items && cJson.items.length > 0) {
              const rawTs = cJson.items[0].lastmodified || cJson.items[0].status_tstamp || cJson.items[0].postdate || "";
              if (rawTs.length >= 10) dateStr = rawTs.slice(0, 10);
            }
          }
        } catch (e) {}
      }
      if (minDate && dateStr < minDate) continue;
      if (maxDate && dateStr > maxDate) continue;

      const thisRow = [dateStr, g.title, "BGG Collection Sync", g.plays];
      if (includePlaytime) thisRow.push(g.duration);
      if (includeGameYear) thisRow.push("");
      if (includeGameRank) thisRow.push("");
      if (includeInCollection) thisRow.push("Yes");
      if (includeNewGame) thisRow.push("No");
      thisRow.push(1);
      if (includePlayers) {
        for (let pIdx = 0; pIdx < 8; pIdx++) {
          const pName = pIdx === 0 ? g.owner : "";
          if (includePlayerScoresAndRatings) thisRow.push(pName, "", "");
          else thisRow.push(pName);
        }
        thisRow.push("");
      }
      const commentStr = "Synced from BGG (" + g.plays + " logged play" + (g.plays > 1 ? "s" : "") + ")";
      if (includeComments) thisRow.push(commentStr);

      bggSheet.appendRow(thisRow);
      importedCount++;

      if (syncToPlaysLog && playsSheet) {
        const key = dateStr + "|" + g.title.toLowerCase().trim();
        if (!existingPlayKeys.has(key)) {
          existingPlayKeys.add(key);
          playsSheet.appendRow([dateStr, g.title, g.owner, 1, "", g.duration, commentStr, "Yes"]);
        }
      }
    }
    bggSheet.autoResizeColumns(1, Math.min(headerRow.length, 15));
    return "Synced " + importedCount + " played games from BGG (Token-Free Mode) for " + username + "!";
  }

  const firstDoc = XmlService.parse(firstResp.getContentText());
  const firstRoot = firstDoc.getRootElement();
  const totalNumberOfPlays = parseInt(firstRoot.getAttribute("total").getValue(), 10) || 0;
  const totalNumberOfPages = Math.ceil(totalNumberOfPlays / 100);

  let importedCount = 0;
  for (let h = 1; h <= totalNumberOfPages; h++) {
    const pageUrl =
      "https://boardgamegeek.com/xmlapi2/plays?username=" +
      encodeURIComponent(username) +
      (minDate ? "&mindate=" + minDate : "") +
      (maxDate ? "&maxdate=" + maxDate : "") +
      "&page=" + h;
    const xml = (h === 1) ? firstResp.getContentText() : UrlFetchApp.fetch(pageUrl, opt).getContentText();
    const doc = XmlService.parse(xml);
    const entries = doc.getRootElement().getChildren("play");

    for (let i = 0; i < entries.length; i++) {
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

      if (playersNode !== null) {
        const players = playersNode.getChildren("player");
        numberOfPlayers = players.length || 1;
        for (let pIdx = 0; pIdx < players.length; pIdx++) {
          const pl = players[pIdx];
          const pUname = pl.getAttribute("username") ? pl.getAttribute("username").getValue() : "";
          const pName = pl.getAttribute("name") ? pl.getAttribute("name").getValue() : (pUname || ("Player " + (pIdx + 1)));
          if (pUname.toLowerCase() === username.toLowerCase() && pl.getAttribute("new") && pl.getAttribute("new").getValue() === "1") {
            isNew = "Yes";
          }
          if (pl.getAttribute("win") && pl.getAttribute("win").getValue() === "1") {
            winner = winner ? (winner + ", " + pName) : pName;
          }
          playerNames.push(pName);
        }

        if (includeNewGame) thisRow.push(isNew);
        thisRow.push(numberOfPlayers);

        if (includePlayers) {
          for (let pIdx = 0; pIdx < 8; pIdx++) {
            const pl = players[pIdx];
            const pName = pl ? (pl.getAttribute("name") ? pl.getAttribute("name").getValue() : "") : "";
            const pScore = pl ? (pl.getAttribute("score") ? pl.getAttribute("score").getValue() : "") : "";
            const pRatingRaw = pl ? (pl.getAttribute("rating") ? pl.getAttribute("rating").getValue() : "0") : "0";
            const pRating = pRatingRaw !== "0" ? pRatingRaw : "";
            if (includePlayerScoresAndRatings) {
              thisRow.push(pName, pScore, pRating);
            } else {
              thisRow.push(pName);
            }
          }
          thisRow.push(winner);
        }
      } else {
        if (includeNewGame) thisRow.push(isNew);
        thisRow.push(1);
        if (includePlayers) {
          for (let pIdx = 0; pIdx < 8; pIdx++) {
            if (includePlayerScoresAndRatings) thisRow.push("", "", "");
            else thisRow.push("");
          }
          thisRow.push("");
        }
      }

      let comments = "";
      if (entry.getChildren("comments").length > 0) {
        comments = entry.getChildren("comments")[0].getText();
      }
      if (includeComments) thisRow.push(comments);

      bggSheet.appendRow(thisRow);
      importedCount++;

      if (syncToPlaysLog && playsSheet) {
        const key = date + "|" + game.toLowerCase().trim();
        if (!existingPlayKeys.has(key)) {
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
        }
      }
    }
  }

  bggSheet.autoResizeColumns(1, Math.min(headerRow.length, 15));
  return "Imported " + importedCount + " BGG plays for " + username + "!";
}

function showSetupAlert() {
  SpreadsheetApp.getUi().alert("Game Night Hub is ready! Use Extensions > Apps Script > Deploy > New deployment > Web app (Access: Anyone) to enable instant mobile logging from your web app.");
}

function setupGameNightSpreadsheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // -------------------------------------------------------------
  // TAB 1: LIBRARY (Supports Multiple Copies & Multiple Owners)
  // -------------------------------------------------------------
  let libSheet = ss.getSheetByName("Library");
  if (!libSheet) {
    libSheet = ss.insertSheet("Library", 0);
  }
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
    ["13 Dead End Drive", "Base Game", "Darren", 1, 2, 4, "4", 45, 1.39, 6.12, "=COUNTIF('Plays Log'!B:B, A2)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A2), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://boardgamegeek.com/boardgame/1899/files\", \"Official Rules\"), \"https://boardgamegeek.com/boardgame/1899/files\")", "https://boardgamegeek.com/boardgame/1899"],
    ["7 Wonders Duel", "Base Game", "Darren", 1, 2, 2, "2", 30, 2.23, 8.07, "=COUNTIF('Plays Log'!B:B, A3)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A3), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://cdn.1j1ju.com/medias/1a/ba/6b-7-wonders-duel-rules.pdf\", \"Official Rules\"), \"https://cdn.1j1ju.com/medias/1a/ba/6b-7-wonders-duel-rules.pdf\")", "https://boardgamegeek.com/boardgame/173346"],
    ["Above and Below", "Base Game", "Billy", 1, 2, 4, "3", 90, 2.52, 7.34, "=COUNTIF('Plays Log'!B:B, A4)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A4), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://board-game-rules.com/wp-content/uploads/2025/01/above-and-below_Official-Rules.pdf\", \"Official Rules\"), \"https://board-game-rules.com/wp-content/uploads/2025/01/above-and-below_Official-Rules.pdf\")", "https://boardgamegeek.com/boardgame/172818"],
    ["Aeon's End: War Eternal", "Base Game", "Billy", 1, 1, 4, "2", 60, 2.93, 8.22, "=COUNTIF('Plays Log'!B:B, A5)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A5), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://board-game-rules.com/wp-content/uploads/2025/01/aeons-end-war-eternal_Official-Rules.pdf\", \"Official Rules\"), \"https://board-game-rules.com/wp-content/uploads/2025/01/aeons-end-war-eternal_Official-Rules.pdf\")", "https://boardgamegeek.com/boardgame/218417"],
    ["Agricola (Revised Edition)", "Base Game", "Billy", 1, 1, 4, "3, 4", 120, 3.45, 7.95, "=COUNTIF('Plays Log'!B:B, A6)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A6), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://board-game-rules.com/wp-content/uploads/2025/01/agricola-revised-edition_Official-Rules.pdf\", \"Official Rules\"), \"https://board-game-rules.com/wp-content/uploads/2025/01/agricola-revised-edition_Official-Rules.pdf\")", "https://boardgamegeek.com/boardgame/200680"],
    ["Agricola: All Creatures Big and Small – The Big Box", "Base Game", "Billy", 1, 2, 2, "2", 30, 2.33, 7.62, "=COUNTIF('Plays Log'!B:B, A7)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A7), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://board-game-rules.com/wp-content/uploads/2025/01/agricola-all-creatures-big-and-small_Official-Rules.pdf\", \"Official Rules\"), \"https://board-game-rules.com/wp-content/uploads/2025/01/agricola-all-creatures-big-and-small_Official-Rules.pdf\")", "https://boardgamegeek.com/boardgame/255262"],
    ["Andor: The Family Fantasy Game", "Base Game", "Darren", 1, 2, 4, "4", 45, 1.93, 7.24, "=COUNTIF('Plays Log'!B:B, A8)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A8), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://www.thamesandkosmos.co.uk/wp-content/uploads/2024/12/683085_ANDOR_FAM_FANTASY_EXP_Manual_PRINT-2.pdf\", \"Official Rules\"), \"https://www.thamesandkosmos.co.uk/wp-content/uploads/2024/12/683085_ANDOR_FAM_FANTASY_EXP_Manual_PRINT-2.pdf\")", "https://boardgamegeek.com/boardgame/295488"],
    ["Apollo: A Game Inspired by NASA Moon Missions", "Base Game", "Billy", 1, 2, 5, "3", 60, 2.81, 6.23, "=COUNTIF('Plays Log'!B:B, A9)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A9), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://boardgamegeek.com/boardgame/313008/files\", \"Official Rules\"), \"https://boardgamegeek.com/boardgame/313008/files\")", "https://boardgamegeek.com/boardgame/313008"],
    ["Arcs", "Base Game", "Darren", 1, 2, 4, "3, 4", 120, 3.45, 7.98, "=COUNTIF('Plays Log'!B:B, A10)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A10), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://bghub.org/r/arcs.pdf\", \"Official Rules\"), \"https://bghub.org/r/arcs.pdf\")", "https://boardgamegeek.com/boardgame/359871"],
    ["Arcs: Leaders & Lore Pack", "Expansion", "Darren", 1, 2, 4, "3", 120, 3.26, 8.55, "=COUNTIF('Plays Log'!B:B, A11)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A11), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://bghub.org/r/arcs.pdf\", \"Official Rules\"), \"https://bghub.org/r/arcs.pdf\")", "https://boardgamegeek.com/boardgame/419279"],
    ["Axis & Allies", "Base Game", "Billy", 1, 2, 5, "2, 5", 240, 3.22, 6.69, "=COUNTIF('Plays Log'!B:B, A12)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A12), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://board-game-rules.com/wp-content/uploads/2025/01/axis-allies_Official-Rules.pdf\", \"Official Rules\"), \"https://board-game-rules.com/wp-content/uploads/2025/01/axis-allies_Official-Rules.pdf\")", "https://boardgamegeek.com/boardgame/10093"],
    ["Azul", "Base Game", "Billy", 1, 2, 4, "2", 45, 1.77, 7.71, "=COUNTIF('Plays Log'!B:B, A13)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A13), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://board-game-rules.com/wp-content/uploads/2025/01/azul_Official-Rules.pdf\", \"Official Rules\"), \"https://board-game-rules.com/wp-content/uploads/2025/01/azul_Official-Rules.pdf\")", "https://boardgamegeek.com/boardgame/230802"],
    ["Back to the Future: Back in Time", "Base Game", "Billy", 1, 2, 4, "2", 50, 2.42, 7.16, "=COUNTIF('Plays Log'!B:B, A14)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A14), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://boardgamegeek.com/boardgame/302388/files\", \"Official Rules\"), \"https://boardgamegeek.com/boardgame/302388/files\")", "https://boardgamegeek.com/boardgame/302388"],
    ["Blokus", "Base Game", "Darren", 1, 2, 4, "4", 30, 1.73, 6.86, "=COUNTIF('Plays Log'!B:B, A15)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A15), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://service.mattel.com/instruction_sheets/BJV44-Eng.pdf\", \"Official Rules\"), \"https://service.mattel.com/instruction_sheets/BJV44-Eng.pdf\")", "https://boardgamegeek.com/boardgame/2453"],
    ["Camel Up (Second Edition)", "Base Game", "Darren", 1, 3, 8, "5, 6", 45, 1.51, 7.53, "=COUNTIF('Plays Log'!B:B, A16)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A16), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://cdn.1j1ju.com/medias/8b/c6/82-camel-up-rulebook.pdf\", \"Official Rules\"), \"https://cdn.1j1ju.com/medias/8b/c6/82-camel-up-rulebook.pdf\")", "https://boardgamegeek.com/boardgame/260605"],
    ["Carcassonne", "Base Game", "Billy, Darren", 2, 2, 5, "2", 45, 1.88, 7.42, "=COUNTIF('Plays Log'!B:B, A17)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A17), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://cdn.svc.asmodee.net/production-zman/uploads/2024/10/Carcassonne-20th-Anniversary-Rulebook.pdf\", \"Official Rules\"), \"https://cdn.svc.asmodee.net/production-zman/uploads/2024/10/Carcassonne-20th-Anniversary-Rulebook.pdf\")", "https://boardgamegeek.com/boardgame/822"],
    ["Cascadia", "Base Game", "Darren", 1, 1, 4, "2, 3", 45, 1.84, 7.88, "=COUNTIF('Plays Log'!B:B, A18)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A18), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://cdn.1j1ju.com/medias/eb/73/df-cascadia-rulebook.pdf\", \"Official Rules\"), \"https://cdn.1j1ju.com/medias/eb/73/df-cascadia-rulebook.pdf\")", "https://boardgamegeek.com/boardgame/295947"],
    ["Castles of Mad King Ludwig", "Base Game", "Billy", 1, 1, 4, "4", 90, 2.65, 7.5, "=COUNTIF('Plays Log'!B:B, A19)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A19), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://board-game-rules.com/wp-content/uploads/2025/01/castles-of-mad-king-ludwig_Official-Rules.pdf\", \"Official Rules\"), \"https://board-game-rules.com/wp-content/uploads/2025/01/castles-of-mad-king-ludwig_Official-Rules.pdf\")", "https://boardgamegeek.com/boardgame/155426"],
    ["Chronicles of Crime", "Base Game", "Billy", 1, 1, 4, "2", 90, 2.06, 7.52, "=COUNTIF('Plays Log'!B:B, A20)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A20), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://board-game-rules.com/wp-content/uploads/2025/01/chronicles-of-crime_Official-Rules.pdf\", \"Official Rules\"), \"https://board-game-rules.com/wp-content/uploads/2025/01/chronicles-of-crime_Official-Rules.pdf\")", "https://boardgamegeek.com/boardgame/239188"],
    ["Citadels", "Base Game", "Billy", 1, 2, 8, "5", 60, 2.05, 7.05, "=COUNTIF('Plays Log'!B:B, A21)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A21), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://board-game-rules.com/wp-content/uploads/2025/01/citadels_Official-Rules.pdf\", \"Official Rules\"), \"https://board-game-rules.com/wp-content/uploads/2025/01/citadels_Official-Rules.pdf\")", "https://boardgamegeek.com/boardgame/478"],
    ["Codenames: Duet", "Base Game", "Darren", 1, 2, 2, "2", 30, 1.36, 7.4, "=COUNTIF('Plays Log'!B:B, A22)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A22), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://officialgamerules.org/wp-content/uploads/2025/04/03-codenames-duet-rulebook.pdf\", \"Official Rules\"), \"https://officialgamerules.org/wp-content/uploads/2025/04/03-codenames-duet-rulebook.pdf\")", "https://boardgamegeek.com/boardgame/224037"],
    ["Diced Veggies", "Base Game", "Darren", 1, 2, 4, "3", 30, 1.39, 6.86, "=COUNTIF('Plays Log'!B:B, A23)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A23), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://bghub.org/r/diced-veggies.pdf\", \"Official Rules\"), \"https://bghub.org/r/diced-veggies.pdf\")", "https://boardgamegeek.com/boardgame/381356"],
    ["Dinosaur Island", "Base Game", "Billy", 1, 1, 4, "3", 120, 3.05, 7.52, "=COUNTIF('Plays Log'!B:B, A24)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A24), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://board-game-rules.com/wp-content/uploads/2025/01/dinosaur-island_Official-Rules.pdf\", \"Official Rules\"), \"https://board-game-rules.com/wp-content/uploads/2025/01/dinosaur-island_Official-Rules.pdf\")", "https://boardgamegeek.com/boardgame/221194"],
    ["Disney Villainous: Bigger and Badder", "Base Game", "Billy", 1, 2, 3, "2", 60, 2.42, 7.37, "=COUNTIF('Plays Log'!B:B, A25)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A25), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://board-game-rules.com/wp-content/uploads/2025/01/disney-villainous-the-worst-takes-it-all_Official-Rules.pdf\", \"Official Rules\"), \"https://board-game-rules.com/wp-content/uploads/2025/01/disney-villainous-the-worst-takes-it-all_Official-Rules.pdf\")", "https://boardgamegeek.com/boardgame/352764"],
    ["Disney Villainous: Despicable Plots", "Base Game", "Billy", 1, 2, 3, "3", 60, 2.19, 7.44, "=COUNTIF('Plays Log'!B:B, A26)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A26), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://board-game-rules.com/wp-content/uploads/2025/01/disney-villainous-despicable-plots_Official-Rules.pdf\", \"Official Rules\"), \"https://board-game-rules.com/wp-content/uploads/2025/01/disney-villainous-despicable-plots_Official-Rules.pdf\")", "https://boardgamegeek.com/boardgame/331050"],
    ["Disney Villainous: Evil Comes Prepared", "Base Game", "Billy", 1, 2, 3, "3", 60, 2.31, 7.47, "=COUNTIF('Plays Log'!B:B, A27)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A27), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://board-game-rules.com/wp-content/uploads/2025/01/disney-villainous-evil-comes-prepared_Official-Rules.pdf\", \"Official Rules\"), \"https://board-game-rules.com/wp-content/uploads/2025/01/disney-villainous-evil-comes-prepared_Official-Rules.pdf\")", "https://boardgamegeek.com/boardgame/284760"],
    ["Disney Villainous: Perfectly Wretched", "Base Game", "Billy", 1, 2, 3, "3", 60, 2.3, 7.54, "=COUNTIF('Plays Log'!B:B, A28)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A28), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://board-game-rules.com/wp-content/uploads/2025/01/disney-villainous-perfectly-wretched_Official-Rules.pdf\", \"Official Rules\"), \"https://board-game-rules.com/wp-content/uploads/2025/01/disney-villainous-perfectly-wretched_Official-Rules.pdf\")", "https://boardgamegeek.com/boardgame/299047"],
    ["Disney Villainous: Sugar and Spite", "Base Game", "Billy", 1, 2, 2, "2", 40, 2.17, 7.56, "=COUNTIF('Plays Log'!B:B, A29)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A29), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://board-game-rules.com/wp-content/uploads/2025/01/disney-villainous-the-worst-takes-it-all_Official-Rules.pdf\", \"Official Rules\"), \"https://board-game-rules.com/wp-content/uploads/2025/01/disney-villainous-the-worst-takes-it-all_Official-Rules.pdf\")", "https://boardgamegeek.com/boardgame/411003"],
    ["Disney Villainous: The Worst Takes it All", "Base Game", "Billy", 1, 2, 6, "3", 120, 2.48, 6.9, "=COUNTIF('Plays Log'!B:B, A30)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A30), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://board-game-rules.com/wp-content/uploads/2025/01/disney-villainous-the-worst-takes-it-all_Official-Rules.pdf\", \"Official Rules\"), \"https://board-game-rules.com/wp-content/uploads/2025/01/disney-villainous-the-worst-takes-it-all_Official-Rules.pdf\")", "https://boardgamegeek.com/boardgame/256382"],
    ["Disney Villainous: Wicked to the Core", "Base Game", "Billy", 1, 2, 3, "3", 60, 2.38, 7.47, "=COUNTIF('Plays Log'!B:B, A31)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A31), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://board-game-rules.com/wp-content/uploads/2025/01/disney-villainous-wicked-to-the-core_Official-Rules.pdf\", \"Official Rules\"), \"https://board-game-rules.com/wp-content/uploads/2025/01/disney-villainous-wicked-to-the-core_Official-Rules.pdf\")", "https://boardgamegeek.com/boardgame/271518"],
    ["Dude Perfect the Board Game", "Base Game", "Darren", 1, 2, 5, "4, 5", 60, 2.0, 5.47, "=COUNTIF('Plays Log'!B:B, A32)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A32), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://boardgamegeek.com/boardgame/411415/files\", \"Official Rules\"), \"https://boardgamegeek.com/boardgame/411415/files\")", "https://boardgamegeek.com/boardgame/411415"],
    ["Eclipse: New Dawn for the Galaxy", "Base Game", "Billy", 1, 2, 6, "4, 6", 180, 3.71, 7.82, "=COUNTIF('Plays Log'!B:B, A33)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A33), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://board-game-rules.com/wp-content/uploads/2025/01/eclipse-new-dawn-for-the-galaxy_Official-Rules.pdf\", \"Official Rules\"), \"https://board-game-rules.com/wp-content/uploads/2025/01/eclipse-new-dawn-for-the-galaxy_Official-Rules.pdf\")", "https://boardgamegeek.com/boardgame/72125"],
    ["Eclipse: Rise of the Ancients", "Expansion", "Billy", 1, 2, 9, "4, 6", 120, 3.68, 8.39, "=COUNTIF('Plays Log'!B:B, A34)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A34), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://bghub.org/r/eclipse.pdf\", \"Official Rules\"), \"https://bghub.org/r/eclipse.pdf\")", "https://boardgamegeek.com/boardgame/125898"],
    ["Eclipse: Shadow of the Rift", "Expansion", "Billy", 1, 2, 6, "6", 120, 3.89, 8.25, "=COUNTIF('Plays Log'!B:B, A35)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A35), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://bghub.org/r/eclipse.pdf\", \"Official Rules\"), \"https://bghub.org/r/eclipse.pdf\")", "https://boardgamegeek.com/boardgame/179255"],
    ["Eclipse: Ship Pack One", "Expansion", "Billy", 1, 2, 6, "3, 4", 120, 3.17, 7.68, "=COUNTIF('Plays Log'!B:B, A36)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A36), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://bghub.org/r/eclipse.pdf\", \"Official Rules\"), \"https://bghub.org/r/eclipse.pdf\")", "https://boardgamegeek.com/boardgame/146690"],
    ["Escape: The Curse of the Temple", "Base Game", "Billy", 1, 1, 5, "4", 10, 1.48, 6.95, "=COUNTIF('Plays Log'!B:B, A37)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A37), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://bghub.org/r/escape-the-curse-of-the-temple.pdf\", \"Official Rules\"), \"https://bghub.org/r/escape-the-curse-of-the-temple.pdf\")", "https://boardgamegeek.com/boardgame/113294"],
    ["Everdell: The Complete Collection", "Base Game", "Billy", 1, 1, 6, "3", 120, 3.11, 8.76, "=COUNTIF('Plays Log'!B:B, A38)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A38), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://board-game-rules.com/wp-content/uploads/2025/01/everdell_Official-Rules.pdf\", \"Official Rules\"), \"https://board-game-rules.com/wp-content/uploads/2025/01/everdell_Official-Rules.pdf\")", "https://boardgamegeek.com/boardgame/332398"],
    ["Excalibur", "Base Game", "Darren", 1, 2, 8, "5, 6", 25, 1.28, 7.29, "=COUNTIF('Plays Log'!B:B, A39)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A39), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://bghub.org/r/excalibur.pdf\", \"Official Rules\"), \"https://bghub.org/r/excalibur.pdf\")", "https://boardgamegeek.com/boardgame/434172"],
    ["Flash Point: Fire Rescue", "Base Game", "Billy", 1, 2, 6, "4", 45, 2.2, 7.14, "=COUNTIF('Plays Log'!B:B, A40)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A40), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://board-game-rules.com/wp-content/uploads/2025/01/flash-point-fire-rescue_Official-Rules.pdf\", \"Official Rules\"), \"https://board-game-rules.com/wp-content/uploads/2025/01/flash-point-fire-rescue_Official-Rules.pdf\")", "https://boardgamegeek.com/boardgame/100901"],
    ["Flick 'em Up!", "Base Game", "Billy", 1, 2, 10, "2, 4", 45, 1.35, 6.84, "=COUNTIF('Plays Log'!B:B, A41)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A41), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://board-game-rules.com/wp-content/uploads/2025/01/flick-em-up_Official-Rules.pdf\", \"Official Rules\"), \"https://board-game-rules.com/wp-content/uploads/2025/01/flick-em-up_Official-Rules.pdf\")", "https://boardgamegeek.com/boardgame/169124"],
    ["Forbidden Desert", "Base Game", "Billy", 1, 2, 5, "4", 45, 2.04, 7.06, "=COUNTIF('Plays Log'!B:B, A42)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A42), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://board-game-rules.com/wp-content/uploads/2025/01/forbidden-desert_Official-Rules.pdf\", \"Official Rules\"), \"https://board-game-rules.com/wp-content/uploads/2025/01/forbidden-desert_Official-Rules.pdf\")", "https://boardgamegeek.com/boardgame/136063"],
    ["Forbidden Island", "Base Game", "Darren", 1, 2, 4, "4", 30, 1.74, 6.75, "=COUNTIF('Plays Log'!B:B, A43)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A43), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://cdn.1j1ju.com/medias/14/2b/51-forbidden-island-rulebook.pdf\", \"Official Rules\"), \"https://cdn.1j1ju.com/medias/14/2b/51-forbidden-island-rulebook.pdf\")", "https://boardgamegeek.com/boardgame/65244"],
    ["Formula D", "Base Game", "Billy, Darren", 2, 2, 10, "5, 6, 7, 8", 60, 1.96, 6.98, "=COUNTIF('Plays Log'!B:B, A44)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A44), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://bghub.org/r/formula-d.pdf\", \"Official Rules\"), \"https://bghub.org/r/formula-d.pdf\")", "https://boardgamegeek.com/boardgame/37904"],
    ["Formula D: Circuits 6 – Austin & Nevada Ride", "Expansion", "Darren", 1, 2, 10, "5, 10", 60, 2.0, 7.72, "=COUNTIF('Plays Log'!B:B, A45)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A45), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://bghub.org/r/formula-d.pdf\", \"Official Rules\"), \"https://bghub.org/r/formula-d.pdf\")", "https://boardgamegeek.com/boardgame/171881"],
    ["Gaia Project", "Base Game", "Billy", 1, 1, 4, "3, 4", 150, 4.4, 8.35, "=COUNTIF('Plays Log'!B:B, A46)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A46), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://board-game-rules.com/wp-content/uploads/2025/01/gaia-project_Official-Rules.pdf\", \"Official Rules\"), \"https://board-game-rules.com/wp-content/uploads/2025/01/gaia-project_Official-Rules.pdf\")", "https://boardgamegeek.com/boardgame/220308"],
    ["Gloomhaven", "Base Game", "Billy", 1, 1, 4, "3", 120, 3.92, 8.53, "=COUNTIF('Plays Log'!B:B, A47)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A47), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://bghub.org/r/gloomhaven.pdf\", \"Official Rules\"), \"https://bghub.org/r/gloomhaven.pdf\")", "https://boardgamegeek.com/boardgame/174430"],
    ["Gloomhaven: Jaws of the Lion", "Base Game", "Billy", 1, 1, 4, "2", 120, 3.64, 8.35, "=COUNTIF('Plays Log'!B:B, A48)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A48), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://board-game-rules.com/wp-content/uploads/2025/01/gloomhaven-jaws-of-the-lion_Official-Rules.pdf\", \"Official Rules\"), \"https://board-game-rules.com/wp-content/uploads/2025/01/gloomhaven-jaws-of-the-lion_Official-Rules.pdf\")", "https://boardgamegeek.com/boardgame/291457"],
    ["Gyrating Hamsters", "Base Game", "Darren", 1, 2, 5, "2", 30, 1.67, 6.36, "=COUNTIF('Plays Log'!B:B, A49)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A49), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://boardgamegeek.com/boardgame/225645/files\", \"Official Rules\"), \"https://boardgamegeek.com/boardgame/225645/files\")", "https://boardgamegeek.com/boardgame/225645"],
    ["Hamlet: By the Lake", "Expansion", "Billy", 1, 1, 4, "4", 90, 2.83, 7.73, "=COUNTIF('Plays Log'!B:B, A50)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A50), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://bghub.org/r/hamlet-the-village-building-game.pdf\", \"Official Rules\"), \"https://bghub.org/r/hamlet-the-village-building-game.pdf\")", "https://boardgamegeek.com/boardgame/389384"],
    ["Hamlet: The Village Building Game", "Base Game", "Billy", 1, 1, 4, "3", 100, 2.95, 6.82, "=COUNTIF('Plays Log'!B:B, A51)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A51), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://bghub.org/r/hamlet-the-village-building-game.pdf\", \"Official Rules\"), \"https://bghub.org/r/hamlet-the-village-building-game.pdf\")", "https://boardgamegeek.com/boardgame/276086"],
    ["Heat: Heavy Rain", "Expansion", "Darren", 1, 1, 7, "5, 6", 60, 2.38, 8.13, "=COUNTIF('Plays Log'!B:B, A52)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A52), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://cdn.1j1ju.com/medias/20/77/e7-heat-pedal-to-the-metal-rulebook.pdf\", \"Official Rules\"), \"https://cdn.1j1ju.com/medias/20/77/e7-heat-pedal-to-the-metal-rulebook.pdf\")", "https://boardgamegeek.com/boardgame/410291"],
    ["Heat: Pedal to the Metal", "Base Game", "Darren", 1, 1, 6, "5, 6", 60, 2.2, 7.99, "=COUNTIF('Plays Log'!B:B, A53)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A53), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://cdn.1j1ju.com/medias/20/77/e7-heat-pedal-to-the-metal-rulebook.pdf\", \"Official Rules\"), \"https://cdn.1j1ju.com/medias/20/77/e7-heat-pedal-to-the-metal-rulebook.pdf\")", "https://boardgamegeek.com/boardgame/366013"],
    ["Heat: Tunnel Vision", "Expansion", "Darren", 1, 1, 7, "5, 6", 60, 2.15, 8.23, "=COUNTIF('Plays Log'!B:B, A54)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A54), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://cdn.1j1ju.com/medias/20/77/e7-heat-pedal-to-the-metal-rulebook.pdf\", \"Official Rules\"), \"https://cdn.1j1ju.com/medias/20/77/e7-heat-pedal-to-the-metal-rulebook.pdf\")", "https://boardgamegeek.com/boardgame/436904"],
    ["Heroes of Land, Air & Sea", "Base Game", "Billy", 1, 1, 4, "4", 180, 3.31, 7.54, "=COUNTIF('Plays Log'!B:B, A55)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A55), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://board-game-rules.com/wp-content/uploads/2025/01/heroes-of-land-air-sea_Official-Rules.pdf\", \"Official Rules\"), \"https://board-game-rules.com/wp-content/uploads/2025/01/heroes-of-land-air-sea_Official-Rules.pdf\")", "https://boardgamegeek.com/boardgame/198830"],
    ["Heroes of Land, Air & Sea: Order and Chaos", "Expansion", "Billy", 1, 1, 6, "4, 6", 180, 3.6, 8.13, "=COUNTIF('Plays Log'!B:B, A56)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A56), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://board-game-rules.com/wp-content/uploads/2025/01/heroes-of-land-air-sea_Official-Rules.pdf\", \"Official Rules\"), \"https://board-game-rules.com/wp-content/uploads/2025/01/heroes-of-land-air-sea_Official-Rules.pdf\")", "https://boardgamegeek.com/boardgame/226407"],
    ["Heroes of Land, Air & Sea: Pestilence", "Expansion", "Billy", 1, 1, 7, "4", 180, 3.5, 8.13, "=COUNTIF('Plays Log'!B:B, A57)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A57), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://board-game-rules.com/wp-content/uploads/2025/01/heroes-of-land-air-sea_Official-Rules.pdf\", \"Official Rules\"), \"https://board-game-rules.com/wp-content/uploads/2025/01/heroes-of-land-air-sea_Official-Rules.pdf\")", "https://boardgamegeek.com/boardgame/253638"],
    ["HeroQuest", "Base Game", "Billy", 1, 2, 5, "5", 90, 2.13, 7.23, "=COUNTIF('Plays Log'!B:B, A58)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A58), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://www.hasbro.com/common/instruct/HeroQuest.PDF\", \"Official Rules\"), \"https://www.hasbro.com/common/instruct/HeroQuest.PDF\")", "https://boardgamegeek.com/boardgame/699"],
    ["Jaipur", "Base Game", "Darren", 1, 2, 2, "2", 30, 1.46, 7.48, "=COUNTIF('Plays Log'!B:B, A59)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A59), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://cdn.1j1ju.com/medias/04/3f/df-jaipur-rulebook.pdf\", \"Official Rules\"), \"https://cdn.1j1ju.com/medias/04/3f/df-jaipur-rulebook.pdf\")", "https://boardgamegeek.com/boardgame/54043"],
    ["Joyride Duel: Next Gen", "Base Game", "Darren", 1, 2, 2, "2", 40, 2.0, 7.48, "=COUNTIF('Plays Log'!B:B, A60)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A60), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://boardgamegeek.com/boardgame/399318/files\", \"Official Rules\"), \"https://boardgamegeek.com/boardgame/399318/files\")", "https://boardgamegeek.com/boardgame/399318"],
    ["Joyride: Survival of the Fastest", "Base Game", "Darren", 1, 2, 4, "4", 60, 2.24, 7.33, "=COUNTIF('Plays Log'!B:B, A61)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A61), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://boardgamegeek.com/boardgame/371183/files\", \"Official Rules\"), \"https://boardgamegeek.com/boardgame/371183/files\")", "https://boardgamegeek.com/boardgame/371183"],
    ["King of Tokyo", "Base Game", "Billy", 1, 2, 6, "4, 5", 30, 1.48, 7.11, "=COUNTIF('Plays Log'!B:B, A62)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A62), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://board-game-rules.com/wp-content/uploads/2025/01/king-of-tokyo_Official-Rules.pdf\", \"Official Rules\"), \"https://board-game-rules.com/wp-content/uploads/2025/01/king-of-tokyo_Official-Rules.pdf\")", "https://boardgamegeek.com/boardgame/70323"],
    ["King of Tokyo: Duel", "Base Game", "Darren", 1, 2, 2, "2", 20, 2.04, 7.13, "=COUNTIF('Plays Log'!B:B, A63)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A63), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://board-game-rules.com/wp-content/uploads/2025/01/king-of-tokyo_Official-Rules.pdf\", \"Official Rules\"), \"https://board-game-rules.com/wp-content/uploads/2025/01/king-of-tokyo_Official-Rules.pdf\")", "https://boardgamegeek.com/boardgame/422484"],
    ["Kingdom Death: Monster", "Base Game", "Billy", 1, 1, 4, "4", 180, 4.28, 8.47, "=COUNTIF('Plays Log'!B:B, A64)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A64), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://boardgamegeek.com/boardgame/55690/files\", \"Official Rules\"), \"https://boardgamegeek.com/boardgame/55690/files\")", "https://boardgamegeek.com/boardgame/55690"],
    ["Kingdom Death: Monster – Gambler's Chest", "Expansion", "Billy", 1, 1, 6, "1, 4", 180, 4.24, 9.43, "=COUNTIF('Plays Log'!B:B, A65)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A65), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://boardgamegeek.com/boardgame/215370/files\", \"Official Rules\"), \"https://boardgamegeek.com/boardgame/215370/files\")", "https://boardgamegeek.com/boardgame/215370"],
    ["Kingdomino", "Base Game", "Darren", 1, 2, 4, "2, 4", 25, 1.24, 7.29, "=COUNTIF('Plays Log'!B:B, A66)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A66), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://blueorangegames.com/wp-content/uploads/2022/08/Kingdomino_Rules_ENG.pdf\", \"Official Rules\"), \"https://blueorangegames.com/wp-content/uploads/2022/08/Kingdomino_Rules_ENG.pdf\")", "https://boardgamegeek.com/boardgame/204583"],
    ["Lawyer Up", "Base Game", "Billy", 1, 1, 2, "2", 75, 2.65, 6.82, "=COUNTIF('Plays Log'!B:B, A67)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A67), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://board-game-rules.com/wp-content/uploads/2025/01/lawyer-up_Official-Rules.pdf\", \"Official Rules\"), \"https://board-game-rules.com/wp-content/uploads/2025/01/lawyer-up_Official-Rules.pdf\")", "https://boardgamegeek.com/boardgame/267401"],
    ["Lords of Hellas", "Base Game", "Billy", 1, 1, 4, "4", 90, 3.32, 7.6, "=COUNTIF('Plays Log'!B:B, A68)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A68), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://board-game-rules.com/wp-content/uploads/2025/01/lords-of-hellas_Official-Rules.pdf\", \"Official Rules\"), \"https://board-game-rules.com/wp-content/uploads/2025/01/lords-of-hellas_Official-Rules.pdf\")", "https://boardgamegeek.com/boardgame/222509"],
    ["Lost Cities", "Base Game", "Darren", 1, 2, 2, "2", 30, 1.47, 7.26, "=COUNTIF('Plays Log'!B:B, A69)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A69), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://cdn.1j1ju.com/medias/c8/66/47-lost-cities-rulebook.pdf\", \"Official Rules\"), \"https://cdn.1j1ju.com/medias/c8/66/47-lost-cities-rulebook.pdf\")", "https://boardgamegeek.com/boardgame/50"],
    ["Lost Ruins of Arnak", "Base Game", "Billy", 1, 1, 4, "3", 120, 2.93, 8.08, "=COUNTIF('Plays Log'!B:B, A70)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A70), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://board-game-rules.com/wp-content/uploads/2025/01/lost-ruins-of-arnak_Official-Rules.pdf\", \"Official Rules\"), \"https://board-game-rules.com/wp-content/uploads/2025/01/lost-ruins-of-arnak_Official-Rules.pdf\")", "https://boardgamegeek.com/boardgame/312484"],
    ["Lost Ruins of Arnak: Expedition Leaders", "Expansion", "Billy", 1, 1, 4, "3", 120, 3.11, 8.72, "=COUNTIF('Plays Log'!B:B, A71)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A71), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://board-game-rules.com/wp-content/uploads/2025/01/lost-ruins-of-arnak_Official-Rules.pdf\", \"Official Rules\"), \"https://board-game-rules.com/wp-content/uploads/2025/01/lost-ruins-of-arnak_Official-Rules.pdf\")", "https://boardgamegeek.com/boardgame/341254"],
    ["Malarky", "Base Game", "Darren", 1, 3, 6, "4, 6", 45, 1.48, 5.66, "=COUNTIF('Plays Log'!B:B, A72)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A72), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://boardgamegeek.com/boardgame/5135/files\", \"Official Rules\"), \"https://boardgamegeek.com/boardgame/5135/files\")", "https://boardgamegeek.com/boardgame/5135"],
    ["March of the Ants", "Base Game", "Billy", 1, 1, 5, "3, 4", 90, 2.72, 7.1, "=COUNTIF('Plays Log'!B:B, A73)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A73), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://board-game-rules.com/wp-content/uploads/2025/01/march-of-the-ants_Official-Rules.pdf\", \"Official Rules\"), \"https://board-game-rules.com/wp-content/uploads/2025/01/march-of-the-ants_Official-Rules.pdf\")", "https://boardgamegeek.com/boardgame/156496"],
    ["March of the Ants: Empires of the Earth", "Expansion", "Billy", 1, 1, 5, "1-5", 90, 3.5, 7.82, "=COUNTIF('Plays Log'!B:B, A74)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A74), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://board-game-rules.com/wp-content/uploads/2025/01/march-of-the-ants_Official-Rules.pdf\", \"Official Rules\"), \"https://board-game-rules.com/wp-content/uploads/2025/01/march-of-the-ants_Official-Rules.pdf\")", "https://boardgamegeek.com/boardgame/275945"],
    ["March of the Ants: Minions of the Meadow", "Expansion", "Billy", 1, 1, 5, "3, 4", 90, 3.25, 7.57, "=COUNTIF('Plays Log'!B:B, A75)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A75), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://board-game-rules.com/wp-content/uploads/2025/01/march-of-the-ants_Official-Rules.pdf\", \"Official Rules\"), \"https://board-game-rules.com/wp-content/uploads/2025/01/march-of-the-ants_Official-Rules.pdf\")", "https://boardgamegeek.com/boardgame/198826"],
    ["Marvel Villainous: Infinite Power", "Base Game", "Billy", 1, 2, 4, "3, 4", 80, 2.7, 6.71, "=COUNTIF('Plays Log'!B:B, A76)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A76), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://board-game-rules.com/wp-content/uploads/2025/01/marvel-villainous-infinite-power_Official-Rules.pdf\", \"Official Rules\"), \"https://board-game-rules.com/wp-content/uploads/2025/01/marvel-villainous-infinite-power_Official-Rules.pdf\")", "https://boardgamegeek.com/boardgame/302336"],
    ["Marvel Villainous: Mischief & Malice", "Base Game", "Billy", 1, 2, 3, "3", 80, 2.78, 7.22, "=COUNTIF('Plays Log'!B:B, A77)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A77), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://board-game-rules.com/wp-content/uploads/2025/01/marvel-villainous-infinite-power_Official-Rules.pdf\", \"Official Rules\"), \"https://board-game-rules.com/wp-content/uploads/2025/01/marvel-villainous-infinite-power_Official-Rules.pdf\")", "https://boardgamegeek.com/boardgame/335528"],
    ["Marvel: Crisis Protocol Core Set", "Base Game", "Billy", 1, 2, 2, "2", 45, 3.05, 8.21, "=COUNTIF('Plays Log'!B:B, A78)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A78), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://boardgamegeek.com/boardgame/285905/files\", \"Official Rules\"), \"https://boardgamegeek.com/boardgame/285905/files\")", "https://boardgamegeek.com/boardgame/285905"],
    ["Mice and Mystics", "Base Game", "Billy", 1, 1, 4, "4", 90, 2.74, 7.2, "=COUNTIF('Plays Log'!B:B, A79)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A79), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://board-game-rules.com/wp-content/uploads/2025/01/mice-and-mystics_Official-Rules.pdf\", \"Official Rules\"), \"https://board-game-rules.com/wp-content/uploads/2025/01/mice-and-mystics_Official-Rules.pdf\")", "https://boardgamegeek.com/boardgame/124708"],
    ["Mille Bornes", "Base Game", "Darren", 1, 2, 6, "4", 45, 1.25, 5.71, "=COUNTIF('Plays Log'!B:B, A80)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A80), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://boardgamegeek.com/boardgame/590/files\", \"Official Rules\"), \"https://boardgamegeek.com/boardgame/590/files\")", "https://boardgamegeek.com/boardgame/590"],
    ["Mistborn: The Deckbuilding Game", "Base Game", "Darren", 1, 1, 4, "2", 60, 2.68, 7.62, "=COUNTIF('Plays Log'!B:B, A81)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A81), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://boardgamegeek.com/boardgame/422780/files\", \"Official Rules\"), \"https://boardgamegeek.com/boardgame/422780/files\")", "https://boardgamegeek.com/boardgame/422780"],
    ["MLEM: Space Agency", "Base Game", "Darren", 1, 2, 5, "4, 5", 60, 1.75, 7.14, "=COUNTIF('Plays Log'!B:B, A82)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A82), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://board-game-rules.com/wp-content/uploads/2025/01/mlem-space-agency_Official-Rules.pdf\", \"Official Rules\"), \"https://board-game-rules.com/wp-content/uploads/2025/01/mlem-space-agency_Official-Rules.pdf\")", "https://boardgamegeek.com/boardgame/387378"],
    ["Monkey Palace", "Base Game", "Darren", 1, 2, 4, "2", 45, 1.99, 7.12, "=COUNTIF('Plays Log'!B:B, A83)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A83), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://bghub.org/r/monkey-palace.pdf\", \"Official Rules\"), \"https://bghub.org/r/monkey-palace.pdf\")", "https://boardgamegeek.com/boardgame/412911"],
    ["Near and Far", "Base Game", "Billy", 1, 2, 4, "3", 120, 2.9, 7.63, "=COUNTIF('Plays Log'!B:B, A84)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A84), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://board-game-rules.com/wp-content/uploads/2025/01/near-and-far_Official-Rules.pdf\", \"Official Rules\"), \"https://board-game-rules.com/wp-content/uploads/2025/01/near-and-far_Official-Rules.pdf\")", "https://boardgamegeek.com/boardgame/195421"],
    ["Near and Far: Amber Mines", "Expansion", "Billy", 1, 2, 4, "2, 3", 120, 2.77, 8.09, "=COUNTIF('Plays Log'!B:B, A85)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A85), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://board-game-rules.com/wp-content/uploads/2025/01/near-and-far_Official-Rules.pdf\", \"Official Rules\"), \"https://board-game-rules.com/wp-content/uploads/2025/01/near-and-far_Official-Rules.pdf\")", "https://boardgamegeek.com/boardgame/236667"],
    ["Nemesis", "Base Game", "Billy, Darren", 2, 1, 5, "4, 5", 180, 3.49, 8.24, "=COUNTIF('Plays Log'!B:B, A86)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A86), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://boardgame.bg/nemesis-rules.pdf\", \"Official Rules\"), \"https://boardgame.bg/nemesis-rules.pdf\")", "https://boardgamegeek.com/boardgame/167355"],
    ["Nemesis: Aftermath", "Expansion", "Darren", 1, 1, 5, "4", 60, 3.3, 8.36, "=COUNTIF('Plays Log'!B:B, A87)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A87), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://bghub.org/r/nemesis.pdf\", \"Official Rules\"), \"https://bghub.org/r/nemesis.pdf\")", "https://boardgamegeek.com/boardgame/318351"],
    ["Nemesis: Lockdown", "Base Game", "Darren", 1, 1, 5, "4", 180, 3.92, 8.23, "=COUNTIF('Plays Log'!B:B, A88)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A88), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://board-game-rules.com/wp-content/uploads/2025/01/nemesis-lockdown_Official-Rules.pdf\", \"Official Rules\"), \"https://board-game-rules.com/wp-content/uploads/2025/01/nemesis-lockdown_Official-Rules.pdf\")", "https://boardgamegeek.com/boardgame/310100"],
    ["Nemesis: Retaliation", "Base Game", "Darren", 1, 1, 5, "4, 5", 180, 3.77, 8.65, "=COUNTIF('Plays Log'!B:B, A89)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A89), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://board-game-rules.com/wp-content/uploads/2025/01/nemesis_Official-Rules.pdf\", \"Official Rules\"), \"https://board-game-rules.com/wp-content/uploads/2025/01/nemesis_Official-Rules.pdf\")", "https://boardgamegeek.com/boardgame/381248"],
    ["One Deck Dungeon", "Base Game", "Billy", 1, 1, 2, "1", 45, 2.09, 6.93, "=COUNTIF('Plays Log'!B:B, A90)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A90), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://boardgamegeek.com/boardgame/179275/files\", \"Official Rules\"), \"https://boardgamegeek.com/boardgame/179275/files\")", "https://boardgamegeek.com/boardgame/179275"],
    ["Pandemic", "Base Game", "Darren", 1, 2, 4, "4", 45, 2.39, 7.51, "=COUNTIF('Plays Log'!B:B, A91)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A91), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://board-game-rules.com/wp-content/uploads/2025/01/pandemic_Official-Rules.pdf\", \"Official Rules\"), \"https://board-game-rules.com/wp-content/uploads/2025/01/pandemic_Official-Rules.pdf\")", "https://boardgamegeek.com/boardgame/30549"],
    ["PitchCar", "Base Game", "Darren", 1, 2, 8, "5, 6", 30, 1.12, 7.29, "=COUNTIF('Plays Log'!B:B, A92)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A92), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://bghub.org/r/pitchcar.pdf\", \"Official Rules\"), \"https://bghub.org/r/pitchcar.pdf\")", "https://boardgamegeek.com/boardgame/150"],
    ["Planted: A Game of Nature & Nurture", "Base Game", "Billy", 1, 2, 5, "3, 4", 30, 1.68, 7.22, "=COUNTIF('Plays Log'!B:B, A93)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A93), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://boardgamegeek.com/boardgame/365104/files\", \"Official Rules\"), \"https://boardgamegeek.com/boardgame/365104/files\")", "https://boardgamegeek.com/boardgame/365104"],
    ["Quacks", "Base Game", "Billy", 1, 2, 4, "4", 45, 1.94, 7.8, "=COUNTIF('Plays Log'!B:B, A94)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A94), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://bghub.org/r/quacks.pdf\", \"Official Rules\"), \"https://bghub.org/r/quacks.pdf\")", "https://boardgamegeek.com/boardgame/244521"],
    ["Race for the Galaxy", "Base Game", "Darren", 1, 2, 4, "2", 60, 2.99, 7.74, "=COUNTIF('Plays Log'!B:B, A95)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A95), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://www.riograndegames.com/wp-content/uploads/2013/02/Race-for-the-Galaxy-Rules.pdf\", \"Official Rules\"), \"https://www.riograndegames.com/wp-content/uploads/2013/02/Race-for-the-Galaxy-Rules.pdf\")", "https://boardgamegeek.com/boardgame/28143"],
    ["Rats of Wistar", "Base Game", "Billy", 1, 1, 4, "3", 90, 3.4, 7.45, "=COUNTIF('Plays Log'!B:B, A96)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A96), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://board-game-rules.com/wp-content/uploads/2025/01/rats-of-wistar_Official-Rules.pdf\", \"Official Rules\"), \"https://board-game-rules.com/wp-content/uploads/2025/01/rats-of-wistar_Official-Rules.pdf\")", "https://boardgamegeek.com/boardgame/387780"],
    ["Roll for the Galaxy", "Base Game", "Billy", 1, 2, 5, "3, 4", 45, 2.78, 7.56, "=COUNTIF('Plays Log'!B:B, A97)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A97), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://board-game-rules.com/wp-content/uploads/2025/01/roll-for-the-galaxy_Official-Rules.pdf\", \"Official Rules\"), \"https://board-game-rules.com/wp-content/uploads/2025/01/roll-for-the-galaxy_Official-Rules.pdf\")", "https://boardgamegeek.com/boardgame/132531"],
    ["Roll for the Galaxy: Ambition", "Expansion", "Billy", 1, 2, 5, "3, 4", 60, 2.82, 8.08, "=COUNTIF('Plays Log'!B:B, A98)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A98), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://board-game-rules.com/wp-content/uploads/2025/01/roll-for-the-galaxy_Official-Rules.pdf\", \"Official Rules\"), \"https://board-game-rules.com/wp-content/uploads/2025/01/roll-for-the-galaxy_Official-Rules.pdf\")", "https://boardgamegeek.com/boardgame/175754"],
    ["Roll the Bones", "Base Game", "Darren", 1, 2, 6, "2-6", 8, 0.0, 5.76, "=COUNTIF('Plays Log'!B:B, A99)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A99), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://boardgamegeek.com/boardgame/377568/files\", \"Official Rules\"), \"https://boardgamegeek.com/boardgame/377568/files\")", "https://boardgamegeek.com/boardgame/377568"],
    ["Rook", "Base Game", "Darren", 1, 2, 6, "4", 45, 1.87, 6.45, "=COUNTIF('Plays Log'!B:B, A100)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A100), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://www.hasbro.com/common/instruct/Rook.PDF\", \"Official Rules\"), \"https://www.hasbro.com/common/instruct/Rook.PDF\")", "https://boardgamegeek.com/boardgame/1260"],
    ["Rummikub", "Base Game", "Darren", 1, 2, 4, "4", 60, 1.71, 6.53, "=COUNTIF('Plays Log'!B:B, A101)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A101), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://pressmantoy.com/wp-content/uploads/2016/09/0400-06_Instructions_English.pdf\", \"Official Rules\"), \"https://pressmantoy.com/wp-content/uploads/2016/09/0400-06_Instructions_English.pdf\")", "https://boardgamegeek.com/boardgame/811"],
    ["Scythe", "Base Game", "Billy", 1, 1, 5, "4", 115, 3.45, 8.09, "=COUNTIF('Plays Log'!B:B, A102)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A102), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://board-game-rules.com/wp-content/uploads/2025/01/scythe_Official-Rules.pdf\", \"Official Rules\"), \"https://board-game-rules.com/wp-content/uploads/2025/01/scythe_Official-Rules.pdf\")", "https://boardgamegeek.com/boardgame/169786"],
    ["Scythe: Invaders from Afar", "Expansion", "Billy", 1, 1, 7, "4, 5", 140, 3.45, 8.26, "=COUNTIF('Plays Log'!B:B, A103)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A103), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://board-game-rules.com/wp-content/uploads/2025/01/scythe_Official-Rules.pdf\", \"Official Rules\"), \"https://board-game-rules.com/wp-content/uploads/2025/01/scythe_Official-Rules.pdf\")", "https://boardgamegeek.com/boardgame/199727"],
    ["Settlers of New Catan (fan expansion for Catan)", "Expansion", "Billy", 1, 3, 4, "3-4", 90, 2.0, 6.82, "=COUNTIF('Plays Log'!B:B, A104)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A104), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://board-game-rules.com/wp-content/uploads/2026/09/the-settlers-of-catan_Official-Rules.pdf\", \"Official Rules\"), \"https://board-game-rules.com/wp-content/uploads/2026/09/the-settlers-of-catan_Official-Rules.pdf\")", "https://boardgamegeek.com/boardgame/10817"],
    ["Sky Team", "Base Game", "Darren", 1, 2, 2, "2", 20, 2.04, 8.11, "=COUNTIF('Plays Log'!B:B, A105)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A105), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://board-game-rules.com/wp-content/uploads/2025/01/sky-team_Official-Rules.pdf\", \"Official Rules\"), \"https://board-game-rules.com/wp-content/uploads/2025/01/sky-team_Official-Rules.pdf\")", "https://boardgamegeek.com/boardgame/373106"],
    ["Sky Team: Turbulence", "Expansion", "Darren", 1, 2, 2, "2", 15, 2.24, 8.49, "=COUNTIF('Plays Log'!B:B, A106)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A106), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://board-game-rules.com/wp-content/uploads/2025/01/sky-team_Official-Rules.pdf\", \"Official Rules\"), \"https://board-game-rules.com/wp-content/uploads/2025/01/sky-team_Official-Rules.pdf\")", "https://boardgamegeek.com/boardgame/423177"],
    ["Sorry!", "Base Game", "Darren", 1, 2, 4, "3, 4", 30, 1.0, 4.92, "=COUNTIF('Plays Log'!B:B, A107)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A107), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://www.hasbro.com/common/instruct/Sorry.PDF\", \"Official Rules\"), \"https://www.hasbro.com/common/instruct/Sorry.PDF\")", "https://boardgamegeek.com/boardgame/313121"],
    ["Spirit Island", "Base Game", "Billy, Darren", 2, 1, 4, "2", 120, 4.08, 8.34, "=COUNTIF('Plays Log'!B:B, A108)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A108), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://board-game-rules.com/wp-content/uploads/2025/01/spirit-island_Official-Rules.pdf\", \"Official Rules\"), \"https://board-game-rules.com/wp-content/uploads/2025/01/spirit-island_Official-Rules.pdf\")", "https://boardgamegeek.com/boardgame/162886"],
    ["Spirit Island: Branch & Claw", "Expansion", "Billy", 1, 1, 4, "2", 120, 4.24, 8.98, "=COUNTIF('Plays Log'!B:B, A109)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A109), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://board-game-rules.com/wp-content/uploads/2025/01/spirit-island_Official-Rules.pdf\", \"Official Rules\"), \"https://board-game-rules.com/wp-content/uploads/2025/01/spirit-island_Official-Rules.pdf\")", "https://boardgamegeek.com/boardgame/193065"],
    ["Spirit Island: Jagged Earth", "Expansion", "Billy", 1, 1, 6, "2, 3", 120, 4.53, 9.33, "=COUNTIF('Plays Log'!B:B, A110)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A110), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://board-game-rules.com/wp-content/uploads/2025/01/spirit-island_Official-Rules.pdf\", \"Official Rules\"), \"https://board-game-rules.com/wp-content/uploads/2025/01/spirit-island_Official-Rules.pdf\")", "https://boardgamegeek.com/boardgame/262722"],
    ["Splendor Duel", "Base Game", "Darren", 1, 2, 2, "2", 30, 2.04, 7.88, "=COUNTIF('Plays Log'!B:B, A111)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A111), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://cdn.1j1ju.com/medias/d5/20/a3-splendor-duel-rulebook.pdf\", \"Official Rules\"), \"https://cdn.1j1ju.com/medias/d5/20/a3-splendor-duel-rulebook.pdf\")", "https://boardgamegeek.com/boardgame/364073"],
    ["Spyrium", "Base Game", "Billy", 1, 2, 5, "4", 75, 2.91, 7.04, "=COUNTIF('Plays Log'!B:B, A112)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A112), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://board-game-rules.com/wp-content/uploads/2025/01/spyrium_Official-Rules.pdf\", \"Official Rules\"), \"https://board-game-rules.com/wp-content/uploads/2025/01/spyrium_Official-Rules.pdf\")", "https://boardgamegeek.com/boardgame/137269"],
    ["Star Realms Academy", "Base Game", "Darren", 1, 2, 2, "2", 20, 1.5, 7.69, "=COUNTIF('Plays Log'!B:B, A113)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A113), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://board-game-rules.com/wp-content/uploads/2025/01/star-realms_Official-Rules.pdf\", \"Official Rules\"), \"https://board-game-rules.com/wp-content/uploads/2025/01/star-realms_Official-Rules.pdf\")", "https://boardgamegeek.com/boardgame/407812"],
    ["Star Trek: Star Realms Core Set", "Base Game", "Darren", 1, 2, 4, "2", 20, 2.0, 7.28, "=COUNTIF('Plays Log'!B:B, A114)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A114), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://board-game-rules.com/wp-content/uploads/2025/01/star-realms_Official-Rules.pdf\", \"Official Rules\"), \"https://board-game-rules.com/wp-content/uploads/2025/01/star-realms_Official-Rules.pdf\")", "https://boardgamegeek.com/boardgame/422345"],
    ["Star Wars Villainous: Cold Tactics", "Base Game", "Darren", 1, 2, 2, "2-2", 50, 2.5, 7.43, "=COUNTIF('Plays Log'!B:B, A115)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A115), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://board-game-rules.com/wp-content/uploads/2025/01/star-wars-villainous-power-of-the-dark-side_Official-Rules.pdf\", \"Official Rules\"), \"https://board-game-rules.com/wp-content/uploads/2025/01/star-wars-villainous-power-of-the-dark-side_Official-Rules.pdf\")", "https://boardgamegeek.com/boardgame/447381"],
    ["Star Wars Villainous: Power of the Dark Side", "Base Game", "Darren", 1, 2, 4, "2", 50, 2.57, 6.99, "=COUNTIF('Plays Log'!B:B, A116)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A116), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://board-game-rules.com/wp-content/uploads/2025/01/star-wars-villainous-power-of-the-dark-side_Official-Rules.pdf\", \"Official Rules\"), \"https://board-game-rules.com/wp-content/uploads/2025/01/star-wars-villainous-power-of-the-dark-side_Official-Rules.pdf\")", "https://boardgamegeek.com/boardgame/358800"],
    ["Star Wars Villainous: Scum and Villainy", "Base Game", "Darren", 1, 2, 3, "3", 50, 2.67, 7.52, "=COUNTIF('Plays Log'!B:B, A117)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A117), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://board-game-rules.com/wp-content/uploads/2025/01/star-wars-villainous-power-of-the-dark-side_Official-Rules.pdf\", \"Official Rules\"), \"https://board-game-rules.com/wp-content/uploads/2025/01/star-wars-villainous-power-of-the-dark-side_Official-Rules.pdf\")", "https://boardgamegeek.com/boardgame/387836"],
    ["Star Wars: Battle of Hoth", "Base Game", "Darren", 1, 2, 4, "2", 30, 1.91, 7.9, "=COUNTIF('Plays Log'!B:B, A118)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A118), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://bghub.org/r/star-wars-battle-of-hoth.pdf\", \"Official Rules\"), \"https://bghub.org/r/star-wars-battle-of-hoth.pdf\")", "https://boardgamegeek.com/boardgame/444481"],
    ["Star Wars: Bounty Hunters", "Base Game", "Darren", 1, 2, 6, "4", 20, 1.35, 6.56, "=COUNTIF('Plays Log'!B:B, A119)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A119), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://cdn.1j1ju.com/medias/53/e0/6f-star-wars-imperial-assault-rulebook.pdf\", \"Official Rules\"), \"https://cdn.1j1ju.com/medias/53/e0/6f-star-wars-imperial-assault-rulebook.pdf\")", "https://boardgamegeek.com/boardgame/410655"],
    ["Star Wars: Epic Duels", "Base Game", "Billy", 1, 2, 6, "2, 4", 30, 1.78, 7.03, "=COUNTIF('Plays Log'!B:B, A120)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A120), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://cdn.1j1ju.com/medias/53/e0/6f-star-wars-imperial-assault-rulebook.pdf\", \"Official Rules\"), \"https://cdn.1j1ju.com/medias/53/e0/6f-star-wars-imperial-assault-rulebook.pdf\")", "https://boardgamegeek.com/boardgame/3284"],
    ["Star Wars: Imperial Assault", "Base Game", "Billy, Darren", 2, 2, 5, "2, 5", 120, 3.3, 7.95, "=COUNTIF('Plays Log'!B:B, A121)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A121), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://cdn.1j1ju.com/medias/53/e0/6f-star-wars-imperial-assault-rulebook.pdf\", \"Official Rules\"), \"https://cdn.1j1ju.com/medias/53/e0/6f-star-wars-imperial-assault-rulebook.pdf\")", "https://boardgamegeek.com/boardgame/164153"],
    ["Star Wars: Outer Rim", "Base Game", "Darren", 1, 1, 4, "3", 180, 2.6, 7.75, "=COUNTIF('Plays Log'!B:B, A122)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A122), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://images-cdn.fantasyflightgames.com/filer_public/1f/7f/1f7f3850-9a91-4461-b43e-1b5352d67846/swor_living_rules_reference_1.pdf\", \"Official Rules\"), \"https://images-cdn.fantasyflightgames.com/filer_public/1f/7f/1f7f3850-9a91-4461-b43e-1b5352d67846/swor_living_rules_reference_1.pdf\")", "https://boardgamegeek.com/boardgame/271896"],
    ["Star Wars: Outer Rim – Unfinished Business", "Expansion", "Darren", 1, 1, 4, "3", 180, 2.8, 8.57, "=COUNTIF('Plays Log'!B:B, A123)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A123), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://board-game-rules.com/wp-content/uploads/2025/01/star-wars-outer-rim_Official-Rules.pdf\", \"Official Rules\"), \"https://board-game-rules.com/wp-content/uploads/2025/01/star-wars-outer-rim_Official-Rules.pdf\")", "https://boardgamegeek.com/boardgame/347102"],
    ["Star Wars: Rebellion", "Base Game", "Darren", 1, 2, 4, "2", 240, 3.75, 8.42, "=COUNTIF('Plays Log'!B:B, A124)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A124), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://images-cdn.fantasyflightgames.com/filer_public/0b/07/0b07601a-6ac3-4333-ac41-b6d1b9a979da/sw03_learn_to_play_web.pdf\", \"Official Rules\"), \"https://images-cdn.fantasyflightgames.com/filer_public/0b/07/0b07601a-6ac3-4333-ac41-b6d1b9a979da/sw03_learn_to_play_web.pdf\")", "https://boardgamegeek.com/boardgame/187645"],
    ["Star Wars: The Deckbuilding Game", "Base Game", "Darren", 1, 2, 2, "2", 90, 2.05, 7.82, "=COUNTIF('Plays Log'!B:B, A125)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A125), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://board-game-rules.com/wp-content/uploads/2025/01/star-wars-the-deckbuilding-game_Official-Rules.pdf\", \"Official Rules\"), \"https://board-game-rules.com/wp-content/uploads/2025/01/star-wars-the-deckbuilding-game_Official-Rules.pdf\")", "https://boardgamegeek.com/boardgame/374173"],
    ["Star Wars: The Deckbuilding Game – Mandalorian Faction Pack", "Expansion", "Darren", 1, 2, 3, "2", 30, 2.0, 8.33, "=COUNTIF('Plays Log'!B:B, A126)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A126), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://board-game-rules.com/wp-content/uploads/2025/01/star-wars-the-deckbuilding-game_Official-Rules.pdf\", \"Official Rules\"), \"https://board-game-rules.com/wp-content/uploads/2025/01/star-wars-the-deckbuilding-game_Official-Rules.pdf\")", "https://boardgamegeek.com/boardgame/453918"],
    ["Star Wars: Unlimited – Intro Battle: Hoth", "Base Game", "Darren", 1, 2, 2, "2", 20, 2.0, 7.42, "=COUNTIF('Plays Log'!B:B, A127)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A127), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://board-game-rules.com/wp-content/uploads/2025/01/star-wars-unlimited_Official-Rules.pdf\", \"Official Rules\"), \"https://board-game-rules.com/wp-content/uploads/2025/01/star-wars-unlimited_Official-Rules.pdf\")", "https://boardgamegeek.com/boardgame/452742"],
    ["Star Wars: Unlimited – Shadows of the Galaxy", "Expansion", "Darren", 1, 2, 4, "2, 4", 20, 3.0, 8.03, "=COUNTIF('Plays Log'!B:B, A128)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A128), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://board-game-rules.com/wp-content/uploads/2025/01/star-wars-unlimited_Official-Rules.pdf\", \"Official Rules\"), \"https://board-game-rules.com/wp-content/uploads/2025/01/star-wars-unlimited_Official-Rules.pdf\")", "https://boardgamegeek.com/boardgame/419398"],
    ["Star Wars: X-Wing (Second Edition)", "Base Game", "Darren", 1, 2, 2, "2", 45, 3.11, 8.01, "=COUNTIF('Plays Log'!B:B, A129)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A129), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://images-cdn.fantasyflightgames.com/filer_public/6c/ed/6ced3492-42fb-43c9-b542-0528cd19cff9/swz01_rulebookweb.pdf\", \"Official Rules\"), \"https://images-cdn.fantasyflightgames.com/filer_public/6c/ed/6ced3492-42fb-43c9-b542-0528cd19cff9/swz01_rulebookweb.pdf\")", "https://boardgamegeek.com/boardgame/252328"],
    ["Star Wars: X-Wing (Second Edition) – Millennium Falcon Expansion Pack", "Expansion", "Darren", 1, 2, 2, "2-2", 45, 0.0, 8.06, "=COUNTIF('Plays Log'!B:B, A130)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A130), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://images-cdn.fantasyflightgames.com/filer_public/6c/ed/6ced3492-42fb-43c9-b542-0528cd19cff9/swz01_rulebookweb.pdf\", \"Official Rules\"), \"https://images-cdn.fantasyflightgames.com/filer_public/6c/ed/6ced3492-42fb-43c9-b542-0528cd19cff9/swz01_rulebookweb.pdf\")", "https://boardgamegeek.com/boardgame/271918"],
    ["Star Wars: X-Wing (Second Edition) – T-65 X-Wing Expansion Pack", "Expansion", "Darren", 1, 2, 2, "2-2", 45, 0.0, 7.91, "=COUNTIF('Plays Log'!B:B, A131)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A131), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://images-cdn.fantasyflightgames.com/filer_public/6c/ed/6ced3492-42fb-43c9-b542-0528cd19cff9/swz01_rulebookweb.pdf\", \"Official Rules\"), \"https://images-cdn.fantasyflightgames.com/filer_public/6c/ed/6ced3492-42fb-43c9-b542-0528cd19cff9/swz01_rulebookweb.pdf\")", "https://boardgamegeek.com/boardgame/252507"],
    ["Star Wars: X-Wing (Second Edition) – YT-2400 Light Freighter Expansion Pack", "Expansion", "Darren", 1, 2, 2, "2-2", 60, 0.0, 8.28, "=COUNTIF('Plays Log'!B:B, A132)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A132), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://images-cdn.fantasyflightgames.com/filer_public/6c/ed/6ced3492-42fb-43c9-b542-0528cd19cff9/swz01_rulebookweb.pdf\", \"Official Rules\"), \"https://images-cdn.fantasyflightgames.com/filer_public/6c/ed/6ced3492-42fb-43c9-b542-0528cd19cff9/swz01_rulebookweb.pdf\")", "https://boardgamegeek.com/boardgame/401485"],
    ["Stationfall", "Base Game", "Billy", 1, 1, 9, "4, 5", 150, 3.96, 7.69, "=COUNTIF('Plays Log'!B:B, A133)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A133), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://board-game-rules.com/wp-content/uploads/2025/01/stationfall_Official-Rules.pdf\", \"Official Rules\"), \"https://board-game-rules.com/wp-content/uploads/2025/01/stationfall_Official-Rules.pdf\")", "https://boardgamegeek.com/boardgame/316624"],
    ["Taco Cat Goat Cheese Pizza", "Base Game", "Darren", 1, 2, 8, "4, 5, 6", 30, 1.03, 6.45, "=COUNTIF('Plays Log'!B:B, A134)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A134), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://board-game-rules.com/wp-content/uploads/2025/01/taco-cat-goat-cheese-pizza_Official-Rules.pdf\", \"Official Rules\"), \"https://board-game-rules.com/wp-content/uploads/2025/01/taco-cat-goat-cheese-pizza_Official-Rules.pdf\")", "https://boardgamegeek.com/boardgame/253664"],
    ["Terraforming Mars", "Base Game", "Billy", 1, 1, 5, "3", 120, 3.27, 8.33, "=COUNTIF('Plays Log'!B:B, A135)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A135), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://board-game-rules.com/wp-content/uploads/2025/01/terraforming-mars_Official-Rules.pdf\", \"Official Rules\"), \"https://board-game-rules.com/wp-content/uploads/2025/01/terraforming-mars_Official-Rules.pdf\")", "https://boardgamegeek.com/boardgame/167791"],
    ["Tetris", "Base Game", "Darren", 1, 2, 4, "3, 4", 30, 1.47, 6.39, "=COUNTIF('Plays Log'!B:B, A136)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A136), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://boardgamegeek.com/boardgame/342016/files\", \"Official Rules\"), \"https://boardgamegeek.com/boardgame/342016/files\")", "https://boardgamegeek.com/boardgame/342016"],
    ["The 7th Continent", "Base Game", "Billy", 1, 1, 4, "1, 2", 1000, 2.9, 7.72, "=COUNTIF('Plays Log'!B:B, A137)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A137), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://board-game-rules.com/wp-content/uploads/2025/01/the-7th-continent_Official-Rules.pdf\", \"Official Rules\"), \"https://board-game-rules.com/wp-content/uploads/2025/01/the-7th-continent_Official-Rules.pdf\")", "https://boardgamegeek.com/boardgame/180263"],
    ["The Bears and the Bees", "Base Game", "Darren", 1, 2, 5, "4", 30, 1.3, 6.73, "=COUNTIF('Plays Log'!B:B, A138)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A138), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://boardgamegeek.com/boardgame/257372/files\", \"Official Rules\"), \"https://boardgamegeek.com/boardgame/257372/files\")", "https://boardgamegeek.com/boardgame/257372"],
    ["The Crew: Family Adventure", "Base Game", "Darren", 1, 3, 5, "4", 20, 1.8, 5.96, "=COUNTIF('Plays Log'!B:B, A139)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A139), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://board-game-rules.com/wp-content/uploads/2025/01/the-crew-the-quest-for-planet-nine_Official-Rules.pdf\", \"Official Rules\"), \"https://board-game-rules.com/wp-content/uploads/2025/01/the-crew-the-quest-for-planet-nine_Official-Rules.pdf\")", "https://boardgamegeek.com/boardgame/406299"],
    ["The Crew: The Quest for Planet Nine", "Base Game", "Billy, Darren", 2, 2, 5, "4", 20, 1.97, 7.75, "=COUNTIF('Plays Log'!B:B, A140)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A140), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://board-game-rules.com/wp-content/uploads/2025/01/the-crew-the-quest-for-planet-nine_Official-Rules.pdf\", \"Official Rules\"), \"https://board-game-rules.com/wp-content/uploads/2025/01/the-crew-the-quest-for-planet-nine_Official-Rules.pdf\")", "https://boardgamegeek.com/boardgame/284083"],
    ["The Game of Life: Super Mario Edition", "Base Game", "Darren", 1, 2, 4, "4", 120, 1.4, 6.25, "=COUNTIF('Plays Log'!B:B, A141)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A141), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://www.hasbro.com/common/instruct/Life.PDF\", \"Official Rules\"), \"https://www.hasbro.com/common/instruct/Life.PDF\")", "https://boardgamegeek.com/boardgame/346143"],
    ["The Reckoners", "Base Game", "Darren", 1, 1, 6, "4", 100, 2.72, 7.64, "=COUNTIF('Plays Log'!B:B, A142)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A142), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://boardgamegeek.com/boardgame/208024/files\", \"Official Rules\"), \"https://boardgamegeek.com/boardgame/208024/files\")", "https://boardgamegeek.com/boardgame/208024"],
    ["The Resistance: Avalon", "Base Game", "Billy", 1, 5, 10, "7, 8", 30, 1.74, 7.49, "=COUNTIF('Plays Log'!B:B, A143)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A143), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://board-game-rules.com/wp-content/uploads/2025/01/the-resistance-avalon_Official-Rules.pdf\", \"Official Rules\"), \"https://board-game-rules.com/wp-content/uploads/2025/01/the-resistance-avalon_Official-Rules.pdf\")", "https://boardgamegeek.com/boardgame/128882"],
    ["The Thing: The Boardgame", "Base Game", "Billy", 1, 1, 8, "7, 8", 90, 2.96, 7.62, "=COUNTIF('Plays Log'!B:B, A144)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A144), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://board-game-rules.com/wp-content/uploads/2025/01/the-thing-the-boardgame_Official-Rules.pdf\", \"Official Rules\"), \"https://board-game-rules.com/wp-content/uploads/2025/01/the-thing-the-boardgame_Official-Rules.pdf\")", "https://boardgamegeek.com/boardgame/295293"],
    ["Ticket to Ride", "Base Game", "Darren", 1, 2, 5, "4", 60, 1.82, 7.38, "=COUNTIF('Plays Log'!B:B, A145)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A145), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://cdn1.daysofwonder.com/tickettoride/en/img/tt_rules_2015_en.pdf\", \"Official Rules\"), \"https://cdn1.daysofwonder.com/tickettoride/en/img/tt_rules_2015_en.pdf\")", "https://boardgamegeek.com/boardgame/9209"],
    ["Ticket to Ride: First Journey (U.S.)", "Base Game", "Darren", 1, 2, 4, "3, 4", 30, 1.37, 6.84, "=COUNTIF('Plays Log'!B:B, A146)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A146), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://board-game-rules.com/wp-content/uploads/2025/01/ticket-to-ride-first-journey-u-s_Official-Rules.pdf\", \"Official Rules\"), \"https://board-game-rules.com/wp-content/uploads/2025/01/ticket-to-ride-first-journey-u-s_Official-Rules.pdf\")", "https://boardgamegeek.com/boardgame/205125"],
    ["Twilight Imperium: Fourth Edition", "Base Game", "Darren", 1, 3, 6, "6", 480, 4.37, 8.56, "=COUNTIF('Plays Log'!B:B, A147)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A147), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://images-cdn.fantasyflightgames.com/filer_public/da/df/dadf9f07-78f3-43ac-9cce-dd6b55b24ec2/ti4_living_rules_reference_v1_3_web.pdf\", \"Official Rules\"), \"https://images-cdn.fantasyflightgames.com/filer_public/da/df/dadf9f07-78f3-43ac-9cce-dd6b55b24ec2/ti4_living_rules_reference_v1_3_web.pdf\")", "https://boardgamegeek.com/boardgame/233078"],
    ["Undaunted: Normandy", "Base Game", "Billy", 1, 2, 2, "2", 60, 2.27, 7.76, "=COUNTIF('Plays Log'!B:B, A148)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A148), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://board-game-rules.com/wp-content/uploads/2025/01/undaunted-normandy_Official-Rules.pdf\", \"Official Rules\"), \"https://board-game-rules.com/wp-content/uploads/2025/01/undaunted-normandy_Official-Rules.pdf\")", "https://boardgamegeek.com/boardgame/268864"],
    ["Unfathomable", "Base Game", "Billy", 1, 3, 6, "5", 240, 3.13, 7.45, "=COUNTIF('Plays Log'!B:B, A149)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A149), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://board-game-rules.com/wp-content/uploads/2025/01/unfathomable_Official-Rules.pdf\", \"Official Rules\"), \"https://board-game-rules.com/wp-content/uploads/2025/01/unfathomable_Official-Rules.pdf\")", "https://boardgamegeek.com/boardgame/340466"],
    ["Unlock! Kids: Detective Stories", "Base Game", "Darren", 1, 1, 4, "2", 60, 1.53, 7.64, "=COUNTIF('Plays Log'!B:B, A150)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A150), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://boardgamegeek.com/boardgame/327056/files\", \"Official Rules\"), \"https://boardgamegeek.com/boardgame/327056/files\")", "https://boardgamegeek.com/boardgame/327056"],
    ["Unsettled", "Base Game", "Billy", 1, 2, 4, "2", 90, 3.29, 8.04, "=COUNTIF('Plays Log'!B:B, A151)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A151), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://bghub.org/r/unsettled.pdf\", \"Official Rules\"), \"https://bghub.org/r/unsettled.pdf\")", "https://boardgamegeek.com/boardgame/290484"],
    ["Unsettled: Kaelyfos", "Expansion", "Billy", 1, 2, 4, "2", 90, 3.0, 8.05, "=COUNTIF('Plays Log'!B:B, A152)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A152), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://bghub.org/r/unsettled.pdf\", \"Official Rules\"), \"https://bghub.org/r/unsettled.pdf\")", "https://boardgamegeek.com/boardgame/341037"],
    ["Unsettled: Strannos", "Expansion", "Billy", 1, 2, 4, "2", 90, 3.0, 8.41, "=COUNTIF('Plays Log'!B:B, A153)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A153), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://bghub.org/r/unsettled.pdf\", \"Official Rules\"), \"https://bghub.org/r/unsettled.pdf\")", "https://boardgamegeek.com/boardgame/341036"],
    ["Unsettled: Yendraal", "Expansion", "Billy", 1, 2, 4, "2", 90, 3.0, 8.23, "=COUNTIF('Plays Log'!B:B, A154)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A154), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://bghub.org/r/unsettled.pdf\", \"Official Rules\"), \"https://bghub.org/r/unsettled.pdf\")", "https://boardgamegeek.com/boardgame/341024"],
    ["Unsettled: Zehronn", "Expansion", "Billy", 1, 2, 4, "2", 90, 3.0, 8.15, "=COUNTIF('Plays Log'!B:B, A155)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A155), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://bghub.org/r/unsettled.pdf\", \"Official Rules\"), \"https://bghub.org/r/unsettled.pdf\")", "https://boardgamegeek.com/boardgame/341022"],
    ["Western Legends", "Base Game", "Billy", 1, 2, 6, "4", 90, 2.85, 7.59, "=COUNTIF('Plays Log'!B:B, A156)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A156), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://board-game-rules.com/wp-content/uploads/2025/01/western-legends_Official-Rules.pdf\", \"Official Rules\"), \"https://board-game-rules.com/wp-content/uploads/2025/01/western-legends_Official-Rules.pdf\")", "https://boardgamegeek.com/boardgame/232405"],
    ["Wingspan", "Base Game", "Billy, Darren", 2, 1, 5, "3", 70, 2.48, 7.99, "=COUNTIF('Plays Log'!B:B, A157)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A157), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://cdn.1j1ju.com/medias/ff/16/4c-wingspan-rulebook.pdf\", \"Official Rules\"), \"https://cdn.1j1ju.com/medias/ff/16/4c-wingspan-rulebook.pdf\")", "https://boardgamegeek.com/boardgame/266192"],
    ["XCOM: The Board Game", "Base Game", "Billy", 1, 1, 4, "4", 120, 2.91, 6.97, "=COUNTIF('Plays Log'!B:B, A158)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A158), \"yyyy-mm-dd\"), \"Never\")", "=IFERROR(HYPERLINK(\"https://board-game-rules.com/wp-content/uploads/2025/01/xcom-the-board-game_Official-Rules.pdf\", \"Official Rules\"), \"https://board-game-rules.com/wp-content/uploads/2025/01/xcom-the-board-game_Official-Rules.pdf\")", "https://boardgamegeek.com/boardgame/163602"]
  ];

  if (initialGames.length > 0) {
    libSheet.getRange(2, 1, initialGames.length, libHeaders.length).setValues(initialGames);
  }

  // -------------------------------------------------------------
  // TAB 2: PLAYS LOG (Tracks Date, Game, Attendees, Winner, Notes)
  // -------------------------------------------------------------
  let playsSheet = ss.getSheetByName("Plays Log");
  if (!playsSheet) {
    playsSheet = ss.insertSheet("Plays Log", 1);
  }
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
    ["2026-10-06", "The Reckoners", "Darren", 1, "", 100, "Synced from BGG Collection (2 logged plays)", "Yes"],
    ["2026-10-06", "Twilight Imperium: Fourth Edition", "Darren", 3, "", 480, "Synced from BGG Collection (1 logged play)", "Yes"],
    ["2026-05-14", "Excalibur", "Darren", 2, "", 25, "Synced from BGG Collection (1 logged play)", "Yes"],
    ["2025-12-22", "Nemesis", "Darren", 1, "", 180, "Synced from BGG Collection (6 logged plays)", "Yes"],
    ["2025-12-19", "Unlock! Kids: Detective Stories", "Darren", 1, "", 60, "Synced from BGG Collection (1 logged play)", "Yes"],
    ["2025-11-16", "Arcs: Leaders & Lore Pack", "Darren", 2, "", 120, "Synced from BGG Collection (1 logged play)", "Yes"],
    ["2025-07-26", "Nemesis: Retaliation", "Darren", 1, "", 180, "Synced from BGG Collection (1 logged play)", "Yes"],
    ["2025-05-30", "Star Wars: X-Wing (Second Edition)", "Darren", 2, "", 45, "Synced from BGG Collection (1 logged play)", "Yes"],
    ["2025-05-04", "MLEM: Space Agency", "Darren", 2, "", 60, "Synced from BGG Collection (2 logged plays)", "Yes"],
    ["2025-04-21", "Eclipse: Shadow of the Rift", "Billy", 2, "", 120, "Synced from BGG Collection (1 logged play)", "Yes"],
    ["2025-04-21", "Andor: The Family Fantasy Game", "Darren", 2, "", 45, "Synced from BGG Collection (3 logged plays)", "Yes"],
    ["2025-04-21", "Cascadia", "Darren", 1, "", 45, "Synced from BGG Collection (1 logged play)", "Yes"],
    ["2025-04-21", "Dude Perfect the Board Game", "Darren", 2, "", 60, "Synced from BGG Collection (1 logged play)", "Yes"],
    ["2025-04-21", "The Game of Life: Super Mario Edition", "Darren", 2, "", 120, "Synced from BGG Collection (1 logged play)", "Yes"],
    ["2025-04-21", "Joyride Duel: Next Gen", "Darren", 2, "", 40, "Synced from BGG Collection (5 logged plays)", "Yes"],
    ["2025-04-21", "Joyride: Survival of the Fastest", "Darren", 2, "", 60, "Synced from BGG Collection (3 logged plays)", "Yes"],
    ["2025-04-21", "Mistborn: The Deckbuilding Game", "Darren", 1, "", 60, "Synced from BGG Collection (1 logged play)", "Yes"],
    ["2025-04-21", "Monkey Palace", "Darren", 2, "", 45, "Synced from BGG Collection (4 logged plays)", "Yes"],
    ["2025-04-21", "Nemesis: Lockdown", "Darren", 1, "", 180, "Synced from BGG Collection (1 logged play)", "Yes"],
    ["2025-04-21", "Sky Team", "Darren", 2, "", 20, "Synced from BGG Collection (1 logged play)", "Yes"],
    ["2025-04-21", "Spirit Island", "Darren", 1, "", 120, "Synced from BGG Collection (1 logged play)", "Yes"],
    ["2025-04-21", "Star Wars: The Deckbuilding Game", "Darren", 2, "", 90, "Synced from BGG Collection (8 logged plays)", "Yes"],
    ["2025-04-21", "Western Legends", "Darren", 2, "", 90, "Synced from BGG Collection (2 logged plays)", "Yes"],
    ["2025-04-21", "Wingspan", "Darren", 1, "", 70, "Synced from BGG Collection (1 logged play)", "Yes"],
    ["2025-03-07", "Star Wars: Outer Rim", "Darren", 1, "", 180, "Synced from BGG Collection (1 logged play)", "Yes"],
    ["2025-01-11", "Heat: Pedal to the Metal", "Darren", 1, "", 60, "Synced from BGG Collection (5 logged plays)", "Yes"],
    ["2024-07-05", "The King Is Dead: Second Edition", "Darren", 2, "", 45, "Synced from BGG Collection (1 logged play)", "Yes"],
    ["2024-07-04", "The Mind", "Darren", 2, "", 20, "Synced from BGG Collection (3 logged plays)", "Yes"],
    ["2024-05-06", "The Crew: The Quest for Planet Nine", "Darren", 2, "", 20, "Synced from BGG Collection (3 logged plays)", "Yes"],
    ["2024-05-06", "Forbidden Island", "Darren", 2, "", 30, "Synced from BGG Collection (1 logged play)", "Yes"],
    ["2024-05-06", "Jaipur", "Darren", 2, "", 30, "Synced from BGG Collection (1 logged play)", "Yes"]
  ];

  if (initialPlays.length > 0) {
    playsSheet.getRange(2, 1, initialPlays.length, playHeaders.length).setValues(initialPlays);
  }

  // -------------------------------------------------------------
  // TAB 3: RECENT CALENDAR (Auto-sorted by Newest First)
  // -------------------------------------------------------------
  let calSheet = ss.getSheetByName("Recent Calendar");
  if (!calSheet) {
    calSheet = ss.insertSheet("Recent Calendar", 2);
  }
  calSheet.clear();

  const calHeaders = ["Session Date", "Game Played", "Attendees", "Winner", "Duration", "Notes"];
  calSheet.getRange(1, 1, 1, calHeaders.length).setValues([calHeaders]);
  calSheet.getRange(1, 1, 1, calHeaders.length)
    .setBackground("#3b82f6")
    .setFontColor("#ffffff")
    .setFontWeight("bold");

  // Dynamic formula pulling descending plays
  calSheet.getRange("A2").setFormula(
    "=IFERROR(SORT('Plays Log'!A2:G, 1, FALSE), \"No plays logged yet\")"
  );

  // Auto-resize columns
  libSheet.autoResizeColumns(1, libHeaders.length);
  playsSheet.autoResizeColumns(1, playHeaders.length);
  calSheet.autoResizeColumns(1, calHeaders.length);

  // Remove default Sheet1 if exists
  const sheet1 = ss.getSheetByName("Sheet1");
  if (sheet1 && ss.getSheets().length > 1) {
    ss.deleteSheet(sheet1);
  }

  Logger.log("Setup complete! Library, Plays Log, and Recent Calendar tabs created.");
}

/**
 * Helper function to add a new game to the Library with proper dynamic formulas.
 */
function addGameToLibrary(title, type, owners, copies, minP, maxP, bestP, timeM, weight, rating, manualUrl, bggUrl) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const libSheet = ss.getSheetByName("Library");
  if (!libSheet) return;

  const nextRow = libSheet.getLastRow() + 1;
  const fPlays = "=COUNTIF('Plays Log'!B:B, A" + nextRow + ")";
  const fLast = "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A" + nextRow + "), \"yyyy-mm-dd\"), \"Never\")";
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
}

/**
 * Webhook: Logs a play or adds a game directly from index.html on mobile/desktop
 */
function doPost(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const data = JSON.parse(e.postData.contents);
    const action = data.action || "log_play";

    if (action === "add_game") {
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
      return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "Game added to Library!" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // Default: Log Play
    let playsSheet = ss.getSheetByName("Plays Log");
    if (!playsSheet) {
      setupGameNightSpreadsheet();
      playsSheet = ss.getSheetByName("Plays Log");
    }

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

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      message: "Play successfully logged in Google Sheets!",
      data: data
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * GET Endpoint: Allows index.html to fetch live plays directly from Google Sheet
 */
function doGet(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const playsSheet = ss.getSheetByName("Plays Log");
    if (!playsSheet) {
      return ContentService.createTextOutput(JSON.stringify([])).setMimeType(ContentService.MimeType.JSON);
    }

    const rows = playsSheet.getDataRange().getValues();
    if (rows.length <= 1) {
      return ContentService.createTextOutput(JSON.stringify([])).setMimeType(ContentService.MimeType.JSON);
    }

    const plays = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r[0]) continue;
      plays.push({
        date: Utilities.formatDate(new Date(r[0]), Session.getScriptTimeZone(), "yyyy-MM-dd"),
        game_title: r[1],
        players: r[2] ? r[2].toString().split(",").map(p => p.trim()) : [],
        player_count: r[3],
        winner: r[4],
        duration: r[5],
        notes: r[6],
        bgg_synced: (r[7] === "Yes")
      });
    }

    plays.sort((a, b) => new Date(b.date) - new Date(a.date));

    return ContentService.createTextOutput(JSON.stringify(plays))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

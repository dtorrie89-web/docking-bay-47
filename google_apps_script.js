/** @OnlyCurrentDoc */

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
 *       1) Library: All 77 games with Owner(s), Copies, and dynamic formulas
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
      .addItem("1. Run Initial Setup (Build Tabs & 74 Games)", "setupGameNightSpreadsheet")
      .addSeparator()
      .addItem("2. Setup Info", "showSetupAlert")
      .addToUi();
  } catch(e) {}
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
    "Total Plays", "Last Played Date", "BGG URL"
  ];
  libSheet.getRange(1, 1, 1, libHeaders.length).setValues([libHeaders]);
  libSheet.getRange(1, 1, 1, libHeaders.length)
    .setBackground("#1e293b")
    .setFontColor("#ffffff")
    .setFontWeight("bold");

  const initialGames = [
    ["13 Dead End Drive", "Base Game", "Darren", 1, 2, 4, "4", 45, 1.39, 6.12, "=COUNTIF('Plays Log'!B:B, A2)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A2), \"yyyy-mm-dd\"), \"Never\")", "https://boardgamegeek.com/boardgame/1899"],
    ["7 Wonders Duel", "Base Game", "Darren", 1, 2, 2, "2", 30, 2.23, 8.07, "=COUNTIF('Plays Log'!B:B, A3)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A3), \"yyyy-mm-dd\"), \"Never\")", "https://boardgamegeek.com/boardgame/173346"],
    ["Andor: The Family Fantasy Game", "Base Game", "Darren", 1, 2, 4, "4", 45, 1.93, 7.24, "=COUNTIF('Plays Log'!B:B, A4)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A4), \"yyyy-mm-dd\"), \"Never\")", "https://boardgamegeek.com/boardgame/295488"],
    ["Arcs", "Base Game", "Darren", 1, 2, 4, "3, 4", 120, 3.45, 7.98, "=COUNTIF('Plays Log'!B:B, A5)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A5), \"yyyy-mm-dd\"), \"Never\")", "https://boardgamegeek.com/boardgame/359871"],
    ["Arcs: Leaders & Lore Pack", "Expansion", "Darren", 1, 2, 4, "3", 120, 3.26, 8.55, "=COUNTIF('Plays Log'!B:B, A6)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A6), \"yyyy-mm-dd\"), \"Never\")", "https://boardgamegeek.com/boardgame/419279"],
    ["Blokus", "Base Game", "Darren", 1, 2, 4, "4", 30, 1.73, 6.86, "=COUNTIF('Plays Log'!B:B, A7)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A7), \"yyyy-mm-dd\"), \"Never\")", "https://boardgamegeek.com/boardgame/2453"],
    ["Camel Up (Second Edition)", "Base Game", "Darren", 1, 3, 8, "5, 6", 45, 1.51, 7.53, "=COUNTIF('Plays Log'!B:B, A8)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A8), \"yyyy-mm-dd\"), \"Never\")", "https://boardgamegeek.com/boardgame/260605"],
    ["Carcassonne", "Base Game", "Darren", 1, 2, 5, "2", 45, 1.88, 7.42, "=COUNTIF('Plays Log'!B:B, A9)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A9), \"yyyy-mm-dd\"), \"Never\")", "https://boardgamegeek.com/boardgame/822"],
    ["Cascadia", "Base Game", "Darren", 1, 1, 4, "2, 3", 45, 1.84, 7.88, "=COUNTIF('Plays Log'!B:B, A10)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A10), \"yyyy-mm-dd\"), \"Never\")", "https://boardgamegeek.com/boardgame/295947"],
    ["Codenames: Duet", "Base Game", "Darren", 1, 2, 2, "2", 30, 1.36, 7.4, "=COUNTIF('Plays Log'!B:B, A11)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A11), \"yyyy-mm-dd\"), \"Never\")", "https://boardgamegeek.com/boardgame/224037"],
    ["Diced Veggies", "Base Game", "Darren", 1, 2, 4, "3", 30, 1.39, 6.86, "=COUNTIF('Plays Log'!B:B, A12)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A12), \"yyyy-mm-dd\"), \"Never\")", "https://boardgamegeek.com/boardgame/381356"],
    ["Dude Perfect the Board Game", "Base Game", "Darren", 1, 2, 5, "4, 5", 60, 2.0, 5.47, "=COUNTIF('Plays Log'!B:B, A13)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A13), \"yyyy-mm-dd\"), \"Never\")", "https://boardgamegeek.com/boardgame/411415"],
    ["Excalibur", "Base Game", "Darren", 1, 2, 8, "5, 6", 25, 1.28, 7.29, "=COUNTIF('Plays Log'!B:B, A14)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A14), \"yyyy-mm-dd\"), \"Never\")", "https://boardgamegeek.com/boardgame/434172"],
    ["Forbidden Island", "Base Game", "Darren", 1, 2, 4, "4", 30, 1.74, 6.75, "=COUNTIF('Plays Log'!B:B, A15)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A15), \"yyyy-mm-dd\"), \"Never\")", "https://boardgamegeek.com/boardgame/65244"],
    ["Formula D", "Base Game", "Darren", 1, 2, 10, "5, 6, 7, 8", 60, 1.96, 6.98, "=COUNTIF('Plays Log'!B:B, A16)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A16), \"yyyy-mm-dd\"), \"Never\")", "https://boardgamegeek.com/boardgame/37904"],
    ["Formula D: Circuits 6 – Austin & Nevada Ride", "Expansion", "Darren", 1, 2, 10, "5, 10", 60, 2.0, 7.72, "=COUNTIF('Plays Log'!B:B, A17)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A17), \"yyyy-mm-dd\"), \"Never\")", "https://boardgamegeek.com/boardgame/171881"],
    ["Gyrating Hamsters", "Base Game", "Darren", 1, 2, 5, "2", 30, 1.67, 6.36, "=COUNTIF('Plays Log'!B:B, A18)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A18), \"yyyy-mm-dd\"), \"Never\")", "https://boardgamegeek.com/boardgame/225645"],
    ["Heat: Heavy Rain", "Expansion", "Darren", 1, 1, 7, "5, 6", 60, 2.38, 8.13, "=COUNTIF('Plays Log'!B:B, A19)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A19), \"yyyy-mm-dd\"), \"Never\")", "https://boardgamegeek.com/boardgame/410291"],
    ["Heat: Pedal to the Metal", "Base Game", "Darren", 1, 1, 6, "5, 6", 60, 2.2, 7.99, "=COUNTIF('Plays Log'!B:B, A20)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A20), \"yyyy-mm-dd\"), \"Never\")", "https://boardgamegeek.com/boardgame/366013"],
    ["Heat: Tunnel Vision", "Expansion", "Darren", 1, 1, 7, "5, 6", 60, 2.15, 8.23, "=COUNTIF('Plays Log'!B:B, A21)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A21), \"yyyy-mm-dd\"), \"Never\")", "https://boardgamegeek.com/boardgame/436904"],
    ["Jaipur", "Base Game", "Darren", 1, 2, 2, "2", 30, 1.46, 7.48, "=COUNTIF('Plays Log'!B:B, A22)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A22), \"yyyy-mm-dd\"), \"Never\")", "https://boardgamegeek.com/boardgame/54043"],
    ["Joyride Duel: Next Gen", "Base Game", "Darren", 1, 2, 2, "2", 40, 2.0, 7.48, "=COUNTIF('Plays Log'!B:B, A23)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A23), \"yyyy-mm-dd\"), \"Never\")", "https://boardgamegeek.com/boardgame/399318"],
    ["Joyride: Survival of the Fastest", "Base Game", "Darren", 1, 2, 4, "4", 60, 2.24, 7.33, "=COUNTIF('Plays Log'!B:B, A24)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A24), \"yyyy-mm-dd\"), \"Never\")", "https://boardgamegeek.com/boardgame/371183"],
    ["King of Tokyo: Duel", "Base Game", "Darren", 1, 2, 2, "2", 20, 2.04, 7.13, "=COUNTIF('Plays Log'!B:B, A25)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A25), \"yyyy-mm-dd\"), \"Never\")", "https://boardgamegeek.com/boardgame/422484"],
    ["Kingdomino", "Base Game", "Darren", 1, 2, 4, "2, 4", 25, 1.24, 7.29, "=COUNTIF('Plays Log'!B:B, A26)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A26), \"yyyy-mm-dd\"), \"Never\")", "https://boardgamegeek.com/boardgame/204583"],
    ["Lost Cities", "Base Game", "Darren", 1, 2, 2, "2", 30, 1.47, 7.26, "=COUNTIF('Plays Log'!B:B, A27)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A27), \"yyyy-mm-dd\"), \"Never\")", "https://boardgamegeek.com/boardgame/50"],
    ["Malarky", "Base Game", "Darren", 1, 3, 6, "4, 6", 45, 1.48, 5.66, "=COUNTIF('Plays Log'!B:B, A28)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A28), \"yyyy-mm-dd\"), \"Never\")", "https://boardgamegeek.com/boardgame/5135"],
    ["Mille Bornes", "Base Game", "Darren", 1, 2, 6, "4", 45, 1.25, 5.71, "=COUNTIF('Plays Log'!B:B, A29)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A29), \"yyyy-mm-dd\"), \"Never\")", "https://boardgamegeek.com/boardgame/590"],
    ["Mistborn: The Deckbuilding Game", "Base Game", "Darren", 1, 1, 4, "2", 60, 2.68, 7.62, "=COUNTIF('Plays Log'!B:B, A30)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A30), \"yyyy-mm-dd\"), \"Never\")", "https://boardgamegeek.com/boardgame/422780"],
    ["MLEM: Space Agency", "Base Game", "Darren", 1, 2, 5, "4, 5", 60, 1.75, 7.14, "=COUNTIF('Plays Log'!B:B, A31)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A31), \"yyyy-mm-dd\"), \"Never\")", "https://boardgamegeek.com/boardgame/387378"],
    ["Monkey Palace", "Base Game", "Darren", 1, 2, 4, "2", 45, 1.99, 7.12, "=COUNTIF('Plays Log'!B:B, A32)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A32), \"yyyy-mm-dd\"), \"Never\")", "https://boardgamegeek.com/boardgame/412911"],
    ["Nemesis", "Base Game", "Darren", 1, 1, 5, "4, 5", 180, 3.49, 8.24, "=COUNTIF('Plays Log'!B:B, A33)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A33), \"yyyy-mm-dd\"), \"Never\")", "https://boardgamegeek.com/boardgame/167355"],
    ["Nemesis: Aftermath", "Expansion", "Darren", 1, 1, 5, "4", 60, 3.3, 8.36, "=COUNTIF('Plays Log'!B:B, A34)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A34), \"yyyy-mm-dd\"), \"Never\")", "https://boardgamegeek.com/boardgame/318351"],
    ["Nemesis: Lockdown", "Base Game", "Darren", 1, 1, 5, "4", 180, 3.92, 8.23, "=COUNTIF('Plays Log'!B:B, A35)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A35), \"yyyy-mm-dd\"), \"Never\")", "https://boardgamegeek.com/boardgame/310100"],
    ["Nemesis: Retaliation", "Base Game", "Darren", 1, 1, 5, "4, 5", 180, 3.77, 8.65, "=COUNTIF('Plays Log'!B:B, A36)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A36), \"yyyy-mm-dd\"), \"Never\")", "https://boardgamegeek.com/boardgame/381248"],
    ["Pandemic", "Base Game", "Darren", 1, 2, 4, "4", 45, 2.39, 7.51, "=COUNTIF('Plays Log'!B:B, A37)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A37), \"yyyy-mm-dd\"), \"Never\")", "https://boardgamegeek.com/boardgame/30549"],
    ["PitchCar", "Base Game", "Darren", 1, 2, 8, "5, 6", 30, 1.12, 7.29, "=COUNTIF('Plays Log'!B:B, A38)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A38), \"yyyy-mm-dd\"), \"Never\")", "https://boardgamegeek.com/boardgame/150"],
    ["Race for the Galaxy", "Base Game", "Darren", 1, 2, 4, "2", 60, 2.99, 7.74, "=COUNTIF('Plays Log'!B:B, A39)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A39), \"yyyy-mm-dd\"), \"Never\")", "https://boardgamegeek.com/boardgame/28143"],
    ["Roll the Bones", "Base Game", "Darren", 1, 2, 6, "2-6", 8, 0.0, 5.76, "=COUNTIF('Plays Log'!B:B, A40)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A40), \"yyyy-mm-dd\"), \"Never\")", "https://boardgamegeek.com/boardgame/377568"],
    ["Rook", "Base Game", "Darren", 1, 2, 6, "4", 45, 1.87, 6.45, "=COUNTIF('Plays Log'!B:B, A41)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A41), \"yyyy-mm-dd\"), \"Never\")", "https://boardgamegeek.com/boardgame/1260"],
    ["Rummikub", "Base Game", "Darren", 1, 2, 4, "4", 60, 1.71, 6.53, "=COUNTIF('Plays Log'!B:B, A42)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A42), \"yyyy-mm-dd\"), \"Never\")", "https://boardgamegeek.com/boardgame/811"],
    ["Sky Team", "Base Game", "Darren", 1, 2, 2, "2", 20, 2.04, 8.11, "=COUNTIF('Plays Log'!B:B, A43)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A43), \"yyyy-mm-dd\"), \"Never\")", "https://boardgamegeek.com/boardgame/373106"],
    ["Sky Team: Turbulence", "Expansion", "Darren", 1, 2, 2, "2", 15, 2.24, 8.49, "=COUNTIF('Plays Log'!B:B, A44)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A44), \"yyyy-mm-dd\"), \"Never\")", "https://boardgamegeek.com/boardgame/423177"],
    ["Sorry!", "Base Game", "Darren", 1, 2, 4, "3, 4", 30, 1.0, 4.92, "=COUNTIF('Plays Log'!B:B, A45)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A45), \"yyyy-mm-dd\"), \"Never\")", "https://boardgamegeek.com/boardgame/313121"],
    ["Spirit Island", "Base Game", "Darren", 1, 1, 4, "2", 120, 4.08, 8.34, "=COUNTIF('Plays Log'!B:B, A46)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A46), \"yyyy-mm-dd\"), \"Never\")", "https://boardgamegeek.com/boardgame/162886"],
    ["Splendor Duel", "Base Game", "Darren", 1, 2, 2, "2", 30, 2.04, 7.88, "=COUNTIF('Plays Log'!B:B, A47)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A47), \"yyyy-mm-dd\"), \"Never\")", "https://boardgamegeek.com/boardgame/364073"],
    ["Star Realms Academy", "Base Game", "Darren", 1, 2, 2, "2", 20, 1.5, 7.69, "=COUNTIF('Plays Log'!B:B, A48)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A48), \"yyyy-mm-dd\"), \"Never\")", "https://boardgamegeek.com/boardgame/407812"],
    ["Star Trek: Star Realms Core Set", "Base Game", "Darren", 1, 2, 4, "2", 20, 2.0, 7.28, "=COUNTIF('Plays Log'!B:B, A49)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A49), \"yyyy-mm-dd\"), \"Never\")", "https://boardgamegeek.com/boardgame/422345"],
    ["Star Wars Villainous: Cold Tactics", "Base Game", "Darren", 1, 2, 2, "2-2", 50, 2.5, 7.43, "=COUNTIF('Plays Log'!B:B, A50)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A50), \"yyyy-mm-dd\"), \"Never\")", "https://boardgamegeek.com/boardgame/447381"],
    ["Star Wars Villainous: Power of the Dark Side", "Base Game", "Darren", 1, 2, 4, "2", 50, 2.57, 6.99, "=COUNTIF('Plays Log'!B:B, A51)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A51), \"yyyy-mm-dd\"), \"Never\")", "https://boardgamegeek.com/boardgame/358800"],
    ["Star Wars Villainous: Scum and Villainy", "Base Game", "Darren", 1, 2, 3, "3", 50, 2.67, 7.52, "=COUNTIF('Plays Log'!B:B, A52)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A52), \"yyyy-mm-dd\"), \"Never\")", "https://boardgamegeek.com/boardgame/387836"],
    ["Star Wars: Battle of Hoth", "Base Game", "Darren", 1, 2, 4, "2", 30, 1.91, 7.9, "=COUNTIF('Plays Log'!B:B, A53)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A53), \"yyyy-mm-dd\"), \"Never\")", "https://boardgamegeek.com/boardgame/444481"],
    ["Star Wars: Bounty Hunters", "Base Game", "Darren", 1, 2, 6, "4", 20, 1.35, 6.56, "=COUNTIF('Plays Log'!B:B, A54)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A54), \"yyyy-mm-dd\"), \"Never\")", "https://boardgamegeek.com/boardgame/410655"],
    ["Star Wars: Imperial Assault", "Base Game", "Darren", 1, 2, 5, "2, 5", 120, 3.3, 7.95, "=COUNTIF('Plays Log'!B:B, A55)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A55), \"yyyy-mm-dd\"), \"Never\")", "https://boardgamegeek.com/boardgame/164153"],
    ["Star Wars: Outer Rim", "Base Game", "Darren", 1, 1, 4, "3", 180, 2.6, 7.75, "=COUNTIF('Plays Log'!B:B, A56)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A56), \"yyyy-mm-dd\"), \"Never\")", "https://boardgamegeek.com/boardgame/271896"],
    ["Star Wars: Outer Rim – Unfinished Business", "Expansion", "Darren", 1, 1, 4, "3", 180, 2.8, 8.57, "=COUNTIF('Plays Log'!B:B, A57)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A57), \"yyyy-mm-dd\"), \"Never\")", "https://boardgamegeek.com/boardgame/347102"],
    ["Star Wars: Rebellion", "Base Game", "Darren", 1, 2, 4, "2", 240, 3.75, 8.42, "=COUNTIF('Plays Log'!B:B, A58)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A58), \"yyyy-mm-dd\"), \"Never\")", "https://boardgamegeek.com/boardgame/187645"],
    ["Star Wars: The Deckbuilding Game", "Base Game", "Darren", 1, 2, 2, "2", 90, 2.05, 7.82, "=COUNTIF('Plays Log'!B:B, A59)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A59), \"yyyy-mm-dd\"), \"Never\")", "https://boardgamegeek.com/boardgame/374173"],
    ["Star Wars: The Deckbuilding Game – Mandalorian Faction Pack", "Expansion", "Darren", 1, 2, 3, "2", 30, 2.0, 8.33, "=COUNTIF('Plays Log'!B:B, A60)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A60), \"yyyy-mm-dd\"), \"Never\")", "https://boardgamegeek.com/boardgame/453918"],
    ["Star Wars: Unlimited – Intro Battle: Hoth", "Base Game", "Darren", 1, 2, 2, "2", 20, 2.0, 7.42, "=COUNTIF('Plays Log'!B:B, A61)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A61), \"yyyy-mm-dd\"), \"Never\")", "https://boardgamegeek.com/boardgame/452742"],
    ["Star Wars: Unlimited – Shadows of the Galaxy", "Expansion", "Darren", 1, 2, 4, "2, 4", 20, 3.0, 8.03, "=COUNTIF('Plays Log'!B:B, A62)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A62), \"yyyy-mm-dd\"), \"Never\")", "https://boardgamegeek.com/boardgame/419398"],
    ["Star Wars: X-Wing (Second Edition)", "Base Game", "Darren", 1, 2, 2, "2", 45, 3.11, 8.01, "=COUNTIF('Plays Log'!B:B, A63)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A63), \"yyyy-mm-dd\"), \"Never\")", "https://boardgamegeek.com/boardgame/252328"],
    ["Star Wars: X-Wing (Second Edition) – Millennium Falcon Expansion Pack", "Expansion", "Darren", 1, 2, 2, "2-2", 45, 0.0, 8.06, "=COUNTIF('Plays Log'!B:B, A64)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A64), \"yyyy-mm-dd\"), \"Never\")", "https://boardgamegeek.com/boardgame/271918"],
    ["Star Wars: X-Wing (Second Edition) – T-65 X-Wing Expansion Pack", "Expansion", "Darren", 1, 2, 2, "2-2", 45, 0.0, 7.91, "=COUNTIF('Plays Log'!B:B, A65)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A65), \"yyyy-mm-dd\"), \"Never\")", "https://boardgamegeek.com/boardgame/252507"],
    ["Star Wars: X-Wing (Second Edition) – YT-2400 Light Freighter Expansion Pack", "Expansion", "Darren", 1, 2, 2, "2-2", 60, 0.0, 8.28, "=COUNTIF('Plays Log'!B:B, A66)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A66), \"yyyy-mm-dd\"), \"Never\")", "https://boardgamegeek.com/boardgame/401485"],
    ["Taco Cat Goat Cheese Pizza", "Base Game", "Darren", 1, 2, 8, "4, 5, 6", 30, 1.03, 6.45, "=COUNTIF('Plays Log'!B:B, A67)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A67), \"yyyy-mm-dd\"), \"Never\")", "https://boardgamegeek.com/boardgame/253664"],
    ["Tetris", "Base Game", "Darren", 1, 2, 4, "3, 4", 30, 1.47, 6.39, "=COUNTIF('Plays Log'!B:B, A68)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A68), \"yyyy-mm-dd\"), \"Never\")", "https://boardgamegeek.com/boardgame/342016"],
    ["The Bears and the Bees", "Base Game", "Darren", 1, 2, 5, "4", 30, 1.3, 6.73, "=COUNTIF('Plays Log'!B:B, A69)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A69), \"yyyy-mm-dd\"), \"Never\")", "https://boardgamegeek.com/boardgame/257372"],
    ["The Crew: Family Adventure", "Base Game", "Darren", 1, 3, 5, "4", 20, 1.8, 5.96, "=COUNTIF('Plays Log'!B:B, A70)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A70), \"yyyy-mm-dd\"), \"Never\")", "https://boardgamegeek.com/boardgame/406299"],
    ["The Crew: The Quest for Planet Nine", "Base Game", "Darren", 1, 2, 5, "4", 20, 1.97, 7.75, "=COUNTIF('Plays Log'!B:B, A71)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A71), \"yyyy-mm-dd\"), \"Never\")", "https://boardgamegeek.com/boardgame/284083"],
    ["The Game of Life: Super Mario Edition", "Base Game", "Darren", 1, 2, 4, "4", 120, 1.4, 6.25, "=COUNTIF('Plays Log'!B:B, A72)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A72), \"yyyy-mm-dd\"), \"Never\")", "https://boardgamegeek.com/boardgame/346143"],
    ["The Reckoners", "Base Game", "Darren", 1, 1, 6, "4", 100, 2.72, 7.64, "=COUNTIF('Plays Log'!B:B, A73)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A73), \"yyyy-mm-dd\"), \"Never\")", "https://boardgamegeek.com/boardgame/208024"],
    ["Ticket to Ride", "Base Game", "Darren", 1, 2, 5, "4", 60, 1.82, 7.38, "=COUNTIF('Plays Log'!B:B, A74)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A74), \"yyyy-mm-dd\"), \"Never\")", "https://boardgamegeek.com/boardgame/9209"],
    ["Ticket to Ride: First Journey (U.S.)", "Base Game", "Darren", 1, 2, 4, "3, 4", 30, 1.37, 6.84, "=COUNTIF('Plays Log'!B:B, A75)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A75), \"yyyy-mm-dd\"), \"Never\")", "https://boardgamegeek.com/boardgame/205125"],
    ["Twilight Imperium: Fourth Edition", "Base Game", "Darren", 1, 3, 6, "6", 480, 4.37, 8.56, "=COUNTIF('Plays Log'!B:B, A76)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A76), \"yyyy-mm-dd\"), \"Never\")", "https://boardgamegeek.com/boardgame/233078"],
    ["Unlock! Kids: Detective Stories", "Base Game", "Darren", 1, 1, 4, "2", 60, 1.53, 7.64, "=COUNTIF('Plays Log'!B:B, A77)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A77), \"yyyy-mm-dd\"), \"Never\")", "https://boardgamegeek.com/boardgame/327056"],
    ["Wingspan", "Base Game", "Darren", 1, 1, 5, "3", 70, 2.48, 7.99, "=COUNTIF('Plays Log'!B:B, A78)", "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A78), \"yyyy-mm-dd\"), \"Never\")", "https://boardgamegeek.com/boardgame/266192"]
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
    ["2026-09-26", "Star Wars: The Deckbuilding Game", "Darren, Guest", 2, "Darren", 45, "Close battle in the Outer Rim", "Yes"],
    ["2026-09-12", "Nemesis", "Darren, Alex, Mike, Sam", 4, "Intruders", 150, "Ship self-destruct sequence activated!", "Yes"],
    ["2026-08-29", "Heat: Pedal to the Metal", "Darren, Alex, Chris, Dave", 4, "Alex", 65, "USA track with championship cards", "Yes"]
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
function addGameToLibrary(title, type, owners, copies, minP, maxP, bestP, timeM, weight, rating, bggUrl) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const libSheet = ss.getSheetByName("Library");
  if (!libSheet) return;

  const nextRow = libSheet.getLastRow() + 1;
  const fPlays = "=COUNTIF('Plays Log'!B:B, A" + nextRow + ")";
  const fLast = "=IFERROR(TEXT(MAXIFS('Plays Log'!A:A, 'Plays Log'!B:B, A" + nextRow + "), \"yyyy-mm-dd\"), \"Never\")";

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

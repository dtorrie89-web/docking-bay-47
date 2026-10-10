# 🪐 Docking Bay 94 Game Night Hub

A complete hosting, library management, and voting toolkit for bi-weekly board game nights.

---

## 🚀 Quick Start

### 1. Open the Interactive Web App
Double-click **`index.html`** in your browser.
* **Passcode Gate**: Protected by default group passcode (`gamenight`). You can bypass it with `?key=gamenight` in the URL for instant 1-click access.
* **Filter by Headcount**: Click **4 Players**, **5 Players**, **6 Players**, or **8+ Players** to instantly view games suited for tonight's group size.
* **Filter by Complexity**: Mid-weight Strategy (2.2 – 3.2), Heavy Euro (3.2 – 4.2), or Brain Burners.
* **Duration Filters**: Quick (<60m), Standard (60–120m), or Long/Campaign (120m+).
* **Search**: Search across game titles instantly.

---

## 🗳️ Weekly Voting & Google Chat Polls

1. Check your confirmed headcount for the upcoming game night.
2. Select your player count chip in `index.html` (e.g., **4 Players**).
3. Choose your candidate games:
   * Click **`+ Add to Poll`** on any 2–4 game cards, **OR**
   * Click **`Shuffle 3 Random`** in the bar above the cards.
4. Click **`Google Chat Poll`** (located right in the top navigation bar or stats bar).
5. Click **`Copy to Clipboard`**.
6. Paste directly into your Google Chat group. Your friends can vote using emoji reactions (`1️⃣`, `2️⃣`, `3️⃣`)!

---

## 📚 Adding Everyone's BGG Collections

Due to BGG's recent API security update (requiring registered API tokens), you have two quick ways to sync everyone's library:

### Method A: One-Click CSV Import (Fastest & Easiest)
1. Anyone in the group goes to their BGG collection:
   * [https://boardgamegeek.com/collection/user/Dtorrie89](https://boardgamegeek.com/collection/user/Dtorrie89)
2. Click **Export to CSV** (top right of the table).
3. Either:
   * Click **`📥 Import BGG CSV`** inside `index.html` and upload the file, **OR**
   * Put the CSV file in this folder and run:
     ```bash
     python3 import_bgg_csv.py Dtorrie89_collection.csv --owner Darren
     ```
   * The script merges all games, links multiple owners for duplicates, and updates both `data/games.json` and `data/games.csv`.

### Method B: Automated API Sync
If you prefer fully automated syncing via script:
1. Register a free non-commercial application at [BoardGameGeek Applications](https://boardgamegeek.com/applications).
2. Generate your Bearer API token.
3. Add it to `config.json`:
   ```json
   {
     "bgg_api_token": "YOUR_BGG_TOKEN_HERE"
   }
   ```
4. Run:
   ```bash
   python3 sync_bgg.py
   ```

---

## 📅 Adding to Your Google Calendar Invite

In your recurring bi-weekly Google Calendar invite description, add:

```text
👑 Bi-Weekly Board Game Night!
Time: Every other week @ 7:00 PM

📋 Game Library & Poll Catalog:
[Insert link to your shared Google Drive folder, Google Sheet, or GitHub Pages]

📊 Master Game Spreadsheet (Filtered by Player Count & Weight):
[Insert link to data/games.csv uploaded to Google Sheets]

Please RSVP by Wednesday so we can shortlist games for the headcount!
```

---

## 📁 File Structure

* **`index.html`**: The interactive visual web app (run in any browser).
* **`data/games.json`**: Unified catalog with ratings, weights, player counts, mechanics, and owners.
* **`data/games.csv`**: Clean spreadsheet ready for Google Sheets import or direct viewing.
* **`members.json`**: List of group members and their BGG usernames.
* **`import_bgg_csv.py`**: Merges CSV exports from group members into the catalog.
* **`sync_bgg.py`**: Automated API sync tool.

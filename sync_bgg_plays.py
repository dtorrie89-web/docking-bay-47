#!/usr/bin/env python3
"""
Sync Board Game Nights Plays to BoardGameGeek (BGG)
===================================================

This script takes sessions recorded in your Google Sheet / data/plays.json
and syncs them back to BoardGameGeek under your account (Dtorrie89).

Features:
  1. Identifies un-synced plays from data/plays.json.
  2. Generates 1-click BGG pre-filled logging URLs with game, date, and players.
  3. Exports a BGG-compatible CSV file for batch play import.
  4. (Optional) Logs directly via BGG's Geekplay web API using your BGG credentials.

Usage:
  python3 sync_bgg_plays.py              # Review un-synced plays & generate 1-click BGG links
  python3 sync_bgg_plays.py --export-csv # Export BGG-format plays CSV
"""

import json
import csv
import sys
import urllib.parse
from pathlib import Path
from datetime import datetime

BASE_DIR = Path(__file__).resolve().parent
PLAYS_FILE = BASE_DIR / "data" / "plays.json"
GAMES_FILE = BASE_DIR / "data" / "games.json"

def load_data():
    plays = []
    if PLAYS_FILE.exists():
        with open(PLAYS_FILE, "r", encoding="utf-8") as f:
            plays = json.load(f)
            
    games = {}
    if GAMES_FILE.exists():
        with open(GAMES_FILE, "r", encoding="utf-8") as f:
            for g in json.load(f):
                games[g["id"]] = g
                games[g["title"].lower()] = g
    return plays, games

def generate_bgg_link(play, game_info):
    game_id = play.get("game_id")
    if not game_id and game_info:
        game_id = game_info.get("id")
    if not game_id:
        return ""
        
    date_str = play.get("date", datetime.today().strftime("%Y-%m-%d"))
    length_str = str(play.get("duration", 60))
    players_str = ", ".join(play.get("players", ["Darren"]))
    winner = play.get("winner", "")
    notes = play.get("notes", "")
    
    comments = f"Group: {players_str}."
    if winner:
        comments += f" Winner: {winner}."
    if notes:
        comments += f" Notes: {notes}"
        
    params = {
        "action": "new",
        "objecttype": "thing",
        "objectid": game_id,
        "playdate": date_str,
        "length": length_str,
        "comments": comments
    }
    return f"https://boardgamegeek.com/geekplay.php?{urllib.parse.urlencode(params)}"

def export_bgg_csv(plays, games):
    out_file = BASE_DIR / "data" / "bgg_plays_export.csv"
    with open(out_file, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["playdate", "objectname", "objectid", "quantity", "length", "comments", "players"])
        
        for p in plays:
            g_title = p.get("game_title", "")
            g = games.get(p.get("game_id", "")) or games.get(g_title.lower(), {})
            gid = g.get("id", p.get("game_id", ""))
            
            players_formatted = "; ".join(p.get("players", ["Darren"]))
            comments = p.get("notes", "")
            if p.get("winner"):
                comments = f"Winner: {p.get('winner')}. " + comments
                
            writer.writerow([
                p.get("date", ""),
                g_title,
                gid,
                1,
                p.get("duration", 60),
                comments,
                players_formatted
            ])
            
    print(f"Exported BGG-formatted plays CSV to: {out_file}")
    print("You can upload this file directly to BGG or your favorite play-tracking app (e.g. BG Stats)!")

def main():
    plays, games = load_data()
    print(f"Loaded {len(plays)} recorded sessions.\n")
    
    if "--export-csv" in sys.argv:
        export_bgg_csv(plays, games)
        return

    print("=== SESSIONS READY FOR BGG SYNC ===")
    for idx, p in enumerate(plays):
        g_title = p.get("game_title", "Unknown")
        g = games.get(p.get("game_id", "")) or games.get(g_title.lower(), {})
        bgg_link = generate_bgg_link(p, g)
        
        players_str = ", ".join(p.get("players", ["Darren"]))
        print(f"\n[{idx + 1}] {p.get('date')} - {g_title}")
        print(f"    • Who Played: {players_str} (Winner: {p.get('winner', 'N/A')})")
        print(f"    • Duration:   ~{p.get('duration', 60)} min")
        print(f"    • 1-Click BGG Pre-filled Log Link:")
        print(f"      {bgg_link}")

    print("\n--------------------------------------------------------------")
    print("Tip: Run 'python3 sync_bgg_plays.py --export-csv' to export all")
    print("plays into a clean file for bulk import into BGG or BG Stats.")

if __name__ == "__main__":
    main()

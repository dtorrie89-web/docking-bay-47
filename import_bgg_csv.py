#!/usr/bin/env python3
"""
Board Game Night - BGG CSV Importer
Imports BGG collection CSV exports (downloaded directly from BGG)
and merges them into data/games.json and data/games.csv.

Usage:
  python3 import_bgg_csv.py [path_to_csv] [--owner "Darren"]
If no file is specified, it scans the workspace for any *.csv files (excluding data/games.csv).
"""

import os
import sys
import json
import csv
import glob
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)

GAMES_JSON_PATH = DATA_DIR / "games.json"
GAMES_CSV_PATH = DATA_DIR / "games.csv"

def load_existing_games():
    if GAMES_JSON_PATH.exists():
        try:
            with open(GAMES_JSON_PATH, "r", encoding="utf-8") as f:
                return {g["id"]: g for g in json.load(f)}
        except Exception:
            pass
    return {}

def parse_bgg_csv(file_path, default_owner="Darren"):
    """Parse a CSV exported from BoardGameGeek."""
    imported_games = []
    
    with open(file_path, "r", encoding="utf-8", errors="replace") as f:
        reader = csv.DictReader(f)
        for row in reader:
            # Check ownership (BGG CSV often has 'own' column with 1 or 0)
            own_val = row.get("own", "1")
            if own_val == "0":
                continue
                
            game_id = row.get("objectid") or row.get("collid") or row.get("id") or ""
            title = row.get("objectname") or row.get("name") or row.get("Title") or ""
            if not title:
                continue
                
            # If no game_id, use a slugified title
            if not game_id:
                game_id = title.lower().replace(" ", "-")
                
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
                    
            min_players = to_int(row.get("minplayers"))
            max_players = to_int(row.get("maxplayers"))
            playing_time = to_int(row.get("playingtime"))
            min_playtime = to_int(row.get("minplaytime") or playing_time)
            max_playtime = to_int(row.get("maxplaytime") or playing_time)
            year = to_int(row.get("yearpublished")) or None
            
            # Weight / complexity
            weight = to_float(row.get("bggweight") or row.get("weight") or row.get("averageweight"))
            rating = to_float(row.get("average") or row.get("bggrecvalue") or row.get("rating"))
            rank_val = to_int(row.get("rank"))
            rank = rank_val if rank_val > 0 else None
            
            # Best players
            best_players_raw = row.get("bggbestplayers") or row.get("best_players") or ""
            best_players = [p.strip() for p in best_players_raw.split(",") if p.strip()] if best_players_raw else []
            
            # Categories & Mechanics
            cats_raw = row.get("categories") or row.get("category") or ""
            categories = [c.strip() for c in cats_raw.split(",") if c.strip()] if cats_raw else []
            
            mechs_raw = row.get("mechanics") or row.get("mechanic") or ""
            mechanics = [m.strip() for m in mechs_raw.split(",") if m.strip()] if mechs_raw else []
            
            image = row.get("image") or ""
            thumbnail = row.get("thumbnail") or ""
            
            imported_games.append({
                "id": str(game_id),
                "title": title,
                "year": year,
                "image": image,
                "thumbnail": thumbnail,
                "min_players": min_players,
                "max_players": max_players,
                "min_playtime": min_playtime,
                "max_playtime": max_playtime,
                "playtime": playing_time or max_playtime,
                "rating": rating,
                "weight": weight,
                "rank": rank,
                "owners": [default_owner],
                "categories": categories,
                "mechanics": mechanics,
                "best_players": best_players,
                "recommended_players": [],
                "description": row.get("comment") or row.get("description") or ""
            })
            
    return imported_games

def save_catalog(combined_games):
    sorted_games = sorted(combined_games.values(), key=lambda x: x["title"].lower())
    
    # Write JSON
    with open(GAMES_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(sorted_games, f, indent=2, ensure_ascii=False)
        
    # Write CSV for Google Sheets
    with open(GAMES_CSV_PATH, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow([
            "Title",
            "Owners",
            "Min Players",
            "Max Players",
            "Best Player Count",
            "Min Time (min)",
            "Max Time (min)",
            "Play Time (min)",
            "Weight (1.0-5.0)",
            "Weight Class",
            "BGG Rating",
            "BGG Rank",
            "Categories",
            "Mechanics",
            "BGG URL"
        ])
        
        for g in sorted_games:
            w = g["weight"]
            if w <= 0:
                weight_class = "Unrated"
            elif w < 2.2:
                weight_class = "Light / Casual"
            elif w < 3.2:
                weight_class = "Mid-weight Strategy"
            elif w < 4.0:
                weight_class = "Heavy Euro"
            else:
                weight_class = "Very Heavy / Complex"
                
            best_str = ", ".join(g.get("best_players", []))
            owners_str = ", ".join(g.get("owners", []))
            cats_str = ", ".join(g.get("categories", []))
            mechs_str = ", ".join(g.get("mechanics", []))
            bgg_url = f"https://boardgamegeek.com/boardgame/{g['id']}" if g['id'].isdigit() else ""
            
            writer.writerow([
                g["title"],
                owners_str,
                g["min_players"],
                g["max_players"],
                best_str,
                g["min_playtime"],
                g["max_playtime"],
                g["playtime"],
                g["weight"],
                weight_class,
                g["rating"],
                g.get("rank") or "",
                cats_str,
                mechs_str,
                bgg_url
            ])
            
    print(f"\nCatalog updated successfully!")
    print(f" - JSON: {GAMES_JSON_PATH}")
    print(f" - Google Sheets CSV: {GAMES_CSV_PATH}")
    print(f" - Total Unique Games: {len(sorted_games)}")

def main():
    existing_games = load_existing_games()
    
    # Check command line arguments
    target_csv = None
    owner_name = "Darren"
    
    args = sys.argv[1:]
    i = 0
    while i < len(args):
        if args[i] == "--owner" and i + 1 < len(args):
            owner_name = args[i + 1]
            i += 2
        elif not target_csv and not args[i].startswith("--"):
            target_csv = args[i]
            i += 1
        else:
            i += 1
            
    csv_files = []
    if target_csv:
        csv_files.append((Path(target_csv), owner_name))
    else:
        # Scan current directory for CSVs
        for f in BASE_DIR.glob("*.csv"):
            if f.name not in ["games.csv"]:
                # Try inferring owner from filename (e.g. "Darren_collection.csv")
                name_part = f.stem.replace("_collection", "").replace("-collection", "").capitalize()
                csv_files.append((f, name_part or owner_name))
                
    if not csv_files:
        print("No CSV files found to import.")
        print("To import:")
        print(" 1. Export your collection from BGG: Go to BGG -> Collection -> Export to CSV")
        print(" 2. Place the CSV file in this folder or run: python3 import_bgg_csv.py path/to/file.csv --owner Darren")
        return
        
    for file_path, owner in csv_files:
        print(f"Importing {file_path.name} for owner '{owner}'...")
        games = parse_bgg_csv(file_path, default_owner=owner)
        print(f"  Parsed {len(games)} games from {file_path.name}")
        
        for g in games:
            gid = g["id"]
            if gid in existing_games:
                if owner not in existing_games[gid]["owners"]:
                    existing_games[gid]["owners"].append(owner)
            else:
                existing_games[gid] = g
                
    save_catalog(existing_games)

if __name__ == "__main__":
    main()

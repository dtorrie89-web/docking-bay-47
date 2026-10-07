#!/usr/bin/env python3
"""
Board Game Night - BGG Collection Aggregator
Fetches owned games for group members from BoardGameGeek XML API2,
deduplicates and enriches with player counts, categories, mechanics, and complexity,
and exports to data/games.json and data/games.csv.
"""

import os
import sys
import json
import csv
import time
import urllib.request
import urllib.error
import xml.etree.ElementTree as ET
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
MEMBERS_FILE = BASE_DIR / "members.json"
DATA_DIR = BASE_DIR / "data"
CACHE_DIR = BASE_DIR / "cache"

DATA_DIR.mkdir(exist_ok=True)
CACHE_DIR.mkdir(exist_ok=True)

USER_AGENT = "BoardGameNightPlanner/1.0 (contact: dtorrie89@gmail.com)"
BGG_COLLECTION_URL = "https://boardgamegeek.com/xmlapi2/collection?username={username}&own=1&stats=1"
BGG_THING_URL = "https://boardgamegeek.com/xmlapi2/thing?id={ids}&stats=1"

# Check config.json or environment variable for BGG API token
CONFIG_FILE = BASE_DIR / "config.json"
API_TOKEN = os.environ.get("BGG_API_TOKEN", "")
if not API_TOKEN and CONFIG_FILE.exists():
    try:
        with open(CONFIG_FILE, "r", encoding="utf-8") as f:
            cfg = json.load(f)
            API_TOKEN = cfg.get("bgg_api_token", "")
    except Exception:
        pass

def get_headers():
    headers = {"User-Agent": USER_AGENT}
    if API_TOKEN:
        headers["Authorization"] = f"Bearer {API_TOKEN}"
    return headers

def fetch_url(url, max_retries=6, delay=4):
    """Fetch URL with retries for BGG 202 (queued request) and rate limits."""
    headers = get_headers()
    req = urllib.request.Request(url, headers=headers)
    
    for attempt in range(max_retries):
        try:
            with urllib.request.urlopen(req, timeout=20) as resp:
                if resp.status == 200:
                    data = resp.read()
                    # BGG sometimes returns 200 with a "Please try again later" message
                    if b"Please try again later for this item" in data or b"Your request for this collection has been accepted" in data:
                        print(f"  [BGG] Request queued, waiting {delay}s (attempt {attempt+1}/{max_retries})...")
                        time.sleep(delay)
                        continue
                    return data
                elif resp.status == 202:
                    print(f"  [BGG] Status 202 Accepted (processing), waiting {delay}s (attempt {attempt+1}/{max_retries})...")
                    time.sleep(delay)
                else:
                    print(f"  [BGG] Unexpected status {resp.status}, retrying in {delay}s...")
                    time.sleep(delay)
        except urllib.error.HTTPError as e:
            if e.code == 202:
                print(f"  [BGG] Status 202 Accepted (processing), waiting {delay}s (attempt {attempt+1}/{max_retries})...")
                time.sleep(delay)
            elif e.code == 429:
                print(f"  [BGG] Rate limited (429), backing off for {delay * 2}s...")
                time.sleep(delay * 2)
            else:
                print(f"  [BGG] HTTP Error {e.code}: {e.reason}")
                time.sleep(delay)
        except Exception as e:
            print(f"  [BGG] Request error: {e}, retrying in {delay}s...")
            time.sleep(delay)
            
    print(f"  [Error] Failed to fetch after {max_retries} attempts: {url}")
    return None

def parse_collection_xml(xml_bytes, member_name):
    """Parse BGG collection XML into a list of game items."""
    try:
        root = ET.fromstring(xml_bytes)
    except Exception as e:
        print(f"  [Error] Failed to parse collection XML: {e}")
        return []
    
    games = []
    for item in root.findall("item"):
        # Only process board games or expansions
        subtype = item.attrib.get("subtype", "boardgame")
        game_id = item.attrib.get("objectid")
        if not game_id:
            continue
            
        name_elem = item.find("name")
        name = name_elem.text if name_elem is not None else "Unknown"
        
        year_elem = item.find("yearpublished")
        year = int(year_elem.text) if year_elem is not None and year_elem.text and year_elem.text.isdigit() else None
        
        image_elem = item.find("image")
        image = image_elem.text if image_elem is not None else ""
        
        thumb_elem = item.find("thumbnail")
        thumbnail = thumb_elem.text if thumb_elem is not None else ""
        
        stats = item.find("stats")
        min_players = 0
        max_players = 0
        min_playtime = 0
        max_playtime = 0
        playtime = 0
        avg_rating = 0.0
        weight = 0.0
        bgg_rank = None
        
        if stats is not None:
            min_players = int(stats.attrib.get("minplayers", 0) or 0)
            max_players = int(stats.attrib.get("maxplayers", 0) or 0)
            min_playtime = int(stats.attrib.get("minplaytime", 0) or 0)
            max_playtime = int(stats.attrib.get("maxplaytime", 0) or 0)
            playtime = int(stats.attrib.get("playingtime", 0) or 0)
            
            rating = stats.find("rating")
            if rating is not None:
                avg_elem = rating.find("average")
                if avg_elem is not None and avg_elem.attrib.get("value"):
                    try:
                        avg_rating = round(float(avg_elem.attrib["value"]), 1)
                    except ValueError:
                        pass
                
                weight_elem = rating.find("averageweight")
                if weight_elem is not None and weight_elem.attrib.get("value"):
                    try:
                        weight = round(float(weight_elem.attrib["value"]), 2)
                    except ValueError:
                        pass
                        
                ranks = rating.find("ranks")
                if ranks is not None:
                    for rank in ranks.findall("rank"):
                        if rank.attrib.get("type") == "subtype" and rank.attrib.get("name") == "boardgame":
                            val = rank.attrib.get("value")
                            if val and val.isdigit():
                                bgg_rank = int(val)
        
        games.append({
            "id": game_id,
            "title": name,
            "subtype": subtype,
            "year": year,
            "image": image,
            "thumbnail": thumbnail,
            "min_players": min_players,
            "max_players": max_players,
            "min_playtime": min_playtime,
            "max_playtime": max_playtime,
            "playtime": playtime,
            "rating": avg_rating,
            "weight": weight,
            "rank": bgg_rank,
            "owners": [member_name],
            "categories": [],
            "mechanics": [],
            "best_players": [],
            "recommended_players": []
        })
        
    return games

def fetch_thing_details(game_ids):
    """Fetch categories, mechanics, and suggested player count polls for a batch of game IDs."""
    cache_file = CACHE_DIR / "thing_details.json"
    cached = {}
    if cache_file.exists():
        try:
            with open(cache_file, "r", encoding="utf-8") as f:
                cached = json.load(f)
        except Exception:
            cached = {}
            
    needed_ids = [gid for gid in game_ids if gid not in cached]
    if needed_ids:
        print(f"Fetching extended metadata (categories, mechanics, player polls) for {len(needed_ids)} games...")
        # BGG allows batching up to 20 IDs
        batch_size = 20
        for i in range(0, len(needed_ids), batch_size):
            batch = needed_ids[i:i+batch_size]
            url = BGG_THING_URL.format(ids=",".join(batch))
            print(f"  Fetching batch {i//batch_size + 1}/{(len(needed_ids)-1)//batch_size + 1} ({len(batch)} games)...")
            xml_data = fetch_url(url, delay=3)
            if not xml_data:
                continue
                
            try:
                root = ET.fromstring(xml_data)
                for item in root.findall("item"):
                    gid = item.attrib.get("id")
                    if not gid:
                        continue
                        
                    cats = [link.attrib.get("value") for link in item.findall("link") if link.attrib.get("type") == "boardgamecategory"]
                    mechs = [link.attrib.get("value") for link in item.findall("link") if link.attrib.get("type") == "boardgamemechanic"]
                    
                    # Parse suggested_numplayers poll
                    best_players = []
                    rec_players = []
                    for poll in item.findall("poll"):
                        if poll.attrib.get("name") == "suggested_numplayers":
                            for results in poll.findall("results"):
                                numplayers = results.attrib.get("numplayers")
                                votes = {res.attrib.get("value"): int(res.attrib.get("numvotes", 0)) for res in results.findall("result")}
                                best_v = votes.get("Best", 0)
                                rec_v = votes.get("Recommended", 0)
                                not_rec_v = votes.get("Not Recommended", 0)
                                
                                if best_v > 0 and best_v >= rec_v and best_v > not_rec_v:
                                    best_players.append(numplayers)
                                elif (best_v + rec_v) > not_rec_v and (best_v + rec_v) > 3:
                                    rec_players.append(numplayers)
                                    
                    desc_elem = item.find("description")
                    description = desc_elem.text if desc_elem is not None else ""
                    # Clean up HTML entities in description
                    if description:
                        description = description.replace("&#10;", "\n").replace("&quot;", '"').replace("&amp;", '&')
                    
                    cached[gid] = {
                        "categories": cats,
                        "mechanics": mechs,
                        "best_players": best_players,
                        "recommended_players": rec_players,
                        "description": description[:600] + "..." if len(description) > 600 else description
                    }
            except Exception as e:
                print(f"  [Error] Failed parsing thing batch: {e}")
                
            time.sleep(1.5)  # Respect BGG rate limits
            
        with open(cache_file, "w", encoding="utf-8") as f:
            json.dump(cached, f, indent=2, ensure_ascii=False)
            
    return cached

def main():
    if not MEMBERS_FILE.exists():
        print(f"Error: {MEMBERS_FILE} not found. Please create it first.")
        sys.exit(1)
        
    with open(MEMBERS_FILE, "r", encoding="utf-8") as f:
        members = json.load(f)
        
    print(f"Found {len(members)} member(s) to sync:")
    for m in members:
        print(f" - {m.get('name')} (BGG: {m.get('bgg_username')})")
        
    combined_games = {}
    
    for member in members:
        username = member.get("bgg_username", "").strip()
        name = member.get("name", username).strip()
        if not username:
            continue
            
        print(f"\nFetching collection for {name} ({username})...")
        url = BGG_COLLECTION_URL.format(username=username)
        xml_data = fetch_url(url)
        if not xml_data:
            print(f"Could not load collection for {username}.")
            continue
            
        games = parse_collection_xml(xml_data, name)
        print(f"Found {len(games)} owned games for {name}.")
        
        for g in games:
            gid = g["id"]
            if gid in combined_games:
                if name not in combined_games[gid]["owners"]:
                    combined_games[gid]["owners"].append(name)
            else:
                combined_games[gid] = g
                
    total_unique = len(combined_games)
    print(f"\nTotal unique games in group library: {total_unique}")
    
    if total_unique == 0:
        print("No games retrieved. Please check usernames or BGG network access.")
        sys.exit(0)
        
    # Enrich with thing details (categories, mechanics, community polls)
    thing_details = fetch_thing_details(list(combined_games.keys()))
    for gid, g in combined_games.items():
        if gid in thing_details:
            details = thing_details[gid]
            g["categories"] = details.get("categories", [])
            g["mechanics"] = details.get("mechanics", [])
            g["best_players"] = details.get("best_players", [])
            g["recommended_players"] = details.get("recommended_players", [])
            g["description"] = details.get("description", "")
            
    # Sort alphabetically by title
    sorted_games = sorted(combined_games.values(), key=lambda x: x["title"].lower())
    
    # Save games.json
    games_json_path = DATA_DIR / "games.json"
    with open(games_json_path, "w", encoding="utf-8") as f:
        json.dump(sorted_games, f, indent=2, ensure_ascii=False)
    print(f"Saved JSON catalog to: {games_json_path}")
    
    # Save games.csv (formatted nicely for Google Sheets)
    games_csv_path = DATA_DIR / "games.csv"
    with open(games_csv_path, "w", newline="", encoding="utf-8") as f:
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
                
            best_str = ", ".join(g["best_players"]) if g["best_players"] else ""
            owners_str = ", ".join(g["owners"])
            cats_str = ", ".join(g["categories"])
            mechs_str = ", ".join(g["mechanics"])
            bgg_url = f"https://boardgamegeek.com/boardgame/{g['id']}"
            
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
                g["rank"] or "",
                cats_str,
                mechs_str,
                bgg_url
            ])
            
    print(f"Saved Google Sheets CSV export to: {games_csv_path}")
    print("\nSync completed successfully!")

if __name__ == "__main__":
    main()

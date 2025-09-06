import csv
import json
import shutil
import datetime
import difflib
from pathlib import Path

ROOT = Path(r"c:\Users\james\Documents\NMA APP\memorials-app")
CSV_PATH = ROOT / "memorials.csv"
JSON_PATH = ROOT / "data" / "memorials.json"

def normalize(s):
    return (s or "").strip()

def find_entry_index_by_name(name, name_to_index):
    key = name.lower().strip()
    if key in name_to_index:
        return name_to_index[key]
    # fuzzy match
    names = list(name_to_index.keys())
    matches = difflib.get_close_matches(key, names, n=1, cutoff=0.9)
    if matches:
        return name_to_index[matches[0]]
    return None

def main():
    if not CSV_PATH.exists():
        print(f"CSV not found: {CSV_PATH}")
        return
    if not JSON_PATH.exists():
        print(f"JSON not found: {JSON_PATH}")
        return

    # load json
    with JSON_PATH.open("r", encoding="utf-8") as f:
        data = json.load(f)

    if not isinstance(data, list):
        print("Unexpected JSON structure: expecting top-level list")
        return

    # build name->index map
    name_to_index = {}
    for i, item in enumerate(data):
        name = normalize(item.get("name") or item.get("title") or "")
        if name:
            name_to_index[name.lower()] = i

    # backup
    ts = datetime.datetime.now().strftime("%Y%m%d%H%M%S")
    backup_path = JSON_PATH.with_suffix(f".backup.{ts}.json")
    shutil.copy2(JSON_PATH, backup_path)
    print(f"Backup written to: {backup_path}")

    processed = 0
    updated = 0
    created = 0
    unmatched = []

    with CSV_PATH.open(newline="", encoding="utf-8-sig") as csvfile:
        reader = csv.DictReader(csvfile)
        for row in reader:
            processed += 1
            csv_name = normalize(row.get("Memorial") or row.get("memorial") or "")
            csv_zone = normalize(row.get("Zone") or row.get("zone") or "")
            csv_text = normalize(row.get("Text") or row.get("text") or "")

            if not csv_name:
                continue

            idx = find_entry_index_by_name(csv_name, name_to_index)
            if idx is None:
                # create new entry
                new_entry = {
                    "name": csv_name,
                    "zone": csv_zone or "",
                    "description": csv_text or "",
                    "map": "",
                    "location": {}
                }
                data.append(new_entry)
                # record index and update map
                new_idx = len(data) - 1
                name_to_index[csv_name.lower()] = new_idx
                created += 1
                continue

            entry = data[idx]
            entry_zone = normalize(entry.get("zone", ""))
            entry_desc = normalize(entry.get("description", ""))

            changed = False
            if (not entry_zone) and csv_zone:
                entry["zone"] = csv_zone
                changed = True
            if (not entry_desc) and csv_text:
                entry["description"] = csv_text
                changed = True

            if changed:
                updated += 1

    # write back if any change
    if updated or created:
        with JSON_PATH.open("w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"Updated {updated} existing entries, created {created} new entries.")
    else:
        print("No updates or creations needed.")

    print(f"CSV rows processed: {processed}")

if __name__ == "__main__":
    main()
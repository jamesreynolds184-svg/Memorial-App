import csv
import json
import re
import shutil
import argparse
from pathlib import Path
from difflib import get_close_matches
from datetime import datetime

CSV_DEFAULT = Path("data") / "metadata_clean.csv"
JSON_DEFAULT = Path("data") / "memorials.json"
BACKUP_SUFFIX = datetime.now().strftime("%Y%m%d%H%M%S")

def normalize_name(s: str) -> str:
    if not s:
        return ""
    s = s.lower()
    # remove common file extensions and punctuation, collapse whitespace
    s = re.sub(r"\.(heic|jpg|jpeg|png|tif|tiff)$", "", s, flags=re.I)
    s = re.sub(r"[^\w\s]", " ", s)       # keep only letters/numbers/underscore/space
    s = re.sub(r"\s+", " ", s).strip()
    return s

def load_csv(path: Path):
    mapping = {}
    originals = {}
    with path.open(newline="", encoding="utf-8") as fh:
        rdr = csv.DictReader(fh)
        for row in rdr:
            name = (row.get("Name") or row.get("name") or "").strip()
            lat = row.get("Latitude") or row.get("latitude") or row.get("Lat") or ""
            lng = row.get("Longitude") or row.get("longitude") or row.get("Lon") or ""
            if not name:
                continue
            try:
                latf = float(lat) if lat != "" else None
                lngf = float(lng) if lng != "" else None
            except ValueError:
                latf = lngf = None
            key = normalize_name(name)
            mapping[key] = (latf, lngf)
            originals[key] = name
    return mapping, originals

def update_json(csv_map, csv_originals, json_path: Path, dry_run=False, fuzzy_cutoff=0.85):
    with json_path.open(encoding="utf-8") as fh:
        data = json.load(fh)

    if not isinstance(data, list):
        raise SystemExit("memorials.json root is not a list")

    csv_keys = list(csv_map.keys())

    matched = 0
    fuzzy_matched = 0
    updated_indices = []
    unmatched = []

    for i, obj in enumerate(data):
        name = obj.get("name") or obj.get("Name") or ""
        norm = normalize_name(name)
        latlng = None
        used_key = None

        if norm in csv_map:
            latlng = csv_map[norm]
            used_key = norm
        else:
            # try close match on normalized strings
            candidates = get_close_matches(norm, csv_keys, n=1, cutoff=fuzzy_cutoff)
            if candidates:
                used_key = candidates[0]
                latlng = csv_map[used_key]

        if latlng and latlng[0] is not None and latlng[1] is not None:
            matched += 1
            if used_key and used_key != norm:
                fuzzy_matched += 1
            if not dry_run:
                loc = obj.get("location")
                if loc is None or not isinstance(loc, dict):
                    obj["location"] = {}
                    loc = obj["location"]
                # set values
                loc["lat"] = latlng[0]
                loc["lng"] = latlng[1]
                # also set top-level lat/lng (some entries use this)
                obj["lat"] = latlng[0]
                obj["lng"] = latlng[1]
                updated_indices.append(i)
        else:
            unmatched.append(name)

    return data, matched, fuzzy_matched, unmatched, updated_indices

def main():
    p = argparse.ArgumentParser(description="Update memorials.json locations from metadata_clean.csv")
    p.add_argument("--csv", "-c", type=Path, default=CSV_DEFAULT, help="path to metadata CSV (default: data/metadata_clean.csv)")
    p.add_argument("--json", "-j", type=Path, default=JSON_DEFAULT, help="path to memorials.json (default: data/memorials.json)")
    p.add_argument("--dry-run", action="store_true", help="run without writing changes (prints summary)")
    p.add_argument("--cutoff", type=float, default=0.85, help="fuzzy match cutoff (0..1), default 0.85")
    args = p.parse_args()

    if not args.csv.exists():
        raise SystemExit(f"CSV not found: {args.csv}")
    if not args.json.exists():
        raise SystemExit(f"JSON not found: {args.json}")

    csv_map, csv_originals = load_csv(args.csv)

    new_data, matched, fuzzy_matched, unmatched, updated_indices = update_json(
        csv_map, csv_originals, args.json, dry_run=args.dry_run, fuzzy_cutoff=args.cutoff
    )

    print(f"Total matched entries updated: {matched} (fuzzy: {fuzzy_matched})")
    print(f"Total not matched: {len(unmatched)}")
    if len(unmatched) > 0:
        print("Examples of unmatched memorial names:")
        for n in unmatched[:10]:
            print("  -", n)

    if args.dry_run:
        print("Dry run: no file written.")
        return

    # backup original
    backup = args.json.with_suffix(args.json.suffix + f".bak.{BACKUP_SUFFIX}")
    shutil.copy2(args.json, backup)
    print(f"Backup written: {backup}")

    # write updated JSON
    with args.json.open("w", encoding="utf-8") as fh:
        json.dump(new_data, fh, ensure_ascii=False, indent=2)
    print(f"Updated JSON written: {args.json}")
    print(f"Entries updated (indices): {updated_indices[:20]}{'...' if len(updated_indices)>20 else ''}")

if __name__ == "__main__":
    main()
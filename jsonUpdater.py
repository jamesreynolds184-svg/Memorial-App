import csv, json, shutil, sys, re, argparse
from pathlib import Path

DEFAULT_JSON = Path("data/memorials.json")
DEFAULT_CSV  = Path("img/zone1/image_coordinates.csv")

def normalize(s: str) -> str:
    if not s: return ""
    s = s.strip()
    # Strip extension
    s = re.sub(r'\.(jpe?g|png|webp)$', '', s, flags=re.I)
    # Replace underscores & hyphens with space
    s = re.sub(r'[_-]+', ' ', s)
    # Collapse whitespace
    s = re.sub(r'\s+', ' ', s)
    # Remove enclosing quotes
    s = s.strip(' "\'')
    # Drop stray punctuation at end
    s = re.sub(r'[.,;:]+$', '', s)
    return s.lower()

def load_json(path: Path):
    try:
        text = path.read_text(encoding="utf-8")
        data = json.loads(text)
        if not isinstance(data, list):
            print("ERROR: Root JSON is not a list", file=sys.stderr)
            sys.exit(1)
        return data
    except Exception as e:
        print(f"ERROR: Failed to parse JSON: {e}", file=sys.stderr)
        sys.exit(1)

def build_index(memorials, verbose=False):
    idx = {}
    for m in memorials:
        if isinstance(m, dict) and m.get("name"):
            key = normalize(m["name"])
            if key:
                if key in idx and verbose:
                    print(f"WARN: Duplicate normalized name: {m['name']} (collides with {idx[key].get('name')})")
                idx.setdefault(key, m)
    return idx

def parse_args():
    ap = argparse.ArgumentParser(description="Update memorials.json with lat/lng from a CSV")
    ap.add_argument("--json", type=Path, default=DEFAULT_JSON, help="Path to memorials.json")
    ap.add_argument("--csv",  type=Path, default=DEFAULT_CSV, help="Path to coordinates CSV")
    ap.add_argument("--lat-col", default="DecimalLat")
    ap.add_argument("--lng-col", default="DecimalLng")
    ap.add_argument("--file-col", default="Filename")
    ap.add_argument("--backup-suffix", default=".backup.json")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--verbose", action="store_true")
    ap.add_argument("--show-path", action="store_true")
    return ap.parse_args()

def main():
    args = parse_args()
    if args.show_path:
        print("JSON absolute path:", args.json.resolve())
        print("CSV absolute path :", args.csv.resolve())
    if not args.json.exists():
        print("ERROR: JSON not found", file=sys.stderr); sys.exit(1)
    if not args.csv.exists():
        print("ERROR: CSV not found", file=sys.stderr); sys.exit(1)

    memorials = load_json(args.json)
    index = build_index(memorials, verbose=args.verbose)

    updated = 0
    skipped = 0
    unmatched = []
    changed_keys = set()

    with args.csv.open(newline='', encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        cols = reader.fieldnames or []
        if args.verbose:
            print("CSV columns:", cols)
        # Heuristic fallback if headers don’t match
            print(f"Using file={args.file-col} lat={args.lat-col} lng={args.lng-col}")
        for row_num, row in enumerate(reader, start=2):
            raw_name = (row.get(args.file_col) or "").strip()
            if not raw_name:
                continue
            norm = normalize(raw_name)
            lat_s = (row.get(args.lat_col) or "").strip()
            lng_s = (row.get(args.lng_col) or "").strip()
            try:
                lat = float(lat_s)
                lng = float(lng_s)
            except ValueError:
                if args.verbose:
                    print(f"Row {row_num}: invalid lat/lng '{lat_s}', '{lng_s}' for '{raw_name}'")
                continue

            m = index.get(norm)
            if not m:
                unmatched.append(raw_name)
                if args.verbose:
                    print(f"Row {row_num}: NO MATCH -> '{raw_name}' (norm='{norm}')")
                continue

            loc = m.setdefault("location", {})
            old_lat = loc.get("lat")
            old_lng = loc.get("lng")
            if old_lat == lat and old_lng == lng:
                skipped += 1
                if args.verbose:
                    print(f"Row {row_num}: unchanged '{raw_name}'")
                continue
            loc["lat"] = lat
            loc["lng"] = lng
            updated += 1
            changed_keys.add(norm)
            if args.verbose:
                print(f"Row {row_num}: updated '{raw_name}' ({old_lat},{old_lng})->({lat},{lng})")

    if updated or args.dry_run:
        backup_path = args.json.with_suffix(args.backup_suffix)
        if not args.dry_run:
            shutil.copyfile(args.json, backup_path)
            args.json.write_text(json.dumps(memorials, indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"Updated: {updated}")
        print(f"Unchanged (same coords): {skipped}")
        print(f"Unmatched: {len(unmatched)}")
        if unmatched:
            sample = unmatched[:25]
            print("Sample unmatched:", "; ".join(sample) + (" ..." if len(unmatched) > 25 else ""))
        print("Backup:", backup_path)
        if args.dry_run:
            print("Dry-run mode: no file written.")
    else:
        print("No changes detected (no matching rows or all identical)")

if __name__ == "__main__":
    main()
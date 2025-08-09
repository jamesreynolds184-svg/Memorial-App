import csv, json, shutil, sys, re, argparse, unicodedata
from pathlib import Path

DEFAULT_JSON = Path("data/memorials.json")
DEFAULT_CSV  = Path("img/zone1/image_coordinates.csv")

def normalize(s: str, keep_apostrophes=False) -> str:
    if not s: return ""
    # Unicode compatibility (turns fancy chars into basic ones where possible)
    s = unicodedata.normalize('NFKC', s)

    # Strip extension
    s = re.sub(r'\.(jpe?g|png|webp)$', '', s, flags=re.I)

    # Unify smart quotes/apostrophes
    s = (s
         .replace('\u2019', "'")
         .replace('\u2018', "'")
         .replace('\u201C', '"')
         .replace('\u201D', '"')
         .replace('’', "'")
         .replace('‘', "'"))

    # Replace underscores / hyphens with space
    s = re.sub(r'[_-]+', ' ', s)

    # Remove stray surrounding quotes
    s = s.strip(" \"'`")

    # Collapse whitespace
    s = re.sub(r'\s+', ' ', s)

    # Optionally drop all apostrophes for matching
    if not keep_apostrophes:
        s = re.sub(r"[\'`]", "", s)

    # Drop trailing punctuation like commas, semicolons
    s = re.sub(r'[.,;:]+$', '', s)

    return s.lower().strip()

def load_json(path: Path):
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(data, list):
            print("ERROR: Root JSON is not a list", file=sys.stderr); sys.exit(1)
        return data
    except Exception as e:
        print("ERROR: Failed to parse JSON:", e, file=sys.stderr); sys.exit(1)

def build_index(memorials, keep_ap=False, verbose=False):
    idx = {}
    for m in memorials:
        if isinstance(m, dict) and m.get("name"):
            key = normalize(m["name"], keep_apostrophes=keep_ap)
            if key:
                if key in idx and verbose:
                    print(f"WARN duplicate normalized name: {m['name']} vs {idx[key].get('name')}")
                idx.setdefault(key, m)
    return idx

def parse_args():
    ap = argparse.ArgumentParser(description="Update memorials.json with lat/lng from a CSV")
    ap.add_argument("--json", type=Path, default=DEFAULT_JSON)
    ap.add_argument("--csv", type=Path, default=DEFAULT_CSV)
    ap.add_argument("--lat-col", default="DecimalLat")
    ap.add_argument("--lng-col", default="DecimalLng")
    ap.add_argument("--file-col", default="Filename")
    ap.add_argument("--backup-suffix", default=".backup.json")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--verbose", action="store_true")
    ap.add_argument("--show-path", action="store_true")
    ap.add_argument("--keep-apostrophes", action="store_true",
                    help="Do not strip apostrophes when matching")
    return ap.parse_args()

def main():
    args = parse_args()
    if args.show_path:
        print("JSON:", args.json.resolve())
        print("CSV :", args.csv.resolve())

    if not args.json.exists(): print("ERROR: JSON not found"); sys.exit(1)
    if not args.csv.exists(): print("ERROR: CSV not found"); sys.exit(1)

    memorials = load_json(args.json)
    index = build_index(memorials, keep_ap=args.keep_apostrophes, verbose=args.verbose)

    updated = 0
    unchanged = 0
    unmatched = []

    with args.csv.open(newline='', encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        if args.verbose: print("CSV columns:", reader.fieldnames)
        for line_no, row in enumerate(reader, start=2):
            raw_file = (row.get(args.file_col) or "").strip()
            if not raw_file:
                continue
            # Skip placeholder IMG*
            if raw_file.upper().startswith("IMG"):
                if args.verbose: print(f"Line {line_no}: skip {raw_file} (IMG)")
                continue

            norm = normalize(raw_file, keep_apostrophes=args.keep_apostrophes)
            lat_s = (row.get(args.lat_col) or "").strip()
            lng_s = (row.get(args.lng_col) or "").strip()
            try:
                lat = float(lat_s); lng = float(lng_s)
            except ValueError:
                if args.verbose: print(f"Line {line_no}: invalid coords {lat_s},{lng_s} for {raw_file}")
                continue

            m = index.get(norm)
            if not m:
                unmatched.append(raw_file)
                if args.verbose: print(f"Line {line_no}: no match for '{raw_file}' (norm='{norm}')")
                continue

            loc = m.setdefault("location", {})
            if loc.get("lat") == lat and loc.get("lng") == lng:
                unchanged += 1
                if args.verbose: print(f"Line {line_no}: unchanged {raw_file}")
                continue

            loc["lat"] = lat
            loc["lng"] = lng
            updated += 1
            if args.verbose:
                print(f"Line {line_no}: updated {raw_file} -> ({lat},{lng})")

    if updated or args.dry_run:
        backup = args.json.with_suffix(args.backup_suffix)
        if not args.dry_run:
            shutil.copyfile(args.json, backup)
            args.json.write_text(json.dumps(memorials, ensure_ascii=False, indent=2),
                                 encoding="utf-8")
        print(f"Updated: {updated}")
        print(f"Unchanged: {unchanged}")
        print(f"Unmatched: {len(unmatched)}")
        if unmatched:
            print("Sample unmatched:", "; ".join(unmatched[:20]))
        print("Backup:", backup)
        if args.dry_run:
            print("Dry-run only (no write).")
    else:
        print("No changes detected.")

if __name__ == "__main__":
    main()
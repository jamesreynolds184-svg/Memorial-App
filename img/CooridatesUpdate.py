import csv, re, pathlib, sys

SRC = pathlib.Path(r"c:\Users\james\Documents\NMA APP\memorials-app\img\zone1\image_metadata.csv")
OUT = SRC.with_name("image_coordinates.csv")

LAT_REF_RE = re.compile(r"[{,]\s*1:\s*['\"]?([NS])['\"]?", re.IGNORECASE)
LAT_DMS_RE = re.compile(r"[{,]\s*2:\s*\(([^)]+)\)")
LON_REF_RE = re.compile(r"[{,]\s*3:\s*['\"]?([EW])['\"]?", re.IGNORECASE)
LON_DMS_RE = re.compile(r"[{,]\s*4:\s*\(([^)]+)\)")

def dms_to_decimal(dms_tuple: str, ref: str):
    try:
        parts = [p.strip() for p in dms_tuple.split(',')]
        nums = []
        for p in parts[:3]:
            if '/' in p:
                a,b = p.split('/',1)
                nums.append(float(a)/float(b))
            else:
                nums.append(float(p))
        while len(nums) < 3:
            nums.append(0.0)
        d,m,s = nums[:3]
        dec = d + m/60 + s/3600
        if ref.upper() in ('S','W'):
            dec = -dec
        return round(dec, 8)
    except Exception:
        return ''

def extract_decimal(raw: str):
    if not raw:
        return ('','')
    lat_ref = LAT_REF_RE.search(raw)
    lat_dms = LAT_DMS_RE.search(raw)
    lon_ref = LON_REF_RE.search(raw)
    lon_dms = LON_DMS_RE.search(raw)
    if not (lat_ref and lat_dms and lon_ref and lon_dms):
        return ('','')
    return (
        dms_to_decimal(lat_dms.group(1), lat_ref.group(1)),
        dms_to_decimal(lon_dms.group(1), lon_ref.group(1))
    )

if not SRC.exists():
    print("Source CSV not found:", SRC)
    sys.exit(1)

with SRC.open('r', encoding='utf-8', errors='replace', newline='') as fin:
    rows = list(csv.reader(fin))
if not rows:
    print("Empty file.")
    sys.exit(0)

header = rows[0]
# Find columns
try:
    filename_idx = header.index('Filename')
except ValueError:
    print("Filename column not found. Header:", header)
    sys.exit(1)
try:
    gps_idx = header.index('GPSInfo')
except ValueError:
    print("GPSInfo column not found. Header:", header)
    sys.exit(1)

out_rows = [['Filename','DecimalLat','DecimalLng']]
found = 0
for r in rows[1:]:
    if not r or len(r) <= max(filename_idx, gps_idx):
        continue
    fname = r[filename_idx].strip()
    gps_cell = r[gps_idx]

    # Attempt merge if GPS split (crude)
    if gps_cell and ('{' in gps_cell or '1:' in gps_cell) and gps_cell.count('4:') == 0:
        # concatenate trailing cells
        tail_parts = []
        for extra in r[gps_idx+1:]:
            tail_parts.append(extra)
            test = gps_cell + ',' + ','.join(tail_parts)
            if '4:' in test:
                gps_cell = test
                break

    lat, lng = extract_decimal(gps_cell)
    if lat != '' and lng != '':
        found += 1
    out_rows.append([fname, lat, lng])

with OUT.open('w', encoding='utf-8', newline='') as fout:
    w = csv.writer(fout)
    w.writerows(out_rows)

print(f"Wrote {OUT} (decoded {found} rows)")
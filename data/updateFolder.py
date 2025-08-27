import csv
import json
import re
import os

def clean_name(name):
    # Remove .HEIC and any trailing image extension, plus whitespace
    return re.sub(r'\.HEIC(\s*)$', '', name.strip(), flags=re.IGNORECASE)

# Get the directory where the script is located
base_dir = os.path.dirname(os.path.abspath(__file__))

csv_path = os.path.join(base_dir, "metadata_clean.csv")
json_path = os.path.join(base_dir, "memorials.json")

# Load CSV data
csv_data = {}
with open(csv_path, newline='', encoding='utf-8') as csvfile:
    reader = csv.DictReader(csvfile)
    for row in reader:
        key = clean_name(row['Name'])
        csv_data[key] = {
            'latitude': float(row['Latitude']),
            'longitude': float(row['Longitude'])
        }

# Load JSON data
with open(json_path, encoding='utf-8') as f:
    memorials = json.load(f)

# Update JSON with lat/lon from CSV
for memorial in memorials:
    key = clean_name(memorial['name'])
    if key in csv_data:
        memorial['latitude'] = csv_data[key]['latitude']
        memorial['longitude'] = csv_data[key]['longitude']

# Save updated JSON
with open(json_path, 'w', encoding='utf-8') as f:
    json.dump(memorials, f, indent=2, ensure_ascii=False)

print("memorials.json updated with latitude and longitude.")
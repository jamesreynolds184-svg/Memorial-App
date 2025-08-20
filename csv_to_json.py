import csv
import json

input_file = 'memorials.csv'
output_file = 'memorials.json'

data = []

with open(input_file, newline='', encoding='utf-8-sig') as csvfile:
    # Read the first line and strip whitespace from headers
    reader = csv.reader(csvfile)
    headers = [h.strip() for h in next(reader)]
    # Set DictReader with cleaned headers
    dict_reader = csv.DictReader(csvfile, fieldnames=headers)
    for row in dict_reader:
        # Skip empty rows
        if not any(row.values()):
            continue
        # Debug: print(row.keys())
        entry = {
            "name": row.get("Memorial", ""),
            "zone": row.get("Zone", ""),
            "description": row.get("Text", ""),
            "map": "",
            "location": {
                "lat": "",
                "lng": ""
            }
        }
        data.append(entry)

# Remove the first entry if it's the header row
if data and data[0]["name"] == "Memorial":
    data = data[1:]

with open(output_file, 'w', encoding='utf-8') as jsonfile:
    json.dump(data, jsonfile, indent=2, ensure_ascii=False)
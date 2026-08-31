import csv
import json
import os

json_path = '../data/allied-special-forces.json'

# First, read existing JSON to preserve coordinates
existing_coords = {}
if os.path.exists(json_path):
    try:
        with open(json_path, 'r', encoding='utf-8') as f:
            existing_data = json.load(f)
            for memorial in existing_data:
                if 'location' in memorial:
                    # Store coordinates by plaque name
                    existing_coords[memorial['plaque']] = memorial['location']
        print(f"Preserved coordinates for {len(existing_coords)} memorials")
    except:
        print("Could not read existing coordinates")

# Read the CSV file
with open('../data/Allied Special Forces v4.xlsx - Sheet1.csv', 'r', encoding='utf-8') as csvfile:
    reader = csv.reader(csvfile)
    rows = list(reader)

# Extract the data (skip the first column which is the header label)
plaques = rows[0][1:]  # Skip "Plaque" label
descriptions = rows[1][1:]  # Skip "Memorial Text" label
gardens = rows[2][1:]  # Skip "Garden" label

# Create the JSON structure
memorials = []
for i, (plaque, description, garden) in enumerate(zip(plaques, descriptions, gardens), start=1):
    memorial = {
        "id": f"{i:03d}",  # Format as 001, 002, etc.
        "plaque": plaque,
        "description": description,
        "garden": garden
    }
    
    # Add back coordinates if they existed
    if plaque in existing_coords:
        memorial['location'] = existing_coords[plaque]
    
    memorials.append(memorial)

# Write to JSON file
with open(json_path, 'w', encoding='utf-8') as jsonfile:
    json.dump(memorials, jsonfile, indent=2, ensure_ascii=False)

print(f"Converted {len(memorials)} memorials to JSON")
restored_coords = sum(1 for m in memorials if 'location' in m)
print(f"Restored coordinates for {restored_coords} memorials")
print("Output saved to: ../data/allied-special-forces.json")

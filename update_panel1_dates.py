import json

# Read the JSON file
with open('data/afm-memorials.json', 'r', encoding='utf-8') as f:
    memorials = json.load(f)

# Count how many records will be updated
update_count = 0

# Update memorials with panel 8 and date null
for memorial in memorials:
    if memorial.get('panel') == 8 and memorial.get('date') is None:
        memorial['date'] = 1948
        update_count += 1

print(f"Updated {update_count} memorials with panel 8 and null date to date: 1948")

# Write back to the file
with open('data/afm-memorials.json', 'w', encoding='utf-8') as f:
    json.dump(memorials, f, indent=2)

print("File saved successfully!")

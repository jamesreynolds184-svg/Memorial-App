import json

# Read the JSON file
with open('data/afm-memorials.json', 'r', encoding='utf-8') as f:
    memorials = json.load(f)

# Define panel to date mappings
panel_date_mappings = {
    27: 1950,
    121: 1960,
    133: 1964,
    168: 1976,
    208: 1995,
    209: 1996,
    227: 2012
}

# Track updates per panel
updates = {panel: 0 for panel in panel_date_mappings.keys()}

# Update memorials with null dates for specified panels
for memorial in memorials:
    panel = memorial.get('panel')
    if panel in panel_date_mappings and memorial.get('date') is None:
        memorial['date'] = panel_date_mappings[panel]
        updates[panel] += 1

# Display results
total_updates = sum(updates.values())
print(f"Total memorials updated: {total_updates}\n")
print("Updates by panel:")
for panel, count in sorted(updates.items()):
    if count > 0:
        print(f"  Panel {panel} → {panel_date_mappings[panel]}: {count} memorials updated")

# Write back to the file
with open('data/afm-memorials.json', 'w', encoding='utf-8') as f:
    json.dump(memorials, f, indent=2)

print("\nFile saved successfully!")

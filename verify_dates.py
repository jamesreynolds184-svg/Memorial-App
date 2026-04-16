import json

with open('data/afm-memorials.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# Check sample panels from each CSV file
sample_panels = [1, 78, 124, 137, 152, 167, 183, 207, 224]
panel_info = {}

for entry in data:
    panel = entry['panel']
    if panel in sample_panels:
        if panel not in panel_info:
            panel_info[panel] = {
                'date': entry['date'],
                'first_name': entry['name'],
                'service': entry['service']
            }

print("Sample panels from each CSV file:")
print("-" * 60)
for panel in sorted(sample_panels):
    if panel in panel_info:
        info = panel_info[panel]
        print(f"Panel {panel:3d}: Year {info['date']} - {info['first_name']} ({info['service']})")

# Get year distribution
year_counts = {}
for entry in data:
    year = entry['date']
    year_counts[year] = year_counts.get(year, 0) + 1

print("\nYear distribution:")
print("-" * 60)
for year in sorted(year_counts.keys()):
    print(f"{year}: {year_counts[year]:4d} entries")

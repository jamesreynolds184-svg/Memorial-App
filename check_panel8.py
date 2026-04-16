import json

# Read the JSON file
with open('data/afm-memorials.json', 'r', encoding='utf-8') as f:
    memorials = json.load(f)

# Find panel 8 memorials with null dates
panel8_null = [m for m in memorials if m.get('panel') == 8 and m.get('date') is None]

print(f'Found {len(panel8_null)} panel 8 memorials with null dates')
if panel8_null:
    print("\nFirst 10 examples:")
    for memorial in panel8_null[:10]:
        print(f"  - {memorial['name']} (panel_number: {memorial.get('panel_number')})")

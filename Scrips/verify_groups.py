import json
from pathlib import Path

script_dir = Path(__file__).parent
json_file = script_dir.parent / 'data' / 'afm-memorials.json'

with open(json_file, 'r', encoding='utf-8') as f:
    data = json.load(f)

print("Sample entries with panel groups:\n")
print("="*80)

# Show samples from different panels
samples = [data[0], data[100], data[1000], data[6417], data[6418], data[9000]]

for entry in samples:
    print(f"Panel {entry['panel']:>3} (Group {entry['panel_group']}): {entry['name']}")

print("\n" + "="*80)
print(f"\nTotal entries: {len(data)}")
print(f"All entries have 'panel_group' field: {all('panel_group' in e for e in data)}")

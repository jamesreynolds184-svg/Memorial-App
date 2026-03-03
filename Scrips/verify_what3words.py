import json
from pathlib import Path

script_dir = Path(__file__).parent
json_file = script_dir.parent / 'data' / 'afm-memorials.json'

with open(json_file, 'r', encoding='utf-8') as f:
    data = json.load(f)

print("Sample entries with what3words codes:\n")
print("="*80)

# Show samples from different panel ranges
samples = [
    data[0],      # Panel 1 (1-5 range)
    data[500],    # Should be later panel
    data[1000],   # Even later
    data[6000],   # Near end of Group A
    data[6418],   # First of Group B (should have no code)
    data[9000]    # Near end
]

for entry in samples:
    w3w = entry.get('what3words') or 'None'
    print(f"Panel {entry['panel']:>3} | Group {entry['panel_group']} | {w3w:<35} | {entry['name']}")

print("\n" + "="*80)
print(f"\nTotal entries: {len(data)}")
print(f"Entries with what3words: {sum(1 for e in data if e.get('what3words'))}")
print(f"Entries without what3words: {sum(1 for e in data if not e.get('what3words'))}")

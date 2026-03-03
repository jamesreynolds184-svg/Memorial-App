import json
import re
from pathlib import Path

# Load the JSON data
script_dir = Path(__file__).parent
json_file = script_dir.parent / 'data' / 'afm-memorials.json'

with open(json_file, 'r', encoding='utf-8') as f:
    data = json.load(f)

# Find names with special characters (not letters, spaces, hyphens, apostrophes, or periods)
special_chars_pattern = r'[^A-Za-z\s\'\-\.]'
names_with_special = []

for entry in data:
    name = entry.get('name', '')
    if re.search(special_chars_pattern, name):
        names_with_special.append(entry)

print(f"Found {len(names_with_special)} names with special characters:\n")
print("="*80)

# Show first 30 examples
for i, entry in enumerate(names_with_special[:30]):
    name = entry['name']
    panel = entry.get('panel', 'Unknown')
    # Highlight special characters
    special_chars = re.findall(special_chars_pattern, name)
    print(f"{i+1}. {name} (Panel {panel}) - Contains: {set(special_chars)}")

print("\n" + "="*80)
print(f"\nTotal names needing cleanup: {len(names_with_special)}")

# Count occurrences of each special character
char_counts = {}
for entry in names_with_special:
    name = entry['name']
    for char in re.findall(special_chars_pattern, name):
        char_counts[char] = char_counts.get(char, 0) + 1

print("\nMost common special characters:")
for char, count in sorted(char_counts.items(), key=lambda x: x[1], reverse=True)[:20]:
    print(f"  '{char}' : {count} occurrences")

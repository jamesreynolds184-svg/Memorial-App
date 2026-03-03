import json

# Load the JSON file
with open('../data/afm-memorials.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# Remove what3words field from each entry
for entry in data:
    if 'what3words' in entry:
        del entry['what3words']

# Save the updated JSON
with open('../data/afm-memorials.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print(f"Removed what3words field from {len(data)} entries")

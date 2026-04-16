import json

# Read the JSON file
with open('data/afm-memorials.json', 'r', encoding='utf-8') as f:
    memorials = json.load(f)

# Track nulls in all fields
null_counts = {}
null_examples = {}

for memorial in memorials:
    for key, value in memorial.items():
        if value is None:
            if key not in null_counts:
                null_counts[key] = 0
                null_examples[key] = []
            null_counts[key] += 1
            if len(null_examples[key]) < 5:  # Store first 5 examples
                null_examples[key].append({
                    'name': memorial.get('name'),
                    'panel': memorial.get('panel'),
                    'panel_number': memorial.get('panel_number')
                })

print("="*60)
print("NULL VALUES REPORT")
print("="*60)
total_nulls = sum(null_counts.values())
print(f"\nTotal null values found: {total_nulls}")

if null_counts:
    print(f"\nBreakdown by field:")
    for field in sorted(null_counts.keys()):
        count = null_counts[field]
        print(f"\n  {field}: {count} null values")
        print(f"    Examples:")
        for example in null_examples[field]:
            print(f"      - {example['name']} (Panel {example['panel']}, Pos {example['panel_number']})")
else:
    print("\n✓ No null values found in any field!")

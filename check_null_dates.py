import json

# Read the JSON file
with open('data/afm-memorials.json', 'r', encoding='utf-8') as f:
    memorials = json.load(f)

# Find all memorials with null dates
null_dates = [m for m in memorials if m.get('date') is None]

print(f"Total memorials: {len(memorials)}")
print(f"Memorials with null dates: {len(null_dates)}\n")

if null_dates:
    # Group by panel
    panels_with_nulls = {}
    for memorial in null_dates:
        panel = memorial.get('panel')
        if panel not in panels_with_nulls:
            panels_with_nulls[panel] = []
        panels_with_nulls[panel].append(memorial)
    
    print("Null dates found in the following panels:")
    for panel in sorted(panels_with_nulls.keys()):
        count = len(panels_with_nulls[panel])
        print(f"\n  Panel {panel}: {count} memorials with null dates")
        # Show first 5 examples
        for memorial in panels_with_nulls[panel][:5]:
            print(f"    - {memorial.get('name')} (panel_number: {memorial.get('panel_number')})")
        if count > 5:
            print(f"    ... and {count - 5} more")
else:
    print("✓ No memorials with null dates found!")

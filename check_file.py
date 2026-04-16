import json

with open('data/afm-memorials.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

panel183 = [e for e in data if e['panel'] == 183][:5]

print("Panel 183 entries:")
for e in panel183:
    print(f"  {e['name']:20} Date: {e['date']}")

print(f"\nTotal entries in file: {len(data)}")

# Check all panels 183-230
panels_183_plus = {}
for e in data:
    if e['panel'] >= 183 and e['panel'] <= 230:
        panel = e['panel']
        date = e['date']
        if panel not in panels_183_plus:
            panels_183_plus[panel] = date

print("\nPanels 183-230 dates:")
for panel in sorted(panels_183_plus.keys()):
    print(f"  Panel {panel}: {panels_183_plus[panel]}")

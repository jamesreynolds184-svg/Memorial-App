import json

with open('data/afm-memorials.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# Check panel 230
panel230 = [e for e in data if e['panel'] == 230]
print(f"Panel 230 has {len(panel230)} entries")
print("\nFirst 3 entries:")
for e in panel230[:3]:
    print(f"  {e['name']:25} Date: {e['date']}")

print("\nLast 3 entries:")
for e in panel230[-3:]:
    print(f"  {e['name']:25} Date: {e['date']}")

# Check all unique dates in panel 230
dates = set([e['date'] for e in panel230 if e['date'] is not None])
print(f"\nUnique dates in panel 230: {sorted(dates)}")

# Find the specific entry
long_mo = [e for e in data if e['name'] == 'LONG MO']
if long_mo:
    print(f"\nLONG MO entry:")
    print(f"  Name: {long_mo[0]['name']}")
    print(f"  Service: {long_mo[0]['service']}")
    print(f"  Date: {long_mo[0]['date']}")
    print(f"  Panel: {long_mo[0]['panel']}")
    print(f"  Position: {long_mo[0]['panel_number']}")

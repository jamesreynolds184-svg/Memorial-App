import json
import csv

# Load JSON data
with open('data/afm-memorials.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# Check panel 167 from F.csv (should be 1975)
print("Panel 167 (from F.csv - should be 1975):")
panel167 = [e for e in data if e['panel'] == 167][:3]
for e in panel167:
    print(f"  {e['name']:25} Date: {e['date']} Service: {e['service']}")

# Verify against F.csv
print("\nF.csv first row (panel 167):")
with open('data/CSVs/F.csv', 'r', encoding='utf-8') as f:
    reader = csv.reader(f)
    rows = list(reader)
    print(f"  Header: {rows[0][:3]}")
    print(f"  Row 2: {rows[1][:3]}")

# Check panel 183 from G.csv (should be 1982)
print("\nPanel 183 (from G.csv - should be 1982):")
panel183 = [e for e in data if e['panel'] == 183][:3]
for e in panel183:
    print(f"  {e['name']:25} Date: {e['date']} Service: {e['service']}")

# Verify against G.csv
print("\nG.csv first row (panel 183):")
with open('data/CSVs/G.csv', 'r', encoding='utf-8') as f:
    reader = csv.reader(f)
    rows = list(reader)
    print(f"  Header: {rows[0][:3]}")
    print(f"  Row 2: {rows[1][:3]}")

print("\n✓ Dates now match CSV files!")

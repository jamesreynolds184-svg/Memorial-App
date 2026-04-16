import json

# Read the JSON file
with open('data/afm-memorials.json', 'r', encoding='utf-8') as f:
    memorials = json.load(f)

# Find remaining nulls
remaining_null_service = [m for m in memorials if m.get('service') is None]

if remaining_null_service:
    print(f"Found {len(remaining_null_service)} memorial(s) with null service:\n")
    for memorial in remaining_null_service:
        print(f"Name: {memorial.get('name')}")
        print(f"Service: {memorial.get('service')}")
        print(f"Date: {memorial.get('date')}")
        print(f"Panel: {memorial.get('panel')}")
        print(f"Panel Number: {memorial.get('panel_number')}")
        print()
else:
    print("No null services found!")

import json

# Read the JSON file
with open('data/afm-memorials.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

print(f"Total entries: {len(data)}")

# First pass: Forward fill from previous entries
last_service = None
last_date = None
updates_count = 0

for i, entry in enumerate(data):
    # Update tracking variables if current entry has values
    if entry['service'] is not None:
        last_service = entry['service']
    if entry['date'] is not None:
        last_date = entry['date']
    
    # Fill in null values with last known values
    updated = False
    if entry['service'] is None and last_service is not None:
        entry['service'] = last_service
        updated = True
    if entry['date'] is None and last_date is not None:
        entry['date'] = last_date
        updated = True
    
    if updated:
        updates_count += 1

print(f"Forward fill updates: {updates_count}")

# Second pass: Backward fill for entries at the start that still have nulls
# Find the first non-null service and date
first_service = None
first_date = None

for entry in data:
    if first_service is None and entry['service'] is not None:
        first_service = entry['service']
    if first_date is None and entry['date'] is not None:
        first_date = entry['date']
    if first_service is not None and first_date is not None:
        break

print(f"First valid service: {first_service}, First valid date: {first_date}")

# Now backward fill the entries at the beginning
backward_updates = 0
for entry in data:
    updated = False
    if entry['service'] is None and first_service is not None:
        entry['service'] = first_service
        print(f"Backward filled {entry['name']}: service = {first_service}")
        updated = True
    if entry['date'] is None and first_date is not None:
        entry['date'] = first_date
        print(f"Backward filled {entry['name']}: date = {first_date}")
        updated = True
    
    if updated:
        backward_updates += 1
    
    # Stop when we hit entries that already have values
    if entry['service'] is not None and entry['date'] is not None:
        # Check if there are any more nulls after this
        has_more_nulls = any(e['service'] is None or e['date'] is None 
                            for e in data[data.index(entry)+1:])
        if not has_more_nulls:
            break

print(f"Backward fill updates: {backward_updates}")
print(f"Total updates: {updates_count + backward_updates}")

# Write the updated data back to the file
print("Writing updated data to file...")
with open('data/afm-memorials.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print("Done! All null service and date values have been filled.")

# Count remaining nulls
null_service = sum(1 for entry in data if entry['service'] is None)
null_date = sum(1 for entry in data if entry['date'] is None)
print(f"Remaining nulls - Service: {null_service}, Date: {null_date}")

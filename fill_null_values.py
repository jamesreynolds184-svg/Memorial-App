import json

# Read the JSON file
with open('data/afm-memorials.json', 'r', encoding='utf-8') as f:
    memorials = json.load(f)

# Track statistics
nulls_before = {
    'date': sum(1 for m in memorials if m.get('date') is None),
    'service': sum(1 for m in memorials if m.get('service') is None)
}

# Store the last valid date and service
last_valid_date = None
last_valid_service = None
updates_made = 0

print("Processing memorials and filling null values from previous entries...\n")

for i, memorial in enumerate(memorials):
    needs_update = False
    
    # Check if current memorial has valid date and service
    current_date = memorial.get('date')
    current_service = memorial.get('service')
    
    # If date is null and we have a last valid date, copy it
    if current_date is None and last_valid_date is not None:
        memorial['date'] = last_valid_date
        needs_update = True
        
    # If service is null and we have a last valid service, copy it
    if current_service is None and last_valid_service is not None:
        memorial['service'] = last_valid_service
        needs_update = True
    
    if needs_update:
        updates_made += 1
        if updates_made <= 10:  # Show first 10 examples
            print(f"Updated '{memorial['name']}' (panel {memorial.get('panel')}):")
            if current_date is None:
                print(f"  - date: null → {last_valid_date}")
            if current_service is None:
                print(f"  - service: null → '{last_valid_service}'")
    
    # Update last valid values if current entry has them
    if current_date is not None:
        last_valid_date = current_date
    if current_service is not None:
        last_valid_service = current_service

# Check remaining nulls
nulls_after = {
    'date': sum(1 for m in memorials if m.get('date') is None),
    'service': sum(1 for m in memorials if m.get('service') is None)
}

print(f"\n{'='*60}")
print(f"Summary:")
print(f"{'='*60}")
print(f"Total memorials updated: {updates_made}")
print(f"\nNull dates:")
print(f"  Before: {nulls_before['date']}")
print(f"  After:  {nulls_after['date']}")
print(f"  Fixed:  {nulls_before['date'] - nulls_after['date']}")
print(f"\nNull services:")
print(f"  Before: {nulls_before['service']}")
print(f"  After:  {nulls_after['service']}")
print(f"  Fixed:  {nulls_before['service'] - nulls_after['service']}")

if nulls_after['date'] > 0 or nulls_after['service'] > 0:
    print(f"\n⚠ Warning: Some nulls remain (likely at the beginning before any valid entries)")
else:
    print(f"\n✓ All nulls successfully filled!")

# Write back to the file
with open('data/afm-memorials.json', 'w', encoding='utf-8') as f:
    json.dump(memorials, f, indent=2)

print("\nFile saved successfully!")

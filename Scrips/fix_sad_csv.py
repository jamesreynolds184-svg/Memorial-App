import csv

# Read the transposed CSV
input_file = r'c:\Users\james\Documents\NMA APP\memorials-app\data\SaD.csv'
output_file = r'c:\Users\james\Documents\NMA APP\memorials-app\data\SaD_fixed.csv'

# Read all rows from the input file
with open(input_file, 'r', encoding='utf-8') as f:
    reader = csv.reader(f)
    rows = list(reader)

# The first row contains column numbers, second row is Rank, third is Surname, etc.
# We need to transpose this data
# Skip the first column (which is the row label or empty)

# Extract the field names from the first column
field_names = []
for i, row in enumerate(rows):
    if i == 0:
        continue  # Skip the column number row
    if i < 8:  # Rank, Surname, First Name, Unit, Date of Execution, Age at Death, Notes
        field_name = row[0].strip()
        if field_name:
            field_names.append(field_name)
    else:
        # Additional notes rows - we'll merge them into the Notes field
        break

# Handle the case where Notes might span multiple rows
# Determine how many data columns we have
num_entries = len(rows[1]) - 1  # Minus 1 for the first column (field name)

# Transpose the data
transposed_data = []
for col_idx in range(1, num_entries + 1):  # Start from 1 to skip the first column
    entry = {}
    notes_parts = []
    
    for row_idx, row in enumerate(rows):
        if row_idx == 0:  # Skip column number row
            continue
        
        if col_idx < len(row):
            value = row[col_idx].strip()
            
            if row_idx == 1:  # Rank
                entry['Rank'] = value
            elif row_idx == 2:  # Surname
                entry['Surname'] = value
            elif row_idx == 3:  # First Name
                entry['First Name'] = value
            elif row_idx == 4:  # Unit
                entry['Unit'] = value
            elif row_idx == 5:  # Date of Execution
                entry['Date of Execution'] = value
            elif row_idx == 6:  # Age at Death
                entry['Age at Death'] = value
            elif row_idx >= 7:  # Notes and additional rows
                if value:  # Only add non-empty values
                    notes_parts.append(value)
    
    # Combine all notes parts (they might span multiple rows)
    entry['Notes'] = '\n'.join(notes_parts) if notes_parts else ''
    
    # Only add entries that have at least a surname
    if entry.get('Surname'):
        transposed_data.append(entry)

# Write the fixed CSV file
with open(output_file, 'w', newline='', encoding='utf-8') as f:
    fieldnames = ['Rank', 'Surname', 'First Name', 'Unit', 'Date of Execution', 'Age at Death', 'Notes']
    writer = csv.DictWriter(f, fieldnames=fieldnames, quoting=csv.QUOTE_ALL)
    
    writer.writeheader()
    writer.writerows(transposed_data)

print(f"Fixed CSV file created: {output_file}")
print(f"Total entries: {len(transposed_data)}")

# Display entry 19 (index 18) as a verification
if len(transposed_data) >= 19:
    print("\nEntry 19 (Frederick Barratt):")
    entry_19 = transposed_data[18]
    for key, value in entry_19.items():
        if key == 'Notes':
            print(f"  {key}: {value[:100]}..." if len(value) > 100 else f"  {key}: {value}")
        else:
            print(f"  {key}: {value}")

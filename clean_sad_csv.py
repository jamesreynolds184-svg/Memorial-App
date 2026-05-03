import csv
import re

# Read the CSV file
with open('data/SaD.csv', 'r', encoding='utf-8') as file:
    lines = file.readlines()

# Process each line
cleaned_lines = []
for i, line in enumerate(lines):
    # For age row (row 7, index 6), remove "Age " prefix
    if i == 6:  # Age row (0-indexed, row 7 in file)
        # Split by comma, clean each value, rejoin
        values = line.rstrip('\n').split(',')
        cleaned_values = []
        for j, val in enumerate(values):
            if j == 0:
                # Keep the first column as is (the label)
                cleaned_values.append(val.replace('"', '').replace('*', ''))
            else:
                # Remove "Age " prefix from age values
                val = val.replace('Age ', '')
                # Remove quotes and asterisks
                val = val.replace('"', '').replace('*', '').strip()
                cleaned_values.append(val)
        cleaned_lines.append(','.join(cleaned_values) + '\n')
    else:
        # For all other rows, just remove quotes and asterisks
        cleaned_line = line.replace('"', '').replace('*', '')
        cleaned_lines.append(cleaned_line)

# Write back to the file
with open('data/SaD.csv', 'w', encoding='utf-8', newline='') as file:
    file.writelines(cleaned_lines)

print("CSV cleaned successfully!")
print("- Removed 'Age ' prefix from age values")
print("- Removed quotes (\") and asterisks (*)")

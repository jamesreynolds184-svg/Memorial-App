import csv
import json
import os
import re
from pathlib import Path

# Define the service markers
SERVICES = ["ARMY", "ROYAL NAVY", "ROYAL AIR FORCE", "ROYAL  NAVY", "ROYAL NAYY", "*ARMY"]
# Normalize service names
SERVICE_NORMALIZE = {
    "ARMY": "Army",
    "*ARMY": "Army",
    "ROYAL NAVY": "Royal Navy",
    "ROYAL  NAVY": "Royal Navy",
    "ROYAL NAYY": "Royal Navy",
    "ROYAL AIR FORCE": "Royal Air Force"
}

def is_service_marker(text):
    """Check if the text is a service marker."""
    if not text or not isinstance(text, str):
        return False
    text = text.strip()
    return text in SERVICES

def is_date_marker(text):
    """Check if the text is a date marker (4-digit year)."""
    if not text or not isinstance(text, str):
        return False
    text = text.strip()
    # Check if it's a 4-digit year between 1940-2030
    if re.match(r'^\d{4}$', text):
        year = int(text)
        if 1940 <= year <= 2030:
            return True
    return False

def is_panel_number(text):
    """Check if the text is a panel number (first row)."""
    if not text or not isinstance(text, str):
        return False
    text = text.strip()
    # Panel numbers are 1-77 or higher
    if re.match(r'^\d{1,3}$', text):
        num = int(text)
        if 1 <= num <= 300:  # Allow up to 300 panels
            return True
    return False

def is_name(text):
    """Check if the text appears to be a person's name."""
    if not text or not isinstance(text, str):
        return False
    
    text = text.strip()
    
    # Skip empty strings
    if not text:
        return False
    
    # Skip service markers
    if is_service_marker(text):
        return False
    
    # Skip date markers
    if is_date_marker(text):
        return False
    
    # Skip panel numbers
    if is_panel_number(text):
        return False
    
    # Names typically have at least 2 characters
    if len(text) < 2:
        return False
    
    # Names should contain at least one letter
    if not re.search(r'[A-Za-z]', text):
        return False
    
    return True

def calculate_panel_location(position, total_names):
    """
    Calculate if a name is in the top, middle, or bottom third of the panel.
    
    Args:
        position: The position of the name (0-indexed)
        total_names: Total number of names in the panel
    
    Returns:
        'Top', 'Middle', or 'Bottom'
    """
    if total_names == 0:
        return 'Top'
    
    third = total_names / 3.0
    
    if position < third:
        return 'Top'
    elif position < 2 * third:
        return 'Middle'
    else:
        return 'Bottom'

def process_csv_file(filepath):
    """
    Process a single CSV file and extract memorial entries.
    
    Args:
        filepath: Path to the CSV file
    
    Returns:
        List of memorial entries
    """
    entries = []
    
    # Read the CSV file
    with open(filepath, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        rows = list(reader)
    
    if not rows:
        return entries
    
    # First row contains panel numbers
    panel_numbers = []
    for cell in rows[0]:
        if is_panel_number(cell):
            panel_numbers.append(int(cell.strip()))
        else:
            panel_numbers.append(None)
    
    # Track current service and date (persist across columns)
    current_service = None
    current_date = None
    
    # Process each column (panel)
    num_columns = len(panel_numbers)
    
    for col_idx in range(num_columns):
        panel_num = panel_numbers[col_idx]
        
        # Skip if no valid panel number
        if panel_num is None:
            continue
        
        # First pass: collect all names in this column to count them
        column_names = []
        temp_service = current_service
        temp_date = current_date
        
        for row_idx in range(1, len(rows)):  # Skip first row (panel numbers)
            if col_idx >= len(rows[row_idx]):
                continue
            
            cell = rows[row_idx][col_idx].strip()
            
            # Check for service marker
            if is_service_marker(cell):
                temp_service = SERVICE_NORMALIZE.get(cell, cell)
                continue
            
            # Check for date marker
            if is_date_marker(cell):
                temp_date = int(cell)
                continue
            
            # Check if it's a name
            if is_name(cell):
                column_names.append({
                    'name': cell,
                    'service': temp_service,
                    'date': temp_date
                })
        
        # Update the persistent service and date after processing this column
        current_service = temp_service
        current_date = temp_date
        
        # Second pass: assign panel locations based on position
        total_names = len(column_names)
        
        for position, name_data in enumerate(column_names):
            panel_loc = calculate_panel_location(position, total_names)
            
            entry = {
                'name': name_data['name'],
                'service': name_data['service'],
                'date': name_data['date'],
                'panel': panel_num,
                'panel_Loc': panel_loc,
                'panel_number': position + 1  # 1-indexed position on the panel
            }
            entries.append(entry)
    
    return entries

def process_all_csv_files(directory):
    """
    Process all CSV files in the AFM-Panels directory.
    
    Args:
        directory: Path to the directory containing CSV files
    
    Returns:
        List of all memorial entries
    """
    all_entries = []
    
    # Get all CSV files in the directory
    csv_files = sorted(Path(directory).glob('*.csv'))
    
    print(f"Found {len(csv_files)} CSV file(s) to process...")
    
    for csv_file in csv_files:
        print(f"Processing {csv_file.name}...")
        entries = process_csv_file(csv_file)
        all_entries.extend(entries)
        print(f"  Found {len(entries)} entries")
    
    return all_entries

def main():
    # Define paths
    script_dir = Path(__file__).parent
    data_dir = script_dir.parent / 'data' / 'AFM-Panels'
    output_file = script_dir.parent / 'data' / 'afm-memorials.json'
    
    print("="*60)
    print("AFM Names CSV to JSON Converter")
    print("="*60)
    print(f"Input directory: {data_dir}")
    print(f"Output file: {output_file}")
    print()
    
    # Load existing data from JSON file if it exists
    existing_entries = []
    if output_file.exists():
        print(f"Loading existing data from {output_file}...")
        with open(output_file, 'r', encoding='utf-8') as f:
            existing_entries = json.load(f)
        print(f"Found {len(existing_entries)} existing entries")
        print()
    
    # Process all CSV files
    new_entries = process_all_csv_files(data_dir)
    
    print()
    print(f"New entries found: {len(new_entries)}")
    
    # Combine existing and new entries
    all_entries = existing_entries + new_entries
    print(f"Total entries after merge: {len(all_entries)}")
    
    # Write to JSON file
    print(f"\nWriting to {output_file}...")
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(all_entries, f, indent=2, ensure_ascii=False)
    
    print("Done!")
    
    # Print some statistics
    print("\n" + "="*60)
    print("Statistics:")
    print("="*60)
    
    services = {}
    dates = {}
    panels = {}
    locations = {}
    
    for entry in all_entries:
        # Count services
        service = entry.get('service', 'Unknown')
        services[service] = services.get(service, 0) + 1
        
        # Count dates
        date = entry.get('date', 'Unknown')
        dates[date] = dates.get(date, 0) + 1
        
        # Count panels
        panel = entry.get('panel', 'Unknown')
        panels[panel] = panels.get(panel, 0) + 1
        
        # Count locations
        loc = entry.get('panel_Loc', 'Unknown')
        locations[loc] = locations.get(loc, 0) + 1
    
    print(f"\nServices:")
    for service, count in sorted(services.items(), key=lambda x: (x[0] is None, x[0])):
        print(f"  {service}: {count}")
    
    print(f"\nDates:")
    for date, count in sorted(dates.items(), key=lambda x: (x[0] is None, x[0])):
        print(f"  {date}: {count}")
    
    print(f"\nPanel Locations:")
    for loc, count in sorted(locations.items(), key=lambda x: (x[0] is None, x[0])):
        print(f"  {loc}: {count}")
    
    print(f"\nNumber of panels: {len(panels)}")
    print(f"Panel range: {min(p for p in panels if p != 'Unknown')} - {max(p for p in panels if p != 'Unknown')}")
    
    # Show a few sample entries
    print("\n" + "="*60)
    print("Sample entries (first 5):")
    print("="*60)
    for i, entry in enumerate(all_entries[:5]):
        print(f"\n{i+1}. {json.dumps(entry, indent=2)}")

if __name__ == '__main__':
    main()

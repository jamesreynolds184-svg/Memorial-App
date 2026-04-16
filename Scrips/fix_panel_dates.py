import csv
import json
import re
from pathlib import Path

def is_date_marker(text):
    """Check if the text is a date marker (4-digit year)."""
    if not text or not isinstance(text, str):
        return False
    text = text.strip()
    if re.match(r'^\d{4}$', text):
        year = int(text)
        if 1940 <= year <= 2030:
            return True
    return False

def extract_dates_from_csv(csv_file):
    """Extract panel-to-date mappings from CSV file."""
    panel_dates = {}
    
    with open(csv_file, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        rows = list(reader)
    
    if not rows:
        return panel_dates
    
    # First row contains panel numbers
    panel_numbers = []
    for cell in rows[0]:
        cell = cell.strip()
        if re.match(r'^\d{1,3}$', cell):
            num = int(cell)
            if 1 <= num <= 300:
                panel_numbers.append(num)
            else:
                panel_numbers.append(None)
        else:
            panel_numbers.append(None)
    
    # Track current date across columns (persists until new date found)
    current_date = None
    
    # Process each column (panel)
    for col_idx in range(len(panel_numbers)):
        panel_num = panel_numbers[col_idx]
        if panel_num is None:
            continue
        
        # Look for a date marker in this column
        column_date = None
        for row_idx in range(1, len(rows)):
            if col_idx >= len(rows[row_idx]):
                continue
            
            cell = rows[row_idx][col_idx].strip()
            
            # Check for date marker
            if is_date_marker(cell):
                column_date = int(cell)
                current_date = column_date
                break
        
        # If we found a date in this column, use it
        # Otherwise, use the persisted date from previous columns
        if column_date:
            panel_dates[panel_num] = column_date
        elif current_date:
            panel_dates[panel_num] = current_date
    
    return panel_dates

def main():
    script_dir = Path(__file__).parent
    data_dir = script_dir.parent / 'data'
    csv_dir = data_dir / 'CSVs'
    json_file = data_dir / 'afm-memorials.json'
    
    print("="*60)
    print("Fix Panel Dates from CSV Files")
    print("="*60)
    
    # Load existing JSON
    print(f"Loading {json_file}...")
    with open(json_file, 'r', encoding='utf-8') as f:
        entries = json.load(f)
    
    print(f"Loaded {len(entries)} entries")
    
    # Extract dates from ALL CSV files (A through I)
    all_panel_dates = {}
    
    for csv_name in ['A.csv', 'B.csv', 'C.csv', 'D.csv', 'E.csv', 'F.csv', 'G.csv', 'H.csv', 'I.csv']:
        csv_path = csv_dir / csv_name
        if csv_path.exists():
            print(f"\nProcessing {csv_name}...")
            panel_dates = extract_dates_from_csv(csv_path)
            all_panel_dates.update(panel_dates)
            print(f"  Found dates for {len(panel_dates)} panels")
            # Show some sample mappings
            if panel_dates:
                sample_panels = sorted(panel_dates.keys())[:3]
                for panel in sample_panels:
                    print(f"    Panel {panel}: {panel_dates[panel]}")
    
    print(f"\nTotal panels with date mappings: {len(all_panel_dates)}")
    
    # Update entries
    updated_count = 0
    for entry in entries:
        panel = entry.get('panel')
        if panel in all_panel_dates:
            old_date = entry.get('date')
            new_date = all_panel_dates[panel]
            if old_date != new_date:
                entry['date'] = new_date
                updated_count += 1
    
    print(f"\nUpdated {updated_count} entries")
    
    # Backup original file
    backup_file = json_file.with_suffix('.json.backup')
    print(f"\nCreating backup at {backup_file}...")
    with open(json_file, 'r', encoding='utf-8') as f_in:
        with open(backup_file, 'w', encoding='utf-8') as f_out:
            f_out.write(f_in.read())
    
    # Write updated JSON
    print(f"Writing updated data to {json_file}...")
    with open(json_file, 'w', encoding='utf-8') as f:
        json.dump(entries, f, indent=2, ensure_ascii=False)
    
    print("\n✓ Complete!")
    print(f"  Backup saved to: {backup_file}")
    print(f"  Updated file: {json_file}")

if __name__ == '__main__':
    main()

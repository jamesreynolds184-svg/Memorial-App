import json
from pathlib import Path

def get_panel_group(panel_number):
    """
    Determine which group a panel belongs to based on the panel number.
    
    Args:
        panel_number: The panel number
    
    Returns:
        Group letter (A-I) or None if outside known ranges
    """
    if panel_number is None:
        return None
    
    panel = int(panel_number)
    
    if 1 <= panel <= 77:
        return 'A'
    elif 78 <= panel <= 118:
        return 'B'
    elif 119 <= panel <= 134:
        return 'C'
    elif 135 <= panel <= 150:
        return 'D'
    elif 151 <= panel <= 166:
        return 'E'
    elif 167 <= panel <= 182:
        return 'F'
    elif 183 <= panel <= 205:
        return 'G'
    elif 207 <= panel <= 223:  # Note: 206 is not assigned to any group
        return 'H'
    elif 224 <= panel <= 230:
        return 'I'
    else:
        return None  # Panel outside defined ranges

def main():
    # Define paths
    script_dir = Path(__file__).parent
    json_file = script_dir.parent / 'data' / 'afm-memorials.json'
    backup_file = script_dir.parent / 'data' / 'afm-memorials.backup.json'
    
    print("="*80)
    print("AFM Panel Groups Assignment")
    print("="*80)
    print("\nPanel Group Ranges:")
    print("  Group A: Panels 1-77")
    print("  Group B: Panels 78-118")
    print("  Group C: Panels 119-134")
    print("  Group D: Panels 135-150")
    print("  Group E: Panels 151-166")
    print("  Group F: Panels 167-182")
    print("  Group G: Panels 183-205")
    print("  Group H: Panels 207-223")
    print("  Group I: Panels 224-230")
    print()
    
    # Load the JSON data
    print(f"Loading data from {json_file}...")
    with open(json_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    print(f"Loaded {len(data)} entries")
    
    # Create backup
    print(f"\nCreating backup at {backup_file}...")
    with open(backup_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print("Backup created successfully")
    
    # Assign groups
    print("\nAssigning panel groups...")
    group_counts = {}
    no_group_panels = set()
    
    for entry in data:
        panel = entry.get('panel')
        group = get_panel_group(panel)
        entry['panel_group'] = group
        
        if group:
            group_counts[group] = group_counts.get(group, 0) + 1
        else:
            if panel:
                no_group_panels.add(panel)
    
    # Save updated data
    print(f"\nSaving updated data to {json_file}...")
    with open(json_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    print("Done!")
    
    # Print statistics
    print("\n" + "="*80)
    print("Group Assignment Summary:")
    print("="*80)
    
    for group in sorted(group_counts.keys()):
        count = group_counts[group]
        print(f"  Group {group}: {count} entries")
    
    if no_group_panels:
        print(f"\nPanels without group assignment: {sorted(no_group_panels)}")
    else:
        print("\nAll panels successfully assigned to groups!")
    
    print("\n" + "="*80)
    print(f"Total entries processed: {len(data)}")
    print(f"Backup saved: {backup_file}")
    print("="*80)

if __name__ == '__main__':
    main()

import json
from pathlib import Path

def get_what3words_code(panel_number):
    """
    Get the what3words code for a panel number based on defined ranges.
    
    Args:
        panel_number: The panel number
    
    Returns:
        what3words code string or None if not defined
    """
    if panel_number is None:
        return None
    
    panel = int(panel_number)
    
    # Define the what3words mapping for each panel range
    w3w_ranges = [
        (1, 5, "///woke.fastening.rinses"),
        (6, 10, "///timeless.craziest.tasteful"),
        (11, 15, "///doll.caravans.begun"),
        (16, 20, "///vandalism.angle.copiers"),
        (21, 25, "///ripe.decorated.risk"),
        (26, 30, "///quaking.public.ranted"),
        (31, 35, "///wrenching.directors.aliens"),
        (36, 40, "///icon.scrubbing.survey"),
        (41, 45, "///coil.initial.gourmet"),
        (46, 49, "///outer.simulator.harder"),
        (50, 53, "///salaried.waddled.clashes"),
        (54, 57, "///condiment.irrigate.exhales"),
        (58, 61, "///marathons.crispier.crystal"),
        (62, 65, "///talkative.term.universes"),
        (66, 69, "///feasted.residual.stitch"),
        (70, 73, "///rosier.landscape.minds"),
        (74, 77, "///upgrading.revolting.belong"),
    ]
    
    # Find the matching range
    for start, end, code in w3w_ranges:
        if start <= panel <= end:
            return code
    
    return None  # Panel outside defined ranges

def main():
    # Define paths
    script_dir = Path(__file__).parent
    json_file = script_dir.parent / 'data' / 'afm-memorials.json'
    backup_file = script_dir.parent / 'data' / 'afm-memorials.backup.json'
    
    print("="*80)
    print("AFM what3words Assignment")
    print("="*80)
    print("\nwhat3words Coverage:")
    print("  Panels 1-5:    ///woke.fastening.rinses")
    print("  Panels 6-10:   ///timeless.craziest.tasteful")
    print("  Panels 11-15:  ///doll.caravans.begun")
    print("  Panels 16-20:  ///vandalism.angle.copiers")
    print("  Panels 21-25:  ///ripe.decorated.risk")
    print("  Panels 26-30:  ///quaking.public.ranted")
    print("  Panels 31-35:  ///wrenching.directors.aliens")
    print("  Panels 36-40:  ///icon.scrubbing.survey")
    print("  Panels 41-45:  ///coil.initial.gourmet")
    print("  Panels 46-49:  ///outer.simulator.harder")
    print("  Panels 50-53:  ///salaried.waddled.clashes")
    print("  Panels 54-57:  ///condiment.irrigate.exhales")
    print("  Panels 58-61:  ///marathons.crispier.crystal")
    print("  Panels 62-65:  ///talkative.term.universes")
    print("  Panels 66-69:  ///feasted.residual.stitch")
    print("  Panels 70-73:  ///rosier.landscape.minds")
    print("  Panels 74-77:  ///upgrading.revolting.belong")
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
    
    # Assign what3words codes
    print("\nAssigning what3words codes...")
    w3w_counts = {}
    panels_with_codes = 0
    panels_without_codes = set()
    
    for entry in data:
        panel = entry.get('panel')
        w3w = get_what3words_code(panel)
        entry['what3words'] = w3w
        
        if w3w:
            w3w_counts[w3w] = w3w_counts.get(w3w, 0) + 1
            panels_with_codes += 1
        else:
            if panel:
                panels_without_codes.add(panel)
    
    # Save updated data
    print(f"\nSaving updated data to {json_file}...")
    with open(json_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    print("Done!")
    
    # Print statistics
    print("\n" + "="*80)
    print("what3words Assignment Summary:")
    print("="*80)
    
    print(f"\nEntries with what3words codes: {panels_with_codes}")
    print(f"Entries without what3words codes: {len(data) - panels_with_codes}")
    
    if panels_without_codes:
        print(f"\nPanels without what3words codes: {sorted(panels_without_codes)}")
        print(f"(Total: {len(panels_without_codes)} panels)")
    
    print(f"\nwhat3words codes assigned:")
    for w3w in sorted(w3w_counts.keys()):
        count = w3w_counts[w3w]
        print(f"  {w3w}: {count} entries")
    
    print("\n" + "="*80)
    print(f"Total entries processed: {len(data)}")
    print(f"Backup saved: {backup_file}")
    print("="*80)

if __name__ == '__main__':
    main()

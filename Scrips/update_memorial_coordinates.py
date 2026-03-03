"""
Update memorials.json with coordinates from tmp_data.txt
Handles duplicate entries in the source data
"""

import json
import re
from pathlib import Path

def parse_tmp_data(txt_file):
    """Parse the tmp_data.txt file and extract unique coordinates."""
    coordinates = {}
    
    with open(txt_file, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('---') or line.startswith('==='):
                continue
            
            # Split by whitespace and filter empty strings
            parts = [p for p in line.split() if p]
            
            # Should have at least 3 parts: name(s), lat, lng
            if len(parts) >= 3:
                # Last two should be numbers (lat, lng)
                try:
                    lng = float(parts[-1])
                    lat = float(parts[-2])
                    
                    # Everything before the last two numbers is the name
                    name = ' '.join(parts[:-2])
                    
                    # Remove .HEIC extension if present
                    if name.endswith('.HEIC'):
                        name = name[:-5]
                    
                    # Store coordinates (duplicates will just overwrite with same values)
                    coordinates[name] = {'lat': lat, 'lng': lng}
                except ValueError:
                    # Not a valid coordinate line
                    continue
    
    return coordinates

def normalize_name(name):
    """Normalize memorial name for matching."""
    # Remove common punctuation variations
    normalized = name.strip()
    # Handle special cases
    normalized = normalized.replace('  ', ' ')
    return normalized

def update_memorials(json_file, coordinates):
    """Update memorials.json with coordinates."""
    with open(json_file, 'r', encoding='utf-8') as f:
        memorials = json.load(f)
    
    updated_count = 0
    not_found = []
    
    for memorial in memorials:
        memorial_name = memorial.get('name', '')
        current_lat = memorial.get('lat', '')
        current_lng = memorial.get('lng', '')
        
        # Skip if already has coordinates
        if current_lat and current_lng and current_lat != "" and current_lng != "":
            continue
        
        # Try to find matching coordinates
        found = False
        for coord_name, coords in coordinates.items():
            # Try exact match or close match
            if (normalize_name(coord_name) == normalize_name(memorial_name) or
                normalize_name(coord_name) in normalize_name(memorial_name) or
                normalize_name(memorial_name) in normalize_name(coord_name)):
                
                memorial['lat'] = coords['lat']
                memorial['lng'] = coords['lng']
                
                # Also update location object if it exists
                if 'location' in memorial:
                    memorial['location']['lat'] = coords['lat']
                    memorial['location']['lng'] = coords['lng']
                else:
                    memorial['location'] = {
                        'lat': coords['lat'],
                        'lng': coords['lng']
                    }
                
                print(f"✓ Updated: {memorial_name}")
                updated_count += 1
                found = True
                break
        
        if not found and (not current_lat or current_lat == ""):
            not_found.append(memorial_name)
    
    # Save updated memorials
    with open(json_file, 'w', encoding='utf-8') as f:
        json.dump(memorials, f, indent=2, ensure_ascii=False)
    
    return updated_count, not_found

def main():
    # File paths
    script_dir = Path(__file__).parent.parent
    txt_file = script_dir / 'data' / 'tmp_data.txt'
    json_file = script_dir / 'data' / 'memorials.json'
    
    print("=" * 80)
    print("Updating memorials.json with coordinates from tmp_data.txt")
    print("=" * 80)
    print()
    
    # Parse coordinates from txt file
    print("Reading tmp_data.txt...")
    coordinates = parse_tmp_data(txt_file)
    print(f"Found {len(coordinates)} unique memorials with coordinates\n")
    
    # Update memorials.json
    print("Updating memorials.json...")
    print()
    updated_count, not_found = update_memorials(json_file, coordinates)
    
    print()
    print("=" * 80)
    print(f"Summary: Updated {updated_count} memorials")
    
    if not_found:
        print(f"\nMemorials still missing coordinates ({len(not_found)}):")
        for name in not_found[:10]:  # Show first 10
            print(f"  - {name}")
        if len(not_found) > 10:
            print(f"  ... and {len(not_found) - 10} more")
    else:
        print("\nAll memorials now have coordinates!")
    
    print("=" * 80)

if __name__ == "__main__":
    main()

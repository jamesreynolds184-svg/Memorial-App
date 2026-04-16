import json
import os
from pathlib import Path

def check_missing_images():
    # Load memorials data
    with open('data/memorials.json', 'r', encoding='utf-8') as f:
        memorials = json.load(f)
    
    print(f"Total memorials: {len(memorials)}")
    print("=" * 80)
    
    missing_images = []
    found_images = []
    
    for memorial in memorials:
        name = memorial.get('name', '')
        zone = memorial.get('zone', '')
        
        if not zone:
            print(f"⚠️  No zone specified for: {name}")
            continue
        
        # Construct expected image path
        image_path = Path(f"img/zone{zone}/{name}.jpeg")
        
        if image_path.exists():
            found_images.append({
                'name': name,
                'zone': zone,
                'path': str(image_path)
            })
        else:
            missing_images.append({
                'name': name,
                'zone': zone,
                'expected_path': str(image_path)
            })
    
    # Print results
    print(f"\n✓ Found images: {len(found_images)}")
    print(f"✗ Missing images: {len(missing_images)}")
    print("=" * 80)
    
    if missing_images:
        print("\n🔍 MISSING IMAGES:\n")
        for item in missing_images:
            print(f"  Zone {item['zone']}: {item['name']}")
            print(f"    Expected: {item['expected_path']}\n")
    
    # Save report to file
    with open('missing_images_report.txt', 'w', encoding='utf-8') as f:
        f.write(f"Missing Images Report\n")
        f.write(f"Generated: {Path.cwd()}\n")
        f.write(f"Total memorials: {len(memorials)}\n")
        f.write(f"Found images: {len(found_images)}\n")
        f.write(f"Missing images: {len(missing_images)}\n")
        f.write("=" * 80 + "\n\n")
        
        if missing_images:
            f.write("MISSING IMAGES:\n\n")
            for item in missing_images:
                f.write(f"Zone {item['zone']}: {item['name']}\n")
                f.write(f"  Expected: {item['expected_path']}\n\n")
        
        if found_images:
            f.write("\n" + "=" * 80 + "\n\n")
            f.write("FOUND IMAGES:\n\n")
            for item in found_images:
                f.write(f"Zone {item['zone']}: {item['name']}\n")
                f.write(f"  Path: {item['path']}\n\n")
    
    print(f"\n📄 Full report saved to: missing_images_report.txt")
    
    # Summary by zone
    print("\n📊 SUMMARY BY ZONE:")
    print("=" * 80)
    zones = {}
    for item in missing_images:
        zone = item['zone']
        if zone not in zones:
            zones[zone] = 0
        zones[zone] += 1
    
    for zone in sorted(zones.keys(), key=lambda x: int(x) if x.isdigit() else 999):
        print(f"  Zone {zone}: {zones[zone]} missing")

if __name__ == "__main__":
    check_missing_images()

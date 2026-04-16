import json
import os
from pathlib import Path
from urllib.parse import quote

def check_images():
    """Check for missing images considering URL encoding issues"""
    
    # Load memorials data
    with open('data/memorials.json', 'r', encoding='utf-8') as f:
        memorials = json.load(f)
    
    print(f"Total memorials: {len(memorials)}\n")
    
    missing_images = []
    found_images = []
    encoding_issues = []
    
    for memorial in memorials:
        name = memorial.get('name', '')
        zone = memorial.get('zone', '')
        
        if not zone or not name:
            continue
        
        # Check normal path (as files are named)
        normal_path = Path(f"img/zone{zone}/{name}.jpeg")
        
        # Check URL-encoded path (as JavaScript would construct it)
        encoded_name = quote(name)
        encoded_path = Path(f"img/zone{zone}/{encoded_name}.jpeg")
        
        # Check if normal path exists
        if normal_path.exists():
            found_images.append({
                'name': name,
                'zone': zone,
                'path': str(normal_path)
            })
        elif encoded_path.exists():
            # File has encoded name (shouldn't happen but checking)
            encoding_issues.append({
                'name': name,
                'zone': zone,
                'normal_path': str(normal_path),
                'encoded_path': str(encoded_path),
                'issue': 'File has URL-encoded name'
            })
        else:
            # Check if name would be encoded differently
            if encoded_name != name:
                encoding_issues.append({
                    'name': name,
                    'zone': zone,
                    'normal_path': str(normal_path),
                    'encoded_name': encoded_name,
                    'issue': 'Name contains characters that would be URL-encoded'
                })
            
            missing_images.append({
                'name': name,
                'zone': zone,
                'expected_path': str(normal_path)
            })
    
    # Print results
    print(f"✓ Found images: {len(found_images)}")
    print(f"✗ Missing images: {len(missing_images)}")
    print(f"⚠️  Encoding issues: {len(encoding_issues)}")
    print("=" * 80)
    
    if encoding_issues:
        print("\n⚠️  POTENTIAL ENCODING ISSUES (iOS may fail to load these):\n")
        for item in encoding_issues:
            print(f"  Zone {item['zone']}: {item['name']}")
            print(f"    Issue: {item['issue']}")
            if 'encoded_name' in item:
                print(f"    Original: {item['name']}")
                print(f"    Encoded:  {item['encoded_name']}")
            print()
        
        # Save to file
        with open('encoding_issues_report.txt', 'w', encoding='utf-8') as f:
            f.write(f"Encoding Issues Report\n")
            f.write(f"=" * 80 + "\n\n")
            f.write(f"Total memorials with encoding issues: {len(encoding_issues)}\n\n")
            for item in encoding_issues:
                f.write(f"Zone {item['zone']}: {item['name']}\n")
                f.write(f"  Issue: {item['issue']}\n")
                if 'encoded_name' in item:
                    f.write(f"  Normal path: {item['normal_path']}\n")
                    f.write(f"  Encoded name: {item['encoded_name']}\n")
                f.write("\n")
        print(f"\nReport saved to: encoding_issues_report.txt")
    
    if missing_images:
        print(f"\n✗ MISSING IMAGES ({len(missing_images)}):\n")
        for item in missing_images[:10]:
            print(f"  Zone {item['zone']}: {item['name']}")
            print(f"    Expected: {item['expected_path']}\n")

if __name__ == '__main__':
    check_images()

import json
from urllib.parse import quote

def find_encoding_affected_memorials():
    """Find memorials whose names would be encoded differently by encodeURIComponent"""
    
    # Load memorials data
    with open('data/memorials.json', 'r', encoding='utf-8') as f:
        memorials = json.load(f)
    
    affected = []
    
    # Characters that encodeURIComponent encodes (but are valid in filenames):
    # Space, !, ', (, ), *, ;, :, @, &, =, +, $, ,, /, ?, #, [, ]
    
    for memorial in memorials:
        name = memorial.get('name', '')
        zone = memorial.get('zone', '')
        
        if not name:
            continue
        
        # URL encode the name (equivalent to JavaScript's encodeURIComponent)
        encoded_name = quote(name, safe='')
        
        # Check if encoding changes the name
        if encoded_name != name:
            affected.append({
                'name': name,
                'zone': zone,
                'encoded': encoded_name,
                'affected_chars': [c for c in name if quote(c, safe='') != c]
            })
    
    print(f"Total memorials: {len(memorials)}")
    print(f"Memorials affected by URL encoding: {len(affected)}")
    print("=" * 80)
    
    if affected:
        print("\nMEMORIALS AFFECTED BY encodeURIComponent():\n")
        print("These will FAIL on iOS because the JavaScript encodes the path")
        print("but the actual file has the unencoded name.\n")
        
        for item in affected[:50]:  # Show first 50
            print(f"Zone {item['zone']}: {item['name']}")
            print(f"  Original:      {item['name']}")
            print(f"  Encoded:       {item['encoded']}")
            print(f"  Affected chars: {set(item['affected_chars'])}")
            print()
        
        # Save full report
        with open('ios_encoding_problem_report.txt', 'w', encoding='utf-8') as f:
            f.write("iOS Image Loading Issue - URL Encoding Problem\n")
            f.write("=" * 80 + "\n\n")
            f.write(f"Total memorials affected: {len(affected)}\n\n")
            f.write("PROBLEM:\n")
            f.write("The JavaScript code uses encodeURIComponent() to build image paths,\n")
            f.write("but the actual image files have unencoded names. This works on Windows\n")
            f.write("because the file system is forgiving, but fails on iOS.\n\n")
            f.write("SOLUTION:\n")
            f.write("Remove encodeURIComponent() from image path construction in:\n")
            f.write("  - js/memorial.js\n")
            f.write("  - js/identify-memorial.js\n\n")
            f.write("=" * 80 + "\n\n")
            
            for item in affected:
                f.write(f"Zone {item['zone']}: {item['name']}\n")
                f.write(f"  Encoded as: {item['encoded']}\n\n")
        
        print(f"\nFull report saved to: ios_encoding_problem_report.txt")
    else:
        print("\nNo encoding issues found.")

if __name__ == '__main__':
    find_encoding_affected_memorials()

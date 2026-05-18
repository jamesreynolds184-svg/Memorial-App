import json
from pathlib import Path

def add_ids_to_memorials():
    """Add ID field to each memorial in memorials.json"""
    
    json_file = "data/memorials.json"
    backup_file = "data/memorials_backup.json"
    
    print("Loading memorials data...")
    with open(json_file, "r", encoding="utf-8") as f:
        memorials = json.load(f)
    
    print(f"Found {len(memorials)} memorials")
    
    # Create backup
    print(f"Creating backup at {backup_file}...")
    with open(backup_file, "w", encoding="utf-8") as f:
        json.dump(memorials, f, indent=2, ensure_ascii=False)
    
    # Add ID to each memorial
    print("Adding IDs to memorials...")
    for index, memorial in enumerate(memorials):
        memorial["id"] = f"{index:03d}"
    
    # Save updated JSON
    print(f"Saving updated data to {json_file}...")
    with open(json_file, "w", encoding="utf-8") as f:
        json.dump(memorials, f, indent=2, ensure_ascii=False)
    
    print(f"\n✓ Complete! Added IDs to {len(memorials)} memorials")
    print(f"✓ Backup saved at {backup_file}")
    print(f"\nSample IDs added:")
    for i in range(min(5, len(memorials))):
        print(f"  {memorials[i]['id']}: {memorials[i]['name']}")
    if len(memorials) > 5:
        print(f"  ...")
        print(f"  {memorials[-1]['id']}: {memorials[-1]['name']}")

if __name__ == "__main__":
    add_ids_to_memorials()

import json

def count_characters():
    """Count total characters in all memorial names and descriptions"""
    
    print("Loading memorials data...")
    with open("data/memorials.json", "r", encoding="utf-8") as f:
        memorials = json.load(f)
    
    print(f"Total memorials: {len(memorials)}\n")
    
    total_chars = 0
    total_names_chars = 0
    total_descriptions_chars = 0
    total_with_newlines_removed = 0
    
    for memorial in memorials:
        name = memorial.get("name", "")
        description = memorial.get("description", "")
        
        # Count with original formatting
        total_names_chars += len(name)
        total_descriptions_chars += len(description)
        total_chars += len(name) + len(description)
        
        # Count with newlines removed (as they will be sent to API)
        name_cleaned = name.replace("\n", " ").replace("  ", " ").strip()
        description_cleaned = description.replace("\n", " ").replace("  ", " ").strip()
        total_with_newlines_removed += len(name_cleaned) + len(description_cleaned)
    
    # Add separators (". " between name and description for each memorial)
    # That's 2 characters per memorial
    total_with_separators = total_with_newlines_removed + (len(memorials) * 2)
    
    print("=" * 60)
    print("CHARACTER COUNT SUMMARY")
    print("=" * 60)
    print(f"\nOriginal text (with newlines):")
    print(f"  Names only:        {total_names_chars:,} characters")
    print(f"  Descriptions only: {total_descriptions_chars:,} characters")
    print(f"  Total:             {total_chars:,} characters")
    
    print(f"\nCleaned text (newlines removed, as sent to API):")
    print(f"  Text only:         {total_with_newlines_removed:,} characters")
    print(f"  With separators:   {total_with_separators:,} characters")
    
    print("\n" + "=" * 60)
    print("COST ESTIMATES (approximate)")
    print("=" * 60)
    
    # ElevenLabs pricing (as of typical rates - user should verify current pricing)
    # These are example rates and may vary
    print(f"\nTotal characters to process: {total_with_separators:,}")
    print("\nNote: Check ElevenLabs current pricing for accurate cost.")
    print("Typical pricing might be around $0.30 per 1,000 characters")
    print(f"Estimated cost: ${(total_with_separators / 1000) * 0.30:.2f}")
    
    # Show sample breakdown
    print("\n" + "=" * 60)
    print("SAMPLE BREAKDOWN (first 5 memorials)")
    print("=" * 60)
    
    for i in range(min(5, len(memorials))):
        memorial = memorials[i]
        name = memorial.get("name", "")
        description = memorial.get("description", "")
        
        name_cleaned = name.replace("\n", " ").replace("  ", " ").strip()
        description_cleaned = description.replace("\n", " ").replace("  ", " ").strip()
        
        total_memorial_chars = len(name_cleaned) + len(description_cleaned) + 2
        
        print(f"\n{i:03d}: {name[:50]}{'...' if len(name) > 50 else ''}")
        print(f"     Name: {len(name_cleaned)} chars | Desc: {len(description_cleaned)} chars | Total: {total_memorial_chars} chars")

if __name__ == "__main__":
    count_characters()

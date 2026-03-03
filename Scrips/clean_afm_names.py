import json
import re
from pathlib import Path

def clean_name(name):
    """
    Clean OCR errors from names while preserving legitimate characters.
    """
    original = name
    
    # Remove bullet points (•)
    name = name.replace('•', '')
    
    # Remove asterisks (usually at start)
    name = name.replace('*', '')
    
    # Remove colons (usually at end)
    name = name.replace(':', '')
    
    # Remove exclamation marks
    name = name.replace('!', '')
    
    # Remove quotes
    name = name.replace('"', '')
    name = name.replace('"', '')
    name = name.replace('"', '')
    
    # Remove plus signs
    name = name.replace('+', '')
    
    # Remove BOM (Byte Order Mark) characters
    name = name.replace('\ufeff', '')
    
    # Remove degree symbols
    name = name.replace('°', '')
    
    # Remove commas (OCR error in names like "BRITTON,P")
    name = name.replace(',', ' ')
    
    # Replace special/non-breaking spaces with regular spaces
    name = name.replace('\xa0', ' ')  # Non-breaking space
    name = name.replace('\u200b', '')  # Zero-width space
    name = re.sub(r'[\u2000-\u200f\u202f\u205f]', ' ', name)  # Various Unicode spaces
    
    # Convert accented characters to regular ones (OCR errors)
    replacements = {
        'Á': 'A', 'À': 'A', 'Ä': 'A', 'Â': 'A',
        'É': 'E', 'È': 'E', 'Ë': 'E', 'Ê': 'E',
        'Í': 'I', 'Ì': 'I', 'Ï': 'I', 'Î': 'I',
        'Ó': 'O', 'Ò': 'O', 'Ö': 'O', 'Ô': 'O',
        'Ú': 'U', 'Ù': 'U', 'Ü': 'U', 'Û': 'U', 'Ư': 'U',
        'Ç': 'C', 'Ñ': 'N'
    }
    for accented, regular in replacements.items():
        name = name.replace(accented, regular)
    
    # Normalize "& Bar" and "&Bar" spacing in military honors
    name = re.sub(r'&\s*Bar', '& Bar', name)
    name = re.sub(r'&\s*(\d+)\s*Bar', r'& \1 Bar', name)  # "DFC&2 Bars" -> "DFC & 2 Bars"
    
    # Remove standalone numbers at the end (likely OCR errors)
    # But keep numbers that are part of military honors like "& 2 Bars"
    name = re.sub(r'\s+\d{1,3}$', '', name)  # Remove trailing numbers like " 595"
    
    # Remove multiple spaces
    name = re.sub(r'\s+', ' ', name)
    
    # Trim whitespace
    name = name.strip()
    
    return name

def main():
    # Define paths
    script_dir = Path(__file__).parent
    json_file = script_dir.parent / 'data' / 'afm-memorials.json'
    backup_file = script_dir.parent / 'data' / 'afm-memorials.backup.json'
    
    print("="*80)
    print("AFM Names Cleaner - Removing OCR Errors")
    print("="*80)
    
    # Load the JSON data
    print(f"\nLoading data from {json_file}...")
    with open(json_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    print(f"Loaded {len(data)} entries")
    
    # Create backup
    print(f"\nCreating backup at {backup_file}...")
    with open(backup_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print("Backup created successfully")
    
    # Clean names
    print("\nCleaning names...")
    changes_made = 0
    
    for entry in data:
        original_name = entry['name']
        cleaned_name = clean_name(original_name)
        
        if original_name != cleaned_name:
            entry['name'] = cleaned_name
            changes_made += 1
            print(f"  {original_name} -> {cleaned_name}")
    
    print(f"\nTotal changes made: {changes_made}")
    
    # Save cleaned data
    print(f"\nSaving cleaned data to {json_file}...")
    with open(json_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    print("Done!")
    print("\n" + "="*80)
    print("Summary:")
    print(f"  - Total entries: {len(data)}")
    print(f"  - Names cleaned: {changes_made}")
    print(f"  - Backup saved: {backup_file}")
    print("="*80)

if __name__ == '__main__':
    main()

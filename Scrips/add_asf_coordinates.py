"""
Add GPS coordinates from JPG/HEIC images to Allied Special Forces JSON database.
Matches image filenames to plaque names and extracts coordinates.
"""

import os
import sys
import json
from pathlib import Path

try:
    from PIL import Image
    try:
        from pillow_heif import register_heif_opener
        register_heif_opener()
    except ImportError:
        pass  # HEIF support optional
except ImportError:
    print("Required libraries not found. Please install them using:")
    print("pip install pillow")
    sys.exit(1)


def get_decimal_coordinates(gps_info):
    """
    Convert GPS coordinates from EXIF format to decimal degrees.
    
    Args:
        gps_info: Dictionary containing GPS EXIF data
        
    Returns:
        tuple: (latitude, longitude) in decimal degrees, or (None, None) if not available
    """
    def convert_to_degrees(value):
        """Convert GPS coordinates to degrees in float format."""
        d, m, s = value
        return d + (m / 60.0) + (s / 3600.0)
    
    try:
        # Get latitude
        lat = gps_info.get(2)  # GPSLatitude
        lat_ref = gps_info.get(1)  # GPSLatitudeRef (N or S)
        
        # Get longitude
        lon = gps_info.get(4)  # GPSLongitude
        lon_ref = gps_info.get(3)  # GPSLongitudeRef (E or W)
        
        if lat and lon and lat_ref and lon_ref:
            lat_decimal = convert_to_degrees(lat)
            if lat_ref == 'S':
                lat_decimal = -lat_decimal
                
            lon_decimal = convert_to_degrees(lon)
            if lon_ref == 'W':
                lon_decimal = -lon_decimal
                
            return lat_decimal, lon_decimal
    except Exception as e:
        print(f"Error converting coordinates: {e}")
    
    return None, None


def extract_coordinates_from_image(file_path):
    """
    Extract GPS coordinates from an image file (JPG or HEIC).
    
    Args:
        file_path: Path to the image file
        
    Returns:
        tuple: (latitude, longitude) or (None, None) if not available
    """
    try:
        image = Image.open(file_path)
        exif_data = image.getexif()
        
        if exif_data:
            # GPS Info is stored in tag 34853
            gps_info = exif_data.get_ifd(34853)
            
            if gps_info:
                return get_decimal_coordinates(gps_info)
            else:
                return None, None
        else:
            return None, None
            
    except Exception as e:
        print(f"Error reading {file_path}: {e}")
        return None, None


def find_matching_image(plaque_name, img_folder):
    """
    Find image file (JPG or HEIC) matching the plaque name.
    
    Args:
        plaque_name: Name of the plaque to match
        img_folder: Path to folder containing image files
        
    Returns:
        Path to matching image file or None
    """
    # Try exact matches with different extensions
    for ext in ['.jpg', '.JPG', '.HEIC', '.heic', '.jpeg', '.JPEG']:
        exact_match = img_folder / f"{plaque_name}{ext}"
        if exact_match.exists():
            return exact_match
    
    # Try case-insensitive match and handle special characters
    for img_file in img_folder.glob("*"):
        if img_file.suffix.lower() not in ['.jpg', '.jpeg', '.heic']:
            continue
            
        # Remove extension for comparison
        filename = img_file.stem
        
        # Handle quotes and special characters
        if filename.replace('"', '') == plaque_name.replace('"', ''):
            return img_file
        
        # Try without quotes
        if filename.replace('"', '').replace("'", '') == plaque_name.replace('"', '').replace("'", ''):
            return img_file
    
    return None


def main():
    """Main function to add coordinates to JSON."""
    # Paths
    script_dir = Path(__file__).parent
    json_file = script_dir.parent / 'data' / 'allied-special-forces.json'
    img_folder = script_dir.parent / 'img' / 'ASF'
    
    # Read JSON file
    print(f"Reading JSON from: {json_file}")
    with open(json_file, 'r', encoding='utf-8') as f:
        memorials = json.load(f)
    
    # Process each memorial
    matched = 0
    with_coords = 0
    without_coords = 0
    
    for memorial in memorials:
        plaque_name = memorial['plaque']
        
        # Find matching image file
        img_file = find_matching_image(plaque_name, img_folder)
        
        if img_file:
            matched += 1
            print(f"Found image for: {plaque_name}")
            
            # Extract coordinates
            lat, lng = extract_coordinates_from_image(img_file)
            
            if lat is not None and lng is not None:
                memorial['location'] = {
                    'lat': round(lat, 6),
                    'lng': round(lng, 6)
                }
                with_coords += 1
                print(f"  ✓ Coordinates: {lat:.6f}, {lng:.6f}")
            else:
                without_coords += 1
                print(f"  ✗ No GPS data in image")
        else:
            print(f"No image found for: {plaque_name}")
    
    # Write updated JSON
    print(f"\nWriting updated JSON to: {json_file}")
    with open(json_file, 'w', encoding='utf-8') as f:
        json.dump(memorials, f, indent=2, ensure_ascii=False)
    
    # Summary
    print("\n" + "="*50)
    print(f"Total memorials: {len(memorials)}")
    print(f"Images matched: {matched}")
    print(f"Coordinates extracted: {with_coords}")
    print(f"Images without GPS data: {without_coords}")
    print(f"Images not found: {len(memorials) - matched}")
    print("="*50)


if __name__ == "__main__":
    main()

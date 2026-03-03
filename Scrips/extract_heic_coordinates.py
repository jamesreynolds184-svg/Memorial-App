"""
Extract GPS coordinates from HEIC images in a folder.
This script reads all HEIC files in the current directory and extracts
their latitude and longitude coordinates from EXIF data.
"""

import os
import sys
from pathlib import Path

try:
    from PIL import Image
    from pillow_heif import register_heif_opener
except ImportError:
    print("Required libraries not found. Please install them using:")
    print("pip install pillow pillow-heif")
    sys.exit(1)

# Register HEIF opener with Pillow
register_heif_opener()


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


def extract_coordinates_from_heic(file_path):
    """
    Extract GPS coordinates from a HEIC file.
    
    Args:
        file_path: Path to the HEIC file
        
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


def main():
    """Main function to process all HEIC files in the current directory."""
    # Get current directory or use provided path
    if len(sys.argv) > 1:
        folder_path = Path(sys.argv[1])
    else:
        folder_path = Path.cwd()
    
    if not folder_path.exists():
        print(f"Error: Folder '{folder_path}' does not exist.")
        sys.exit(1)
    
    print(f"Scanning for HEIC files in: {folder_path}\n")
    print("=" * 80)
    
    # Find all HEIC files (case-insensitive)
    heic_files = []
    for ext in ['*.heic', '*.HEIC', '*.heif', '*.HEIF']:
        heic_files.extend(folder_path.glob(ext))
    
    if not heic_files:
        print("No HEIC files found in the directory.")
        return
    
    print(f"Found {len(heic_files)} HEIC file(s)\n")
    
    # Process each file
    results = []
    for file_path in sorted(heic_files):
        lat, lon = extract_coordinates_from_heic(file_path)
        results.append((file_path.name, lat, lon))
    
    # Display results
    print(f"{'Filename':<40} {'Latitude':<15} {'Longitude':<15}")
    print("-" * 80)
    
    files_with_coords = 0
    for filename, lat, lon in results:
        if lat is not None and lon is not None:
            print(f"{filename:<40} {lat:<15.6f} {lon:<15.6f}")
            files_with_coords += 1
        else:
            print(f"{filename:<40} {'No GPS data':<15} {'No GPS data':<15}")
    
    print("=" * 80)
    print(f"\nSummary: {files_with_coords} out of {len(heic_files)} files have GPS coordinates")
    
    # Optionally save to CSV
    if files_with_coords > 0:
        save_csv = input("\nWould you like to save the results to a CSV file? (y/n): ")
        if save_csv.lower() == 'y':
            csv_path = folder_path / "heic_coordinates.csv"
            with open(csv_path, 'w') as f:
                f.write("Filename,Latitude,Longitude\n")
                for filename, lat, lon in results:
                    if lat is not None and lon is not None:
                        f.write(f"{filename},{lat},{lon}\n")
            print(f"Results saved to: {csv_path}")


if __name__ == "__main__":
    main()

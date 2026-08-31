"""
Convert all HEIC images in img/ASF/ to JPEG format.
Preserves EXIF data including GPS coordinates.
"""

import os
from pathlib import Path
from PIL import Image
import pillow_heif

def convert_heic_to_jpeg(source_dir, output_dir=None, quality=95):
    """
    Convert all HEIC files in source_dir to JPEG.
    
    Args:
        source_dir: Path to directory containing HEIC files
        output_dir: Optional output directory (defaults to source_dir)
        quality: JPEG quality (1-100, default 95)
    """
    source_path = Path(source_dir)
    if output_dir:
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)
    else:
        output_path = source_path
    
    # Get all HEIC files
    heic_files = list(source_path.glob('*.HEIC')) + list(source_path.glob('*.heic'))
    
    if not heic_files:
        print(f"No HEIC files found in {source_dir}")
        return
    
    print(f"Found {len(heic_files)} HEIC files to convert...")
    print(f"Output directory: {output_path}")
    print("-" * 50)
    
    converted = 0
    failed = 0
    
    for heic_file in heic_files:
        # Create output filename (same name, .jpg extension)
        jpeg_filename = heic_file.stem + '.jpg'
        jpeg_path = output_path / jpeg_filename
        
        try:
            # Open HEIC file
            heif_file = pillow_heif.open_heif(str(heic_file))
            
            # Convert to PIL Image
            image = Image.frombytes(
                heif_file.mode,
                heif_file.size,
                heif_file.data,
                "raw"
            )
            
            # Copy EXIF data if available
            exif_data = None
            if hasattr(heif_file, 'info') and 'exif' in heif_file.info:
                exif_data = heif_file.info['exif']
            
            # Save as JPEG
            if exif_data:
                image.save(jpeg_path, "JPEG", quality=quality, exif=exif_data)
            else:
                image.save(jpeg_path, "JPEG", quality=quality)
            
            converted += 1
            print(f"✓ Converted: {heic_file.name} -> {jpeg_filename}")
            
        except Exception as e:
            failed += 1
            print(f"✗ Failed: {heic_file.name} - {str(e)}")
    
    print("-" * 50)
    print(f"Conversion complete!")
    print(f"Successfully converted: {converted}")
    print(f"Failed: {failed}")
    print(f"Total: {len(heic_files)}")


if __name__ == "__main__":
    # Convert HEIC files in img/ASF/
    script_dir = Path(__file__).parent
    asf_dir = script_dir.parent / 'img' / 'ASF'
    
    print("HEIC to JPEG Converter for Allied Special Forces")
    print("=" * 50)
    
    if not asf_dir.exists():
        print(f"Error: Directory not found: {asf_dir}")
    else:
        convert_heic_to_jpeg(asf_dir)

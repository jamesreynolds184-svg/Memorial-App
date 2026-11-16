"""
Compress ASF images to reduce folder size from ~560MB.
Uses the same settings that were applied to the zone images
(see img/zone1): max 1080x1440, JPEG quality 85, optimized.
"""
import os
from PIL import Image

# Path to ASF images
ASF_FOLDER = '../img/ASF'

# Same compression settings used for the zone images
MAX_WIDTH = 1080
MAX_HEIGHT = 1440
QUALITY = 85

def compress_image(image_path):
    """
    Compress an image to fit within MAX_WIDTH x MAX_HEIGHT.
    Skips images already within the target dimensions.
    """
    try:
        with Image.open(image_path) as img:
            # Convert to RGB if needed (for PNG, RGBA, etc.)
            if img.mode in ('RGBA', 'LA', 'P'):
                img = img.convert('RGB')
            
            original_size = os.path.getsize(image_path)
            width, height = img.size

            # Skip if already within target dimensions
            if width <= MAX_WIDTH and height <= MAX_HEIGHT:
                print(f"- {os.path.basename(image_path)} skipped (already {width}x{height}, {original_size/1024:.1f}KB)")
                return original_size, original_size

            # Calculate new dimensions maintaining aspect ratio
            aspect = width / height
            if width > height:
                new_width = min(width, MAX_WIDTH)
                new_height = int(new_width / aspect)
            else:
                new_height = min(height, MAX_HEIGHT)
                new_width = int(new_height * aspect)
            
            # Only resize if image is larger than target
            if new_width < width or new_height < height:
                img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
            
            # Save with compression
            img.save(image_path, 'JPEG', quality=QUALITY, optimize=True)
            
            new_size = os.path.getsize(image_path)
            reduction = ((original_size - new_size) / original_size) * 100
            
            print(f"✓ {os.path.basename(image_path)}")
            print(f"  {width}x{height} → {new_width}x{new_height}")
            print(f"  {original_size/1024:.1f}KB → {new_size/1024:.1f}KB ({reduction:.1f}% reduction)")
            
            return original_size, new_size
            
    except Exception as e:
        print(f"✗ Error with {os.path.basename(image_path)}: {e}")
        return 0, 0

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    asf_path = os.path.join(script_dir, ASF_FOLDER)
    
    if not os.path.exists(asf_path):
        print(f"Error: ASF folder not found at {asf_path}")
        return
    
    # Find all JPG/JPEG files
    image_files = []
    for ext in ['.jpg', '.jpeg', '.JPG', '.JPEG']:
        image_files.extend([f for f in os.listdir(asf_path) if f.endswith(ext)])
    
    if not image_files:
        print("No JPEG images found in ASF folder")
        return
    
    print(f"Found {len(image_files)} images in ASF folder")
    print(f"Target: Max {MAX_WIDTH}x{MAX_HEIGHT}, Quality {QUALITY}\n")
    
    total_original = 0
    total_new = 0
    
    for img_file in sorted(image_files):
        img_path = os.path.join(asf_path, img_file)
        orig, new = compress_image(img_path)
        total_original += orig
        total_new += new
        print()
    
    print("=" * 60)
    print(f"Original total size: {total_original / (1024*1024):.2f} MB")
    print(f"New total size:      {total_new / (1024*1024):.2f} MB")
    print(f"Total reduction:     {((total_original - total_new) / total_original) * 100:.1f}%")
    print(f"Average per image:   {total_new / len(image_files) / 1024:.1f} KB")
    print("=" * 60)

if __name__ == '__main__':
    main()

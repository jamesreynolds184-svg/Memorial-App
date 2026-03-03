import os
from PIL import Image
import argparse

# Target dimensions
TARGET_WIDTH = 1080
TARGET_HEIGHT = 1440

def get_resized_dimensions(width, height, target_width, target_height):
    """
    Calculate new dimensions while maintaining aspect ratio.
    The image will fit within target_width x target_height.
    """
    # Calculate aspect ratios
    img_aspect = width / height
    target_aspect = target_width / target_height
    
    if img_aspect > target_aspect:
        # Width is the limiting factor
        new_width = target_width
        new_height = int(target_width / img_aspect)
    else:
        # Height is the limiting factor
        new_height = target_height
        new_width = int(target_height * img_aspect)
    
    return new_width, new_height

def should_compress(width, height, target_width, target_height):
    """
    Check if the image needs to be compressed.
    Returns True if image is larger than target dimensions.
    """
    return width > target_width or height > target_height

def compress_image(image_path, target_width, target_height):
    """
    Compress a single image to fit within target dimensions.
    """
    try:
        with Image.open(image_path) as img:
            width, height = img.size
            
            # Check if compression is needed
            if not should_compress(width, height, target_width, target_height):
                print(f"  ⏭️  Skipped (already {width}x{height}): {os.path.basename(image_path)}")
                return False
            
            # Calculate new dimensions
            new_width, new_height = get_resized_dimensions(width, height, target_width, target_height)
            
            # Resize the image
            img_resized = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
            
            # Save with high quality
            img_resized.save(image_path, 'JPEG', quality=85, optimize=True)
            
            print(f"  ✓ Compressed {width}x{height} → {new_width}x{new_height}: {os.path.basename(image_path)}")
            return True
            
    except Exception as e:
        print(f"  ✗ Error processing {os.path.basename(image_path)}: {str(e)}")
        return False

def compress_images_in_folder(folder_path, target_width=TARGET_WIDTH, target_height=TARGET_HEIGHT):
    """
    Compress all JPEG images in the specified folder.
    """
    if not os.path.exists(folder_path):
        print(f"Error: Path '{folder_path}' does not exist.")
        return
    
    if not os.path.isdir(folder_path):
        print(f"Error: '{folder_path}' is not a directory.")
        return
    
    # Find all JPEG files
    jpeg_extensions = {'.jpg', '.jpeg', '.JPG', '.JPEG'}
    image_files = [
        f for f in os.listdir(folder_path)
        if os.path.isfile(os.path.join(folder_path, f)) and 
        os.path.splitext(f)[1] in jpeg_extensions
    ]
    
    if not image_files:
        print(f"No JPEG files found in '{folder_path}'")
        return
    
    print(f"\nFound {len(image_files)} JPEG file(s) in '{folder_path}'")
    print(f"Target dimensions: {target_width}x{target_height}\n")
    
    compressed_count = 0
    skipped_count = 0
    error_count = 0
    
    for image_file in image_files:
        image_path = os.path.join(folder_path, image_file)
        result = compress_image(image_path, target_width, target_height)
        
        if result is True:
            compressed_count += 1
        elif result is False:
            skipped_count += 1
        else:
            error_count += 1
    
    print(f"\n{'='*60}")
    print(f"Summary:")
    print(f"  Compressed: {compressed_count}")
    print(f"  Skipped: {skipped_count}")
    print(f"  Errors: {error_count}")
    print(f"{'='*60}\n")

def main():
    parser = argparse.ArgumentParser(
        description='Compress JPEG images to fit within specified dimensions.',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python "image compressor.py" "C:\\path\\to\\images"
  python "image compressor.py" "C:\\path\\to\\images" --width 1920 --height 1080
        """
    )
    
    parser.add_argument(
        'path',
        type=str,
        help='Path to the folder containing JPEG images'
    )
    
    parser.add_argument(
        '--width',
        type=int,
        default=TARGET_WIDTH,
        help=f'Target width (default: {TARGET_WIDTH})'
    )
    
    parser.add_argument(
        '--height',
        type=int,
        default=TARGET_HEIGHT,
        help=f'Target height (default: {TARGET_HEIGHT})'
    )
    
    args = parser.parse_args()
    
    compress_images_in_folder(args.path, args.width, args.height)

if __name__ == "__main__":
    main()

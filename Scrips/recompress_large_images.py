"""
Re-compress only the largest JPEG images in img/ to bring the total folder
size down. Files over SIZE_THRESHOLD_KB are resized to fit MAX_WIDTH x
MAX_HEIGHT (keeping aspect ratio) and re-saved at JPEG quality 85; the
smaller result is kept only if it actually shrinks the file. Files already
small are left bit-identical.
"""
import os
from io import BytesIO
from PIL import Image

IMG_FOLDER = '../img'
SIZE_THRESHOLD_KB = 400
MAX_WIDTH = 900
MAX_HEIGHT = 1200
QUALITY = 85

def recompress(image_path):
    try:
        original_size = os.path.getsize(image_path)
        with Image.open(image_path) as img:
            if img.mode in ('RGBA', 'LA', 'P'):
                img = img.convert('RGB')

            width, height = img.size
            if width > MAX_WIDTH or height > MAX_HEIGHT:
                aspect = width / height
                if width > height:
                    new_width = min(width, MAX_WIDTH)
                    new_height = int(new_width / aspect)
                else:
                    new_height = min(height, MAX_HEIGHT)
                    new_width = int(new_height * aspect)
                img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)

            buf = BytesIO()
            img.save(buf, 'JPEG', quality=QUALITY, optimize=True)

        new_size = buf.tell()
        if new_size < original_size:
            with open(image_path, 'wb') as f:
                f.write(buf.getvalue())
            print(f"✓ {image_path}: {width}x{height} @ {original_size/1024:.0f}KB → {new_size/1024:.0f}KB")
            return original_size, new_size
        else:
            print(f"- {image_path}: kept original ({original_size/1024:.0f}KB, re-encode was {new_size/1024:.0f}KB)")
            return original_size, original_size
    except Exception as e:
        print(f"✗ Error with {image_path}: {e}")
        return 0, 0

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    img_path = os.path.join(script_dir, IMG_FOLDER)

    targets = []
    for root, _, files in os.walk(img_path):
        for f in files:
            if f.lower().endswith(('.jpg', '.jpeg')):
                p = os.path.join(root, f)
                if os.path.getsize(p) > SIZE_THRESHOLD_KB * 1024:
                    targets.append(p)

    print(f"Found {len(targets)} images over {SIZE_THRESHOLD_KB}KB, re-encoding at quality {QUALITY}\n")

    total_orig = 0
    total_new = 0
    for p in sorted(targets):
        orig, new = recompress(p)
        total_orig += orig
        total_new += new

    print("=" * 60)
    print(f"Processed:      {len(targets)} files")
    print(f"Original total: {total_orig / (1024*1024):.1f} MB")
    print(f"New total:      {total_new / (1024*1024):.1f} MB")
    print(f"Saved:          {(total_orig - total_new) / (1024*1024):.1f} MB")
    print("=" * 60)

if __name__ == '__main__':
    main()

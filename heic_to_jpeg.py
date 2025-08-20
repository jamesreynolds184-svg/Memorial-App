import os
from PIL import Image
import pillow_heif

def convert_heic_to_jpeg(directory):
    for filename in os.listdir(directory):
        if filename.lower().endswith('.heic'):
            heic_path = os.path.join(directory, filename)
            jpeg_path = os.path.splitext(heic_path)[0] + '.jpeg'
            try:
                heif_file = pillow_heif.open_heif(heic_path)
                image = Image.frombytes(
                    heif_file.mode,
                    heif_file.size,
                    heif_file.data,
                    "raw"
                )
                image.save(jpeg_path, "JPEG")
                print(f"Converted: {filename} -> {os.path.basename(jpeg_path)}")
            except Exception as e:
                print(f"Skipped {filename}: {e}")

if __name__ == "__main__":
    convert_heic_to_jpeg(os.path.dirname(os.path.abspath(__file__)))
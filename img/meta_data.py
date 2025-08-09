import os
import csv
from PIL import Image
from PIL.ExifTags import TAGS

image_folder = os.path.dirname(os.path.abspath(__file__))
output_csv = os.path.join(image_folder, 'image_metadata.csv')

def extract_metadata(image_path):
    metadata = {}
    try:
        image = Image.open(image_path)
        exif_data = image._getexif()
        if exif_data:
            for tag_id, value in exif_data.items():
                tag = TAGS.get(tag_id, tag_id)
                metadata[tag] = value
        metadata['Image Size'] = image.size
        metadata['Format'] = image.format
    except Exception as e:
        metadata['Error'] = str(e)
    return metadata

# Collect all metadata first to build a complete header
all_metadata = []
fieldnames = set(['Filename'])  # Start with filename

for filename in os.listdir(image_folder):
    if filename.lower().endswith(('.jpg', '.jpeg')):
        path = os.path.join(image_folder, filename)
        meta = extract_metadata(path)
        meta['Filename'] = filename
        all_metadata.append(meta)
        fieldnames.update(meta.keys())

# Write to CSV
with open(output_csv, mode='w', newline='', encoding='utf-8') as file:
    writer = csv.DictWriter(file, fieldnames=sorted(fieldnames))
    writer.writeheader()
    for meta in all_metadata:
        writer.writerow(meta)

print(f"✅ All {len(all_metadata)} images processed. Metadata saved to: {output_csv}")
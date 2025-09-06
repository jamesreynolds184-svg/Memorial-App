import pandas as pd
import re

# Load your metadata file
df = pd.read_csv("metadata.csv")

# Function to convert DMS to decimal
def dms_to_decimal(dms_str, ref):
    match = re.match(r"(\d+)\s+deg\s+(\d+)'[\s]*([\d.]+)\"", str(dms_str))
    if not match:
        return None
    degrees, minutes, seconds = map(float, match.groups())
    decimal = degrees + minutes / 60 + seconds / 3600
    if ref[0].upper() in ["S", "W"]:
        decimal = -decimal
    return decimal

# Build new DataFrame
new_df = pd.DataFrame()
new_df["Name"] = df["SourceFile"]
new_df["Latitude"] = [dms_to_decimal(lat, ref) for lat, ref in zip(df["GPSLatitude"], df["GPSLatitudeRef"])]
new_df["Longitude"] = [dms_to_decimal(lon, ref) for lon, ref in zip(df["GPSLongitude"], df["GPSLongitudeRef"])]

# Save cleaned CSV
new_df.to_csv("metadata_clean.csv", index=False)
print("✅ Saved as metadata_clean.csv")

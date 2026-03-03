import json
import numpy as np

# Load existing pins
with open('../data/AFM-Panels/AFM-Panel-A.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# Extract all coordinates
coords = []
for feature in data['features']:
    lon, lat = feature['geometry']['coordinates']
    coords.append([lon, lat])

coords = np.array(coords)

# Find the center and radius of the semi-circle
# Use the mean as an approximate center
center_lon = np.mean(coords[:, 0])
center_lat = np.mean(coords[:, 1])

# Calculate distances from center to find radius
distances = np.sqrt((coords[:, 0] - center_lon)**2 + (coords[:, 1] - center_lat)**2)
avg_radius = np.mean(distances)

# Find the angular span
angles = np.arctan2(coords[:, 1] - center_lat, coords[:, 0] - center_lon)
min_angle = np.min(angles)
max_angle = np.max(angles)

print(f"Center: ({center_lon}, {center_lat})")
print(f"Average radius: {avg_radius}")
print(f"Angular span: {np.degrees(min_angle):.1f}° to {np.degrees(max_angle):.1f}°")
print(f"Currently {len(coords)} pins")

# Generate 77 evenly-spaced points along the semi-circle
num_pins = 77
angles_new = np.linspace(min_angle, max_angle, num_pins)

new_features = []
for angle in angles_new:
    lon = center_lon + avg_radius * np.cos(angle)
    lat = center_lat + avg_radius * np.sin(angle)
    
    feature = {
        "type": "Feature",
        "properties": {},
        "geometry": {
            "coordinates": [lon, lat],
            "type": "Point"
        }
    }
    new_features.append(feature)

# Create new GeoJSON
new_data = {
    "type": "FeatureCollection",
    "features": new_features
}

# Save
with open('../data/AFM-Panels/AFM-Panel-A.json', 'w', encoding='utf-8') as f:
    json.dump(new_data, f, indent=2, ensure_ascii=False)

print(f"\nRedistributed to {num_pins} evenly-spaced pins along the semi-circle")

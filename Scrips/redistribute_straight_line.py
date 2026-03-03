import json
import numpy as np

# Load original pins
with open('../data/AFM-Wall-B.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# Extract coordinates
coords = []
for feature in data['features']:
    lon, lat = feature['geometry']['coordinates']
    coords.append([lon, lat])

print(f"Original pins: {len(coords)}")

# Get first and last pin
first_pin = np.array(coords[0])
last_pin = np.array(coords[-1])

print(f"First pin: {first_pin}")
print(f"Last pin: {last_pin}")

# Calculate distance
distance = np.linalg.norm(last_pin - first_pin)
print(f"Distance between first and last: {distance}")

# Generate 40 evenly spaced points along the line
num_pins = 40
t_values = np.linspace(0, 1, num_pins)

new_features = []
for t in t_values:
    lon = first_pin[0] + t * (last_pin[0] - first_pin[0])
    lat = first_pin[1] + t * (last_pin[1] - first_pin[1])
    
    feature = {
        "type": "Feature",
        "properties": {},
        "geometry": {
            "coordinates": [lon, lat],
            "type": "Point"
        }
    }
    new_features.append(feature)

# Verify the anchor points are preserved
print(f"\nVerification:")
print(f"First pin preserved: {np.allclose(new_features[0]['geometry']['coordinates'], first_pin, atol=1e-10)}")
print(f"Last pin preserved: {np.allclose(new_features[-1]['geometry']['coordinates'], last_pin, atol=1e-10)}")

# Create new GeoJSON
new_data = {
    "type": "FeatureCollection",
    "features": new_features
}

# Save
with open('../data/AFM-Wall-B.json', 'w', encoding='utf-8') as f:
    json.dump(new_data, f, indent=2, ensure_ascii=False)

print(f"\nSuccessfully created {num_pins} pins along straight line")
print(f"First pin: {new_features[0]['geometry']['coordinates']}")
print(f"Last pin: {new_features[-1]['geometry']['coordinates']}")
print(f"Spacing: {distance / (num_pins - 1)}")

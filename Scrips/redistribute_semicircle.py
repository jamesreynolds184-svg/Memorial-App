import json
import numpy as np

# Load original pins
with open('../data/AFM-Wall-A.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# Extract coordinates
coords = []
for feature in data['features']:
    lon, lat = feature['geometry']['coordinates']
    coords.append([lon, lat])

print(f"Original pins: {len(coords)}")

# Identify the 3 anchor points: first, middle, last
first_pin = np.array(coords[0])
middle_pin_original = np.array(coords[len(coords)//2])  # Middle of 92 is index 46
last_pin = np.array(coords[-1])

# Reduce arch height by 2 meters
# At ~52.7° latitude, 1 degree latitude ≈ 111km, so 2m ≈ 0.000018 degrees
# Move the middle pin down (reduce latitude) by 2 meters to flatten the arch
height_adjustment = 2 / 111000  # 2 meters in degrees latitude
middle_pin = middle_pin_original.copy()
middle_pin[1] -= height_adjustment  # Reduce latitude (move down)

print(f"First pin: {first_pin}")
print(f"Middle pin (original): {middle_pin_original}")
print(f"Middle pin (adjusted -2m): {middle_pin}")
print(f"Last pin: {last_pin}")

# Fit a circle through these 3 points to find center and radius
# Using the formula for circle through 3 points
def circle_from_three_points(p1, p2, p3):
    ax, ay = p1
    bx, by = p2
    cx, cy = p3
    
    d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by))
    if abs(d) < 1e-10:
        # Points are collinear, return None
        return None, None
    
    ux = ((ax**2 + ay**2) * (by - cy) + (bx**2 + by**2) * (cy - ay) + (cx**2 + cy**2) * (ay - by)) / d
    uy = ((ax**2 + ay**2) * (cx - bx) + (bx**2 + by**2) * (ax - cx) + (cx**2 + cy**2) * (bx - ax)) / d
    
    center = np.array([ux, uy])
    radius = np.linalg.norm(p1 - center)
    
    return center, radius

center, radius = circle_from_three_points(first_pin, middle_pin, last_pin)

print(f"\nCircle center: {center}")
print(f"Circle radius: {radius}")

# Calculate angles for the 3 anchor points
angle_first = np.arctan2(first_pin[1] - center[1], first_pin[0] - center[0])
angle_middle = np.arctan2(middle_pin[1] - center[1], middle_pin[0] - center[0])
angle_last = np.arctan2(last_pin[1] - center[1], last_pin[0] - center[0])

print(f"\nAngles:")
print(f"First: {np.degrees(angle_first):.2f}°")
print(f"Middle: {np.degrees(angle_middle):.2f}°")
print(f"Last: {np.degrees(angle_last):.2f}°")

# Generate 77 evenly spaced angles from first to last
num_pins = 77
angles = np.linspace(angle_first, angle_last, num_pins)

# Generate new coordinates
new_features = []
for angle in angles:
    lon = center[0] + radius * np.cos(angle)
    lat = center[1] + radius * np.sin(angle)
    
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
print(f"Middle pin (index 38) matches adjusted position: {np.linalg.norm(np.array(new_features[38]['geometry']['coordinates']) - middle_pin)}")
print(f"Last pin preserved: {np.allclose(new_features[76]['geometry']['coordinates'], last_pin, atol=1e-10)}")
print(f"Arch height reduced by: {height_adjustment * 111000:.2f}m")

# Create new GeoJSON
new_data = {
    "type": "FeatureCollection",
    "features": new_features
}

# Save
with open('../data/AFM-Wall-A.json', 'w', encoding='utf-8') as f:
    json.dump(new_data, f, indent=2, ensure_ascii=False)

print(f"\nSuccessfully created {num_pins} pins along semicircle")
print(f"First pin: {new_features[0]['geometry']['coordinates']}")
print(f"Middle pin (38): {new_features[38]['geometry']['coordinates']}")
print(f"Last pin: {new_features[76]['geometry']['coordinates']}")

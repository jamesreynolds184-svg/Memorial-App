import json
import csv
import math

# Load memorials data
with open('data/memorials.json', 'r', encoding='utf-8') as f:
    memorials = json.load(f)

# Load Pink Route list
with open('data/Pink_Route.csv', 'r', encoding='utf-8') as f:
    reader = csv.reader(f)
    next(reader)  # Skip header
    route_names = [row[0].strip() for row in reader if row]

# Match names to coordinates
route_memorials = []
for name in route_names:
    for memorial in memorials:
        if memorial['name'].strip() == name:
            if 'lat' in memorial and 'lng' in memorial:
                route_memorials.append({
                    'name': name,
                    'lat': memorial['lat'],
                    'lng': memorial['lng']
                })
                break

print(f"Found coordinates for {len(route_memorials)} out of {len(route_names)} memorials")

# Haversine distance
def distance(m1, m2):
    lat1, lon1 = m1['lat'], m1['lng']
    lat2, lon2 = m2['lat'], m2['lng']
    R = 6371000  # meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi/2)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    return R * c

# Greedy nearest neighbor optimization
def optimize_route(memorials):
    if not memorials:
        return []
    
    # Step 1: Greedy nearest neighbor for initial route
    unvisited = memorials[:]
    route = [unvisited.pop(0)]  # Start with first memorial
    
    while unvisited:
        current = route[-1]
        # Find nearest unvisited memorial
        nearest = min(unvisited, key=lambda m: distance(current, m))
        route.append(nearest)
        unvisited.remove(nearest)
    
    # Step 2: 2-opt improvement to eliminate crossings and backtracking
    improved = True
    iterations = 0
    max_iterations = 100
    
    while improved and iterations < max_iterations:
        improved = False
        iterations += 1
        
        for i in range(len(route) - 2):
            for j in range(i + 2, len(route) - 1):
                # Calculate current distance for edges (i to i+1) and (j to j+1)
                current_dist = distance(route[i], route[i+1]) + distance(route[j], route[j+1])
                
                # Calculate distance if we reverse the section between i+1 and j
                # New edges would be (i to j) and (i+1 to j+1)
                new_dist = distance(route[i], route[j]) + distance(route[i+1], route[j+1])
                
                # If swapping improves the route by at least 1 meter, do it
                if new_dist < current_dist - 1:
                    # Reverse the section between i+1 and j (inclusive)
                    route[i+1:j+1] = reversed(route[i+1:j+1])
                    improved = True
    
    print(f"Route optimized in {iterations} iterations using 2-opt")
    return route

# Optimize the route
optimized = optimize_route(route_memorials)

# Calculate total distances
def total_distance(route):
    total = 0
    for i in range(len(route) - 1):
        total += distance(route[i], route[i+1])
    return total

original_dist = total_distance(route_memorials)
optimized_dist = total_distance(optimized)

print(f"\nOriginal route distance: {original_dist:.0f} meters")
print(f"Optimized route distance: {optimized_dist:.0f} meters")
print(f"Improvement: {((original_dist - optimized_dist) / original_dist * 100):.1f}%")

# Save optimized route
with open('data/Pink_Route.csv', 'w', encoding='utf-8', newline='') as f:
    writer = csv.writer(f)
    writer.writerow(['Memorial Name'])
    for memorial in optimized:
        writer.writerow([memorial['name']])

print(f"\nOptimized route saved to Pink_Route.csv")
print("\nOptimized order:")
for i, m in enumerate(optimized, 1):
    print(f"{i}. {m['name']}")

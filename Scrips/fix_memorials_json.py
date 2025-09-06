import json
import os

base_dir = os.path.dirname(os.path.abspath(__file__))
json_path = os.path.join(base_dir, "memorials.json")

with open(json_path, encoding='utf-8') as f:
    memorials = json.load(f)

for m in memorials:
    m.pop("latitude", None)
    m.pop("longitude", None)

with open(json_path, "w", encoding="utf-8") as f:
    json.dump(memorials, f, indent=2, ensure_ascii=False)

print("Removed latitude and longitude fields from memorials.json")
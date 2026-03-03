import json

with open('../data/AFM-Panels/AFM-Panel-A.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

print(f"Total pins/points in AFM-Panel-A.json: {len(data['features'])}")

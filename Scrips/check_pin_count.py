import json

with open('../data/AFM-Panel-A.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

num_pins = len(data['features'])
print(f"Total pins in AFM-Panel-A.json: {num_pins}")

if num_pins == 77:
    print("✓ CONFIRMED: Exactly 77 pins")
else:
    print(f"✗ WARNING: Expected 77 pins but found {num_pins}")

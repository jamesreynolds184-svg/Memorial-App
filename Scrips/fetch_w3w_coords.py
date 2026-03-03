"""
Script to fetch coordinates from what3words addresses.

To get accurate coordinates, you have two options:

1. USE WHAT3WORDS API (Recommended):
   - Sign up for free API key at: https://accounts.what3words.com/create-api-key
   - Uncomment the API code below and add your key
   - Run: pip install requests
   - Run this script

2. MANUAL LOOKUP (Quick alternative):
   - Visit each what3words URL below
   - Copy the coordinates shown on the page
   - Update the coordinates in afm-detail.js
"""

# List of what3words addresses to look up
w3w_addresses = [
    '///woke.fastening.rinses',
    '///timeless.craziest.tasteful',
    '///doll.caravans.begun',
    '///vandalism.angle.copiers',
    '///ripe.decorated.risk',
    '///quaking.public.ranted',
    '///wrenching.directors.aliens',
    '///icon.scrubbing.survey',
    '///coil.initial.gourmet',
    '///outer.simulator.harder',
    '///salaried.waddled.clashes',
    '///condiment.irrigate.exhales',
    '///marathons.crispier.crystal',
    '///talkative.term.universes',
    '///feasted.residual.stitch',
    '///rosier.landscape.minds',
    '///upgrading.revolting.belong'
]

print("="*80)
print("what3words Coordinate Lookup")
print("="*80)
print()

# OPTION 1: API Method (requires API key and requests library)
"""
import requests

API_KEY = 'YOUR_API_KEY_HERE'  # Get free key from what3words.com

print("Fetching coordinates from what3words API...")
print()

coordinates = {}
for address in w3w_addresses:
    # Remove /// prefix
    words = address.replace('///', '')
    
    url = f'https://api.what3words.com/v3/convert-to-coordinates'
    params = {
        'words': words,
        'key': API_KEY
    }
    
    response = requests.get(url, params=params)
    if response.ok:
        data = response.json()
        lat = data['coordinates']['lat']
        lng = data['coordinates']['lng']
        coordinates[address] = [lat, lng]
        print(f"'{address}': [{lat}, {lng}],")
    else:
        print(f"Error fetching {address}: {response.text}")

print()
print("Copy these coordinates into afm-detail.js!")
"""

# OPTION 2: Manual lookup instructions
print("MANUAL LOOKUP URLs:")
print("Visit each URL below to see the coordinates on the what3words website:")
print()

for address in w3w_addresses:
    words = address.replace('///', '')
    url = f'https://what3words.com/{words}'
    print(f"{address}")
    print(f"  URL: {url}")
    print()

print("="*80)
print("On each what3words page, look for the coordinates shown.")
print("They will be in the format: 52.XXXXX, -1.XXXXX")
print("Copy them into the w3wCoordinates object in afm-detail.js")
print("="*80)

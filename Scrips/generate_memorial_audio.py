import json
import requests
import os
import re
import sys
from pathlib import Path

# ElevenLabs API configuration
# NOTE: hardcoding a key here works for local use, but do NOT commit this file
# to version control with the key in it. Prefer setting ELEVENLABS_API_KEY
# as an environment variable instead.
API_KEY = os.getenv("ELEVENLABS_API_KEY") or ""
VOICE_ID = "AeRdCCKzvd23BpJoofzx"
API_URL = f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE_ID}"

# Dataset configurations
DATASETS = {
    "memorials": {
        "data_file": "data/memorials.json",
        "output_dir": "memorial_audio",
        "name_field": "name",
        # Memorials are saved by their index in the JSON array
        "filename": lambda item, index: f"{index:03d}.mp3",
    },
    "asf": {
        "data_file": "data/allied-special-forces.json",
        "output_dir": "asf_audio",
        "name_field": "plaque",
        # ASF plaques are saved by their id (e.g. 001.mp3)
        "filename": lambda item, index: f"{item.get('id') or f'{index:03d}'}.mp3",
    },
}


def sanitize_filename(name):
    """Convert memorial name to a safe filename"""
    # Remove special characters and replace spaces with underscores
    safe_name = re.sub(r'[^\w\s-]', '', name)
    safe_name = re.sub(r'[-\s]+', '_', safe_name)
    return safe_name.strip('_')


def generate_audio(item, index, config):
    """Generate audio file for a single memorial/plaque"""
    name = item.get(config["name_field"], "Unknown")
    description = item.get("description", "No description available")

    # Create filename
    filename = f"{config['output_dir']}/{config['filename'](item, index)}"

    # Check if file already exists
    if os.path.exists(filename):
        print(f"⊘ Skipping {index}: {name} (file already exists)")
        return True
    
    # Remove newline characters from the text
    name = name.replace("\n", " ").replace("  ", " ").strip()
    description = description.replace("\n", " ").replace("  ", " ").strip()
    
    # Create the text to be spoken
    text = f"{name}. {description}"
    
    # Prepare the request
    headers = {
        "Accept": "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": API_KEY
    }
    
    data = {
        "text": text,
        "model_id": "eleven_multilingual_v2",
        "voice_settings": {
            "stability": 0.5,
            "similarity_boost": 0.75
        }
    }
    
    print(f"Generating audio for {index}: {name}...")
    
    try:
        # Make API request
        response = requests.post(API_URL, json=data, headers=headers)
        
        if response.status_code == 200:
            # Save audio file
            with open(filename, "wb") as f:
                f.write(response.content)
            
            print(f"✓ Saved: {filename}")
            return True
        else:
            print(f"✗ Error generating audio: {response.status_code} - {response.text}")
            return False
            
    except Exception as e:
        print(f"✗ Exception occurred: {str(e)}")
        return False


def main():
    if not API_KEY:
        raise RuntimeError("Set ELEVENLABS_API_KEY before generating audio.")

    # Pick dataset: CLI argument wins, otherwise prompt
    choice = sys.argv[1].strip().lower() if len(sys.argv) > 1 else ""
    if choice not in DATASETS:
        choice = input("Which dataset? (memorials/asf): ").strip().lower()
    if choice not in DATASETS:
        print("Invalid choice. Use 'memorials' or 'asf'.")
        return

    config = DATASETS[choice]
    Path(config["output_dir"]).mkdir(exist_ok=True)

    # Load data
    print(f"Loading {config['data_file']}...")
    with open(config["data_file"], "r", encoding="utf-8") as f:
        items = json.load(f)

    print(f"Total {choice} available: {len(items)}")

    # Get range from user
    range_input = input(f"\nEnter {choice} range (e.g., 0-10): ").strip()

    try:
        start, end = map(int, range_input.split("-"))

        # Validate range
        if start < 0 or end >= len(items) or start > end:
            print(f"Invalid range. Please enter a range between 0 and {len(items) - 1}")
            return

        print(f"\nGenerating audio for {choice} {start} to {end}...")
        print(f"Output directory: {config['output_dir']}/")
        print("-" * 60)

        # Generate audio for each item in range
        success_count = 0
        for i in range(start, end + 1):
            if generate_audio(items[i], i, config):
                success_count += 1

        print("-" * 60)
        print(f"\nComplete! Successfully generated {success_count} out of {end - start + 1} audio files.")

    except ValueError:
        print("Invalid format. Please use format: start-end (e.g., 0-10)")
    except Exception as e:
        print(f"An error occurred: {str(e)}")


if __name__ == "__main__":
    main()

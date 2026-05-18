import json
import requests
import os
import re
from pathlib import Path

# ElevenLabs API configuration
API_KEY = "sk_bcb6b2c3dbdfe419717be5fae4cb4bc2f029bebd1e5938b9"
VOICE_ID = "AeRdCCKzvd23BpJoofzx"
API_URL = f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE_ID}"

# Create output directory for audio files
OUTPUT_DIR = "memorial_audio"
Path(OUTPUT_DIR).mkdir(exist_ok=True)


def sanitize_filename(name):
    """Convert memorial name to a safe filename"""
    # Remove special characters and replace spaces with underscores
    safe_name = re.sub(r'[^\w\s-]', '', name)
    safe_name = re.sub(r'[-\s]+', '_', safe_name)
    return safe_name.strip('_')


def generate_audio(memorial, index):
    """Generate audio file for a single memorial"""
    name = memorial.get("name", "Unknown")
    description = memorial.get("description", "No description available")
    
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
    
    print(f"Generating audio for memorial {index}: {name}...")
    
    try:
        # Make API request
        response = requests.post(API_URL, json=data, headers=headers)
        
        if response.status_code == 200:
            # Create filename
            filename = f"{OUTPUT_DIR}/{index:03d}.mp3"
            
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
    # Load memorials data
    print("Loading memorials data...")
    with open("data/memorials.json", "r", encoding="utf-8") as f:
        memorials = json.load(f)
    
    print(f"Total memorials available: {len(memorials)}")
    
    # Get range from user
    range_input = input("\nEnter memorial range (e.g., 0-10): ").strip()
    
    try:
        start, end = map(int, range_input.split("-"))
        
        # Validate range
        if start < 0 or end >= len(memorials) or start > end:
            print(f"Invalid range. Please enter a range between 0 and {len(memorials) - 1}")
            return
        
        print(f"\nGenerating audio for memorials {start} to {end}...")
        print(f"Output directory: {OUTPUT_DIR}/")
        print("-" * 60)
        
        # Generate audio for each memorial in range
        success_count = 0
        for i in range(start, end + 1):
            if generate_audio(memorials[i], i):
                success_count += 1
        
        print("-" * 60)
        print(f"\nComplete! Successfully generated {success_count} out of {end - start + 1} audio files.")
        
    except ValueError:
        print("Invalid format. Please use format: start-end (e.g., 0-10)")
    except Exception as e:
        print(f"An error occurred: {str(e)}")


if __name__ == "__main__":
    main()

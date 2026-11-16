# Audio Download System Documentation

## Overview
The app now includes a smart audio download system that manages the 426MB memorial audio files. Instead of bundling these files with the app, they are downloaded on-demand from Amazon S3.

## How It Works

### First Time Use
1. User clicks "Read Aloud" button on a memorial page
2. System checks if audio files are already downloaded
3. If not downloaded, shows a popup: "You need to download the audio files (426MB) continue?"
4. If user clicks "Download":
   - Shows progress dialog with download progress bar (0-50%)
   - Downloads ZIP file from S3 bucket
   - Shows unzip progress bar (50-100%)
   - Extracts files to device storage
   - Marks download as complete
5. If user clicks "Cancel", falls back to Text-to-Speech

### Subsequent Uses
- System checks localStorage flag `audioFilesDownloaded`
- If flag is set to 'true', directly plays audio files
- No re-download required

### ASF Plaque Audio (published separately)
- ASF plaque pages (`asf-plaque.html`) check for the individual plaque's audio file (`asf_audio/[plaque_id].mp3`) every time "Read aloud" is tapped.
- If the file is not on the device, the download prompt is shown (once per browser session) and the ZIP is downloaded again — this is how plaque audio published to S3 at a later date reaches installed apps.
- If the file is still missing after the download (e.g. not yet published), the app falls back to Text-to-Speech.
- Memorial and ASF audio are stored separately; the shared download code lives in `js/audio-download.js` (loaded before `memorial.js` and `asf-plaque.js`).

## Platform-Specific Behavior

### iOS/Android (Capacitor)
- Downloads and extracts 426MB ZIP file from S3
- Stores files in app's data directory using Capacitor Filesystem API
- Files persist between app sessions
- No internet required after initial download
- Uses Capacitor's `convertFileSrc()` to properly load audio files

### Web Browser
- Downloads and extracts 426MB ZIP file from S3
- **Stores files in IndexedDB** (browser's local database storage)
- Files persist in browser storage (like cookies/localStorage)
- No manual extraction needed!
- Audio loaded as Blob URLs from IndexedDB
- **Storage limit**: Most browsers allow ~1GB+ for IndexedDB
- **Privacy mode**: May not persist in incognito/private browsing

## S3 Bucket Details
- **URL:** https://nma-app-dlc.s3.eu-north-1.amazonaws.com/memorial_audio.zip
- **Size:** 426MB
- **Region:** eu-north-1
- **Contents:** MP3 files named by memorial ID in `memorial_audio/` (e.g., `memorial_audio/000.mp3`), plus ASF plaque audio in `asf_audio/` named by plaque ID (e.g., `asf_audio/001.mp3`). The `asf_audio/` folder may not be present until the plaque audio is published — extraction skips whatever is missing.

## Testing & Debugging

### Reset Download State
To test the download flow again, open browser/app console and run:
```javascript
window.resetAudioDownload()
```
Then refresh the page and click "Read Aloud" again.

### Check Download Status
```javascript
localStorage.getItem('audioFilesDownloaded')
```

### Check IndexedDB Storage (Web Only)
```javascript
// Open IndexedDB and check audio count
const request = indexedDB.open('MemorialAudioDB', 1);
request.onsuccess = () => {
  const db = request.result;
  const transaction = db.transaction(['audioFiles'], 'readonly');
  const store = transaction.objectStore('audioFiles');
  const countRequest = store.count();
  countRequest.onsuccess = () => {
    console.log('Audio files in IndexedDB:', countRequest.result);
    db.close();
  };
};
```

### For Capacitor Apps
The files are stored in:
- iOS: App's Data directory (`Filesystem.Directory.Data`)
- Android: App's Data directory (`Filesystem.Directory.Data`)

Access path: `memorial_audio/[memorial_id].mp3`

## Dependencies

### Required Libraries
- **JSZip** (v3.10.1): For unzipping the downloaded file
  - Loaded from CDN: https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js
  - Auto-loaded when needed
- **IndexedDB**: Built-in browser API for local storage (web only)
  - No external library required
  - Supported in all modern browsers

### Required Capacitor Plugins
For iOS/Android builds, ensure these plugins are installed:

```bash
npm install @capacitor/filesystem
```

Add to `capacitor.config.json` or `capacitor.config.ts`:
```json
{
  "plugins": {
    "Filesystem": {
      "iosIsExternalStorageSupported": true
    }
  }
}
```

## User Experience Flow

```
User clicks "Read Aloud"
         ↓
    Check audio available?
         ↓
    ┌────┴────┐
   YES       NO
    ↓         ↓
Play audio  Show prompt
    ↓         ↓
   END    User choice?
           ↓
       ┌───┴───┐
   Download  Cancel
       ↓       ↓
   Progress   TTS
    (50%)     ↓
       ↓      END
   Extract
    (100%)
       ↓
   Success!
       ↓
   Play audio
       ↓
      END
```

## Error Handling

### Download Fails
- Shows error message: "Could not download audio files. Please try again later."
- Falls back to Text-to-Speech
- User can try again later

### Extraction Fails
- Shows error message
- Clears download flag (will retry on next attempt)
- Falls back to Text-to-Speech

### Individual File Fails
- Logged to console
- Other files continue extracting
- Falls back to TTS for specific memorial if its audio file is missing

## File Structure

```
memorial_audio/
├── 000.mp3
├── 001.mp3
├── ...
└── [memorial_id].mp3
asf_audio/
├── 001.mp3
├── 002.mp3
├── ...
└── [plaque_id].mp3
```

Memorial audio files are named by the `id` field from `memorials.json`. ASF plaque audio files are named by the `id` field from `allied-special-forces.json`. The two sets use separate storage (IndexedDB stores `audioFiles` / `asfAudioFiles` on web; `memorial_audio/` / `asf_audio/` directories on native) because memorial IDs and plaque IDs can overlap (e.g. both use `001`).

## Maintenance

### Updating Audio Files
1. Add/update MP3 files in `memorial_audio/` folder
2. Create ZIP: `zip -r memorial_audio.zip memorial_audio/`
3. Upload to S3: `aws s3 cp memorial_audio.zip s3://nma-app-dlc/memorial_audio.zip`
4. Update file size in prompt if changed (currently 426MB)

### Clearing User's Downloaded Files
Users can clear their device storage through:
- **iOS**: Settings → General → iPhone Storage → [App] → Delete App
- **Android**: Settings → Apps → [App] → Storage → Clear Data
- **Web**: Clear browser cache/localStorage OR use Developer Console:
  ```javascript
  window.resetAudioDownload()
  ```
  This clears both localStorage flag and IndexedDB storage.

## Performance Considerations

- **Download Time:** ~2-5 minutes on 4G connection
- **Storage Required:** 426MB (Capacitor: file system, Web: IndexedDB)
- **Memory Usage:** JSZip processes ZIP in chunks to avoid memory issues
- **Progress Updates:** Updates every file during extraction
- **IndexedDB Limits:** Most browsers allow 1GB+ for IndexedDB storage

## Accessibility

- Progress dialogs are keyboard accessible
- Buttons have proper ARIA labels
- Screen readers announce download progress
- Falls back to screen reader-friendly TTS if download fails

## Future Enhancements

Potential improvements:
- [ ] Selective download (only download memorials in user's saved list)
- [ ] Download only when on WiFi
- [ ] Pause/Resume capability
- [ ] Background download
- [ ] Delta updates (only download new/changed files)
- [ ] Streaming audio directly from S3 (requires internet)

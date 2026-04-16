# AR Footpath View - Documentation

## Quick Start for Testing

### Option 1: Easiest - Manual Mode (No Camera)
1. Start HTTP server: `python -m http.server 8000 --bind 0.0.0.0`
2. Get your PC's IP: `ipconfig` (look for IPv4 like 192.168.x.x)
3. On iPhone Safari: `http://YOUR-PC-IP:8000/pages/ar-view.html`
4. Enable "Manual Location" checkbox
5. Enter test coordinates (e.g., Lat: 52.92640, Lon: -1.49800)
6. Adjust heading slider to simulate rotation

### Option 2: Full AR (Camera + GPS)
1. Run: `.\start-ar-server.ps1` and choose option 2
2. On iPhone Safari: `https://YOUR-PC-IP:8000/pages/ar-view.html`
3. Accept certificate warning
4. Grant camera and location permissions

**See [SAFARI_TESTING_GUIDE.md](SAFARI_TESTING_GUIDE.md) for detailed instructions**

---

## Overview
The AR Footpath View displays footpaths from `footpathsTEMP.geojson` overlaid on the device's camera feed, using GPS location and device orientation (compass).

## Features
- **Real-time camera feed** (rear-facing camera)
- **GPS-based positioning** using device location
- **Compass-based orientation** using device heading
- **Distance indicators** showing how far paths are from user
- **Field of view filtering** (only shows paths within 60° view angle)
- **Range filtering** (shows paths within 100 meters)

## How It Works

### 1. **Camera Access**
- Requests rear-facing (environment) camera via WebRTC
- Streams video to the background

### 2. **Location Tracking**
- Uses HTML5 Geolocation API with high accuracy
- Continuously tracks user position
- Displays accuracy in meters

### 3. **Orientation Tracking**
- Uses DeviceOrientation API for compass heading
- Requests permission on iOS 13+
- Calibration prompt for better accuracy

### 4. **Path Rendering**
- Loads footpath LineStrings from GeoJSON
- Calculates distance using Haversine formula
- Calculates bearing from user to each path segment
- Projects paths onto 2D canvas overlay based on:
  - Relative angle to user heading
  - Distance from user
- Draws blue lines with distance labels

## Technical Details

### Projection System
```javascript
// Bearing: direction from user to point (0-360°)
// Relative angle: bearing minus user heading
// If within FOV (±30°), project to screen:
//   x-position: based on angle
//   y-position: based on distance
```

### Formulas Used
- **Haversine Distance**: Earth-surface distance between coordinates
- **Bearing Calculation**: Direction to target from user position
- **Field of View**: 60° horizontal view angle

### Browser Requirements
- Camera access (getUserMedia)
- Geolocation API
- DeviceOrientation API
- Canvas 2D context
- Modern browser (Chrome 90+, Safari 14+, Firefox 88+)

## Usage Instructions

### For iOS (iPhone)
1. Open the app in Safari
2. Grant camera permission when prompted
3. Grant location permission when prompted
4. Grant motion & orientation permission when prompted
5. Move device in figure-8 to calibrate compass
6. Point camera toward footpaths

### For Android
1. Open the app in Chrome
2. Grant camera permission when prompted
3. Grant location permission when prompted
4. Move device in figure-8 to calibrate compass
5. Point camera toward footpaths

## Configuration Options

In `js/ar-view.js`, you can adjust:

```javascript
this.fov = 60; // Field of view in degrees (30-90 recommended)
this.maxDistance = 100; // Max distance to show paths in meters
```

### Path Appearance
```javascript
// In drawPath() method:
this.ctx.strokeStyle = 'rgba(0, 150, 255, 0.8)'; // Path color
this.ctx.lineWidth = 4; // Path thickness
```

## Troubleshooting

### Paths Not Appearing
- Ensure you're within 100m of footpaths in the GeoJSON
- Check GPS accuracy (should be <20m for best results)
- Verify compass is calibrated (move in figure-8)
- Ensure paths exist in `data/footpathsTEMP.geojson`

### Camera Not Working
- Check browser permissions for camera
- Ensure HTTPS connection (required for camera access)
- Try closing other apps using camera

### Location Inaccurate
- Move to open area (away from buildings)
- Wait for GPS to settle (30-60 seconds)
- Check device location settings are enabled

### Compass Inaccurate
- Move device in figure-8 pattern
- Move away from metal objects/magnets
- Recalibrate device compass in settings

## Future Enhancements

Potential improvements:
- Add device tilt (pitch) for vertical projection
- Add path names/labels from GeoJSON properties
- Add touch interaction to select paths
- Add AR navigation arrows
- Add 3D ground plane detection
- Add distance-based path filtering controls
- Add photo capture functionality
- Add path history/highlighting

## Testing Recommendations

1. **Test in open area first** - easier to get good GPS signal
2. **Test at known footpath locations** - verify coordinates match
3. **Test heading calibration** - rotate 360° smoothly
4. **Test at different times of day** - lighting conditions
5. **Test on both iOS and Android** - orientation APIs differ

## Files Created
- `pages/ar-view.html` - AR view page with UI
- `js/ar-view.js` - AR logic and rendering
- Updated navigation menus in `home.html` and `pages/map.html`

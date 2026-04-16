# AR View Testing Guide

## What Changed

### Camera Initialization is Now Optional
- AR view will load even if camera fails
- Camera errors won't block the page
- Manual mode works independently

### iOS Device Orientation Permission
- A button will appear on iOS devices requesting orientation permission
- Must click "Enable Device Orientation" button
- This is required by iOS 13+ for compass access

### Better Error Messages
- Console logs every step of initialization
- Specific error messages for camera/location/orientation failures
- Page continues even if some features fail

## Testing on Desktop (with webcam)

1. **Open the page**: `https://jamesreynolds184-svg.github.io/Memorial-App/pages/ar-view.html`

2. **What should happen**:
   - Browser requests camera permission → Grant it
   - You should see webcam feed in background
   - Loading message disappears
   - OR: Alert says "Camera not available. Please use Manual Location mode."

3. **If stuck on "Initializing"**:
   - Open browser console (F12)
   - Look for error messages
   - Last log should show where it stopped

4. **Use Manual Mode**:
   - Check "Manual Location (Testing)"
   - Enter coordinates: `52.92640`, `-1.49800`
   - Click "Set Location"
   - Check "Manual Heading"
   - Adjust heading slider (0-360°)
   - You should see blue path lines if you're "looking" at them

## Testing on iPhone

1. **Open Safari**: `https://jamesreynolds184-svg.github.io/Memorial-App/pages/ar-view.html`

2. **Grant Permissions**:
   - **Camera**: Safari will prompt → Tap "Allow"
   - **Location**: Safari will prompt → Tap "Allow"
   - **Motion/Orientation**: Blue button appears → Tap "Enable Device Orientation"

3. **What to expect**:
   - Camera feed shows in background
   - Top overlay shows your location and heading
   - If near footpaths (within 100m), blue lines appear
   - Distance labels show meters to each path

4. **If camera doesn't work**:
   - Check Settings → Safari → Camera → Allow
   - Check you're on HTTPS (should be with GitHub Pages)
   - Try closing other apps using camera
   - Use Manual Mode as fallback

5. **If stuck on Initializing**:
   - Wait 5-10 seconds (permission prompts may be delayed)
   - Check if permission prompts appeared (may be at bottom of screen)
   - Try refreshing the page
   - Click "Use Manual Mode" if error appears

## Console Logs to Look For

Open browser console to see detailed logs:

```
AR View: Setting up manual controls...
AR View: Starting initialization...
AR View: Loading footpaths...
AR View: Footpaths loaded successfully
AR View: Requesting camera access...
AR View: Camera setup complete  // OR: Camera setup failed (continuing without camera)
AR View: Setting up canvas...
AR View: Starting location tracking...
AR View: Setting up orientation...
AR View: Starting render loop...
AR View: Initialization complete!
```

## Manual Mode Testing

Test without camera to verify path rendering:

1. Enable "Manual Location"
2. Set to footpath area: `52.92640, -1.49800`
3. Enable "Manual Heading"
4. Set heading to `0` (North)
5. Should see `Paths visible: X` update in overlay
6. Rotate heading 0-360° and watch paths appear/disappear

## Common Issues

### Desktop - No Camera Feed
- **Cause**: Camera permission denied or webcam not available
- **Solution**: Use Manual Mode for testing

### iPhone - Stuck on Initializing
- **Cause**: Waiting for permission prompts
- **Solution**: Look for permission dialogs, wait 10 seconds, or refresh

### iPhone - No Orientation Button
- **Cause**: iOS permission already granted/denied
- **Solution**: Settings → Safari → Motion & Orientation → Ask

### No Paths Visible
- **Cause**: Not within 100m of footpaths in footpathsTEMP.geojson
- **Solution**: Use manual coordinates `52.92640, -1.49800`

### Paths Don't Move with Heading
- **Cause**: Heading not updating (compass issue)
- **Solution**: Use Manual Heading to test

## What You Should See

When working correctly:
- Camera feed OR gray background (if no camera)
- Location coordinates updating
- Heading degrees (0-360) updating as you rotate
- "Paths visible: X" counting nearby paths
- Blue lines on screen when pointing toward paths
- Distance labels (e.g., "25m") on each path

## GitHub Pages URL

**AR View**: https://jamesreynolds184-svg.github.io/Memorial-App/pages/ar-view.html

Pages typically update 1-2 minutes after push.

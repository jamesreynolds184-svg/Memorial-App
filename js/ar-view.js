/**
 * AR Footpath View
 * Displays footpaths from footpathsTEMP.geojson overlaid on device camera
 * using GPS location and device orientation
 */

class ARFootpathView {
  constructor() {
    this.userLat = null;
    this.userLon = null;
    this.userHeading = 0;
    this.footpaths = [];
    this.canvas = null;
    this.ctx = null;
    this.video = null;
    this.isCalibrated = false;
    this.watchId = null;
    this.orientationHandler = null;
    this.manualLocationMode = false;
    this.manualHeadingMode = false;
    this.renderingStarted = false;
    this.userInteracted = false;
    
    // Smoothing for GPS and heading
    this.locationHistory = [];
    this.headingHistory = [];
    this.smoothingWindow = 5; // Number of readings to average
    this.minHeadingChange = 2; // Degrees - ignore changes smaller than this
    this.minLocationChange = 0.000005; // Lat/Lon - ignore tiny GPS drift
    
    // Testing mode - offset paths to user location
    this.testingMode = false;
    this.pathOffset = { lat: 0, lon: 0 };
    
    // Camera field of view (adjustable based on device)
    this.fov = 60; // degrees
    this.maxDistance = 100; // meters - max distance to show paths
    
    // Check if this is iOS/mobile
    this.isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    
    // Always require user interaction for better cross-browser compatibility
    console.log('Waiting for user to click Start button...');
    this.setupStartButton();
  }

  setupStartButton() {
    console.log('Setting up Start button...');
    
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setupStartButtonElements());
    } else {
      this.setupStartButtonElements();
    }
  }
  
  setupStartButtonElements() {
    const startScreen = document.getElementById('start-button-screen');
    const startButton = document.getElementById('start-ar-button');
    const loading = document.getElementById('loading');
    
    if (!startScreen || !startButton || !loading) {
      console.error('Start button elements not found!', { startScreen, startButton, loading });
      return;
    }
    
    console.log('Start button elements found, showing screen');
    loading.style.display = 'none';
    startScreen.style.display = 'flex';
    
    startButton.addEventListener('click', () => {
      console.log('START BUTTON CLICKED!');
      this.userInteracted = true;
      startScreen.style.display = 'none';
      loading.style.display = 'flex';
      this.init();
    });
    
    console.log('Start button click handler attached');
  }

  async init() {
    // Setup manual controls first so they work even if camera fails
    console.log('========================================');
    console.log('AR View v2.5 - Build 2026-04-16 16:30 (Stabilized)');
    console.log('Mobile device:', this.isMobile);
    console.log('User interacted:', this.userInteracted);
    console.log('Smoothing enabled: GPS window=' + this.smoothingWindow + ', Heading window=' + this.smoothingWindow);
    console.log('========================================');
    console.log('AR View: Setting up manual controls...');
    this.setupManualControls();
    
    // Set a timeout to detect if initialization hangs
    const initTimeout = setTimeout(() => {
      console.error('INITIALIZATION TIMEOUT - Something is stuck!');
      console.error('Check if waiting for user interaction (camera/location permission)');
      document.getElementById('loading').innerHTML = `
        <div style="padding: 20px; background: rgba(255,0,0,0.9); color: white; border-radius: 10px;">
          <h3>Initialization Timeout</h3>
          <p>The page has been loading for over 10 seconds.</p>
          <p>Possible causes:</p>
          <ul style="text-align: left; margin: 10px 0;">
            <li>Waiting for camera permission (check browser prompt)</li>
            <li>Waiting for location permission (check browser prompt)</li>
            <li>Data failed to load (check console for errors)</li>
          </ul>
          <button onclick="location.reload()" style="padding: 10px 20px; margin: 5px; background: white; color: #cc0000; border: none; border-radius: 5px; cursor: pointer;">Reload Page</button>
          <button onclick="enableManualMode(); document.getElementById('loading').style.display='none';" style="padding: 10px 20px; margin: 5px; background: #0096ff; color: white; border: none; border-radius: 5px; cursor: pointer;">Use Manual Mode</button>
        </div>
      `;
    }, 10000); // 10 second timeout
    
    console.log('AR View: Starting initialization...');
    
    // Load footpaths data
    try {
      console.log('AR View: Loading footpaths...');
      await this.loadFootpaths();
      console.log('AR View: Footpaths loaded successfully');
    } catch (error) {
      this.showError('Failed to load footpaths: ' + error.message);
      console.error('Footpaths loading error:', error);
      return;
    }
    
    // Setup canvas (always needed)
    console.log('AR View: Setting up canvas...');
    this.setupCanvas();
    
    // Setup camera (optional - continue if fails)
    try {
      console.log('AR View: Requesting camera access...');
      await this.setupCamera();
      console.log('AR View: Camera setup complete');
    } catch (error) {
      console.warn('AR View: Camera setup failed (continuing without camera):', error.message);
      // Hide video element if camera fails
      const video = document.getElementById('camera-view');
      if (video) video.style.display = 'none';
    }
    
    // Get user location (optional - continue if fails)
    console.log('AR View: Starting location tracking...');
    this.startLocationTracking();
    
    // Setup device orientation (optional - continue if fails)
    console.log('AR View: Setting up orientation...');
    this.setupOrientation();
    
    // Start rendering
    console.log('AR View: Starting render loop...');
    this.startRendering();
    
    // Clear timeout since we completed successfully
    clearTimeout(initTimeout);
    
    document.getElementById('loading').style.display = 'none';
    console.log('AR View: Initialization complete!');
    console.log('========================================');
    
    // Show message if camera not available
    if (!this.video || !this.video.srcObject) {
      alert('Camera not available. Please use Manual Location mode for testing.');
    }
    
    // Hide calibration notice after 5 seconds
    setTimeout(() => {
      const notice = document.getElementById('calibration-notice');
      if (notice) {
        notice.style.opacity = '0';
        notice.style.transition = 'opacity 1s';
        setTimeout(() => notice.remove(), 1000);
      }
    }, 5000);
  }
  
  setupBasicFallback() {
    console.log('AR View: Setting up fallback mode without camera');
    try {
      // Setup canvas for drawing
      if (!this.canvas) {
        this.setupCanvas();
      }
      
      // Start location tracking (will work or fail silently)
      this.startLocationTracking();
      
      // Setup orientation
      this.setupOrientation();
      
      // Start rendering even without camera
      if (!this.renderingStarted) {
        this.startRendering();
      }
      
      console.log('AR View: Fallback mode ready - use manual controls');
    } catch (e) {
      console.error('Fallback setup error:', e);
    }
  }

  async loadFootpaths() {
    try {
      console.log('Fetching footpaths from: ../data/footpathsTEMP.geojson');
      const response = await fetch('../data/footpathsTEMP.geojson');
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data.features || !Array.isArray(data.features)) {
        throw new Error('Invalid GeoJSON format');
      }
      
      this.footpaths = data.features;
      console.log(`Loaded ${this.footpaths.length} footpaths`);
    } catch (error) {
      console.error('Footpaths loading error:', error);
      throw new Error('Could not load footpaths data: ' + error.message);
    }
  }

  async setupCamera() {
    try {
      this.video = document.getElementById('camera-view');
      
      // Check if getUserMedia is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API not supported on this browser/device');
      }
      
      // Request camera with environment-facing (rear) camera
      const constraints = {
        video: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      };
      
      console.log('AR View: Requesting camera with constraints:', constraints);
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('AR View: Camera stream obtained');
      
      this.video.srcObject = stream;
      
      return new Promise((resolve) => {
        this.video.onloadedmetadata = () => {
          console.log('AR View: Video metadata loaded, starting playback');
          this.video.play();
          resolve();
        };
      });
    } catch (error) {
      console.error('Camera setup error:', error);
      if (error.name === 'NotAllowedError') {
        throw new Error('Camera permission denied. Please allow camera access in browser settings.');
      } else if (error.name === 'NotFoundError') {
        throw new Error('No camera found on this device.');
      } else if (error.name === 'NotReadableError') {
        throw new Error('Camera is already in use by another application.');
      } else {
        throw new Error('Camera access failed: ' + error.message);
      }
    }
  }

  setupCanvas() {
    this.canvas = document.getElementById('ar-canvas');
    this.ctx = this.canvas.getContext('2d');
    
    // Set canvas size to match window
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());
  }

  resizeCanvas() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  startLocationTracking() {
    if (!navigator.geolocation) {
      console.warn('Geolocation not supported on this device');
      return;
    }

    const options = {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 5000
    };

    console.log('Requesting geolocation access...');
    this.watchId = navigator.geolocation.watchPosition(
      (position) => this.onLocationUpdate(position),
      (error) => this.onLocationError(error),
      options
    );
  }

  onLocationUpdate(position) {
    if (this.manualLocationMode) return; // Ignore GPS updates in manual mode
    
    const newLat = position.coords.latitude;
    const newLon = position.coords.longitude;
    
    // Check if change is significant enough (reduce GPS jitter)
    if (this.userLat !== null) {
      const latDiff = Math.abs(newLat - this.userLat);
      const lonDiff = Math.abs(newLon - this.userLon);
      
      if (latDiff < this.minLocationChange && lonDiff < this.minLocationChange) {
        // Change too small, ignore to prevent jitter
        return;
      }
    }
    
    // Add to history for smoothing
    this.locationHistory.push({ lat: newLat, lon: newLon });
    if (this.locationHistory.length > this.smoothingWindow) {
      this.locationHistory.shift();
    }
    
    // Calculate smoothed average
    let avgLat = 0;
    let avgLon = 0;
    this.locationHistory.forEach(loc => {
      avgLat += loc.lat;
      avgLon += loc.lon;
    });
    avgLat /= this.locationHistory.length;
    avgLon /= this.locationHistory.length;
    
    this.userLat = avgLat;
    this.userLon = avgLon;
    
    const accuracy = Math.round(position.coords.accuracy);
    
    // Update UI
    document.getElementById('user-location').textContent = 
      `${this.userLat.toFixed(6)}, ${this.userLon.toFixed(6)}`;
    document.getElementById('location-accuracy').textContent = accuracy;
    
    console.log(`Location updated (smoothed): ${this.userLat.toFixed(6)}, ${this.userLon.toFixed(6)} (±${accuracy}m)`);
  }

  onLocationError(error) {
    let message = 'Location error: ';
    switch(error.code) {
      case error.PERMISSION_DENIED:
        message += 'Location permission denied';
        break;
      case error.POSITION_UNAVAILABLE:
        message += 'Location unavailable';
        break;
      case error.TIMEOUT:
        message += 'Location request timeout';
        break;
      default:
        message += 'Unknown error';
    }
    console.warn(message, '- Use Manual Location mode');
    // Don't show error, just log it - user can use manual mode
  }

  setupOrientation() {
    // Check if we need to request permission (iOS 13+)
    if (typeof DeviceOrientationEvent !== 'undefined' && 
        typeof DeviceOrientationEvent.requestPermission === 'function') {
      
      console.log('iOS device - orientation permission required (user gesture needed)');
      
      // Only show button if user hasn't interacted yet
      if (!this.userInteracted) {
        console.log('No user interaction yet - will request permission via button');
      }
      
      // Create a button to request permission on iOS
      const requestBtn = document.createElement('button');
      requestBtn.textContent = 'Enable Compass';
      requestBtn.style.cssText = 'position: fixed; bottom: 100px; left: 50%; transform: translateX(-50%); z-index: 9999; padding: 15px 30px; font-size: 16px; background: #0096ff; color: white; border: none; border-radius: 10px; cursor: pointer; box-shadow: 0 2px 10px rgba(0,150,255,0.5);';
      requestBtn.onclick = () => {
        console.log('User clicked Enable Compass button');
        DeviceOrientationEvent.requestPermission()
          .then(response => {
        let newHeading;
        
        // alpha is compass heading (0-360)
        // On iOS with webkitCompassHeading
        if (event.webkitCompassHeading) {
          newHeading = event.webkitCompassHeading;
        } else {
          // Android/other devices
          newHeading = 360 - event.alpha;
        }
        
        // Normalize to 0-360
        newHeading = ((newHeading % 360) + 360) % 360;
        
        // Check if change is significant (reduce compass jitter)
        if (this.userHeading !== 0) {
          let headingDiff = Math.abs(newHeading - this.userHeading);
          // Handle wraparound (e.g., 359° to 1° is only 2° difference)
          if (headingDiff > 180) {
            headingDiff = 360 - headingDiff;
          }
          
          if (headingDiff < this.minHeadingChange) {
            // Change too small, ignore to prevent jitter
            return;
          }
        }
        
        // Add to history for smoothing
        this.headingHistory.push(newHeading);
        if (this.headingHistory.length > this.smoothingWindow) {
          this.headingHistory.shift();
        }
        
        // Calculate smoothed average (with wraparound handling)
        let avgHeading = this.averageAngles(this.headingHistory);
        
        this.userHeading = avgHeading;
        this.isCalibrated = true;
        
        document.getElementById('user-heading').textContent = 
          Math.round(this.userHeading);
      }
    };
    
    window.addEventListener('deviceorientation', this.orientationHandler);
    
    // Also listen to deviceorientationabsolute for better support
    window.addEventListener('deviceorientationabsolute', this.orientationHandler);
  }
  
  // Helper function to average angles (handles 359° + 1° = 0° correctly)
  averageAngles(angles) {
    let x = 0;
    let y = 0;
    
    angles.forEach(angle => {
      const rad = angle * Math.PI / 180;
      x += Math.cos(rad);
      y += Math.sin(rad);
    });
    
    x /= angles.length;
    y /= angles.length;
    
    let avg = Math.atan2(y, x) * 180 / Math.PI;
    return ((avg % 360) + 360) % 360
      console.log('Direct orientation access (no permission needed)');
      this.startOrientationTracking();
    }
  }

  startOrientationTracking() {
    // Use DeviceOrientationEvent for compass heading
    this.orientationHandler = (event) => {
      if (this.manualHeadingMode) return; // Ignore device orientation in manual mode
      
      if (event.alpha !== null) {
        // alpha is compass heading (0-360)
        // On iOS with webkitCompassHeading
        if (event.webkitCompassHeading) {
          this.userHeading = event.webkitCompassHeading;
        } else {
          // Android/other devices
          this.userHeading = 360 - event.alpha;
        }
        
        this.isCalibrated = true;
        document.getElementById('user-heading').textContent = 
          Math.round(this.userHeading);
      }
    };
    
    window.addEventListener('deviceorientation', this.orientationHandler);
    
    // Also listen to deviceorientationabsolute for better support
    window.addEventListener('deviceorientationabsolute', this.orientationHandler);
  }

  startRendering() {
    if (this.renderingStarted) {
      console.log('Rendering already started, skipping');
      return;
    }
    this.renderingStarted = true;
    
    const render = () => {
      this.renderFrame();
      requestAnimationFrame(render);
    };
    render();
    console.log('Render loop started');
  }

  renderFrame() {
    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    if (!this.userLat || !this.userLon) {
      return; // Wait for location
    }

    // Find nearby paths
    const nearbyPaths = this.findNearbyPaths();
    document.getElementById('paths-count').textContent = nearbyPaths.length;
    
    // Draw each path
    nearbyPaths.forEach(pathData => {
      this.drawPath(pathData);
    });
  }

  findNearbyPaths() {
    const nearby = [];
    
    this.footpaths.forEach(feature => {
      if (feature.geometry.type === 'LineString') {
        const coords = feature.geometry.coordinates;
        
        // Check each segment of the path
        for (let i = 0; i < coords.length - 1; i++) {
          const point1 = coords[i];
          const point2 = coords[i + 1];
          
          // Apply offset if in testing mode
          const lat1 = point1[1] + this.pathOffset.lat;
          const lon1 = point1[0] + this.pathOffset.lon;
          const lat2 = point2[1] + this.pathOffset.lat;
          const lon2 = point2[0] + this.pathOffset.lon;
          
          // Calculate distance to segment midpoint for simplicity
          const midLon = (lon1 + lon2) / 2;
          const midLat = (lat1 + lat2) / 2;
          
          const distance = this.calculateDistance(
            this.userLat, this.userLon,
            midLat, midLon
          );
          
          if (distance <= this.maxDistance) {
            nearby.push({
              feature: feature,
              segment: [point1, point2],
              distance: distance
            });
          }
        }
      }
    });
    
    return nearby;
  }

  drawPath(pathData) {
    const segment = pathData.segment;
    const point1 = segment[0]; // [lon, lat]
    const point2 = segment[1];
    
    // Apply offset if in testing mode
    let lat1 = point1[1] + this.pathOffset.lat;
    let lon1 = point1[0] + this.pathOffset.lon;
    let lat2 = point2[1] + this.pathOffset.lat;
    let lon2 = point2[0] + this.pathOffset.lon;
    
    // Project both points
    const proj1 = this.projectPoint(lat1, lon1);
    const proj2 = this.projectPoint(lat2, lon2);
    
    if (!proj1 || !proj2) return;
    
    // Draw line - 3x thicker (was 4, now 12)
    this.ctx.strokeStyle = 'rgba(0, 150, 255, 0.8)';
    this.ctx.lineWidth = 12;
    this.ctx.lineCap = 'round';
    
    this.ctx.beginPath();
    this.ctx.moveTo(proj1.x, proj1.y);
    this.ctx.lineTo(proj2.x, proj2.y);
    this.ctx.stroke();
    
    // Draw distance label at midpoint
    const midX = (proj1.x + proj2.x) / 2;
    const midY = (proj1.y + proj2.y) / 2;
    
    const distance = Math.round(pathData.distance);
    this.drawLabel(`${distance}m`, midX, midY);
  }

  drawLabel(text, x, y) {
    this.ctx.font = '14px Arial';
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    
    const padding = 8;
    const metrics = this.ctx.measureText(text);
    const width = metrics.width + padding * 2;
    const height = 20;
    
    // Background
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    this.ctx.fillRect(x - width/2, y - height/2, width, height);
    
    // Text
    this.ctx.fillStyle = 'white';
    this.ctx.fillText(text, x, y);
  }

  projectPoint(lat, lon) {
    // Calculate bearing from user to point
    const bearing = this.calculateBearing(
      this.userLat, this.userLon,
      lat, lon
    );
    
    // Calculate relative angle to user's heading
    let relativeAngle = bearing - this.userHeading;
    
    // Normalize to -180 to 180
    while (relativeAngle > 180) relativeAngle -= 360;
    while (relativeAngle < -180) relativeAngle += 360;
    
    // Check if point is within field of view
    const halfFov = this.fov / 2;
    if (Math.abs(relativeAngle) > halfFov) {
      return null; // Outside of view
    }
    
    // Calculate distance
    const distance = this.calculateDistance(
      this.userLat, this.userLon,
      lat, lon
    );
    
    // Project to screen coordinates
    // x: map angle to screen width
    const x = this.canvas.width / 2 + 
              (relativeAngle / this.fov) * this.canvas.width;
    
    // y: map distance to screen height (closer = lower on screen)
    // This is a simple projection - more sophisticated AR would use device tilt
    const maxViewDistance = 50; // meters
    const normalizedDistance = Math.min(distance / maxViewDistance, 1);
    const y = this.canvas.height * (0.5 + normalizedDistance * 0.3);
    
    return { x, y, distance };
  }

  calculateDistance(lat1, lon1, lat2, lon2) {
    // Haversine formula for distance in meters
    const R = 6371e3; // Earth radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  }

  calculateBearing(lat1, lon1, lat2, lon2) {
    // Calculate bearing from point 1 to point 2
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) -
              Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
    
    let bearing = Math.atan2(y, x) * 180 / Math.PI;
    
    // Normalize to 0-360
    bearing = (bearing + 360) % 360;
    
    return bearing;
  }

  setupManualControls() {
    console.log('Setting up manual controls...');
    
    // Manual location toggle
    const manualToggle = document.getElementById('manual-location-toggle');
    const manualInputs = document.getElementById('manual-location-inputs');
    const setLocationBtn = document.getElementById('set-manual-location');
    
    if (!manualToggle || !manualInputs || !setLocationBtn) {
      console.error('Manual control elements not found!');
      return;
    }
    
    manualToggle.addEventListener('change', (e) => {
      console.log('Manual location toggle:', e.target.checked);
      this.manualLocationMode = e.target.checked;
      manualInputs.style.display = e.target.checked ? 'block' : 'none';
      
      if (e.target.checked) {
        document.getElementById('location-accuracy').textContent = 'Manual';
        // Auto-set initial location
        const lat = parseFloat(document.getElementById('manual-lat').value);
        const lon = parseFloat(document.getElementById('manual-lon').value);
        if (!isNaN(lat) && !isNaN(lon)) {
          this.userLat = lat;
          this.userLon = lon;
          document.getElementById('user-location').textContent = 
            `${lat.toFixed(6)}, ${lon.toFixed(6)} (Manual)`;
        }
      }
    });
    
    setLocationBtn.addEventListener('click', () => {
      console.log('Set location button clicked');
      const lat = parseFloat(document.getElementById('manual-lat').value);
      const lon = parseFloat(document.getElementById('manual-lon').value);
      
      if (!isNaN(lat) && !isNaN(lon)) {
        this.userLat = lat;
        this.userLon = lon;
        document.getElementById('user-location').textContent = 
          `${lat.toFixed(6)}, ${lon.toFixed(6)} (Manual)`;
        console.log(`Manual location set: ${lat}, ${lon}`);
      } else {
        console.error('Invalid coordinates:', { lat, lon });
      }
    });
    
    // Manual heading toggle
    const headingToggle = document.getElementById('manual-heading-toggle');
    const headingInput = document.getElementById('manual-heading');
    
    if (headingToggle && headingInput) {
      headingToggle.addEventListener('change', (e) => {
        console.log('Manual heading toggle:', e.target.checked);
        this.manualHeadingMode = e.target.checked;
        headingInput.disabled = !e.target.checked;
        
        if (e.target.checked) {
          this.userHeading = parseFloat(headingInput.value) || 0;
          document.getElementById('user-heading').textContent = 
            Math.round(this.userHeading) + ' (Manual)';
        }
      });
      
      headingInput.addEventListener('input', (e) => {
        if (this.manualHeadingMode) {
          this.userHeading = parseFloat(e.target.value) || 0;
          document.getElementById('user-heading').textContent = 
            Math.round(this.userHeading) + ' (Manual)';
   
  
  movePathsToMyLocation() {
    if (!this.userLat || !this.userLon) {
      alert('Wait for GPS location first!');
      return;
    }
    
    if (this.footpaths.length === 0) {
      alert('No footpaths loaded!');
      return;
    }
    
    // Get first point of first path
    const firstPath = this.footpaths[0];
    if (firstPath.geometry.type === 'LineString' && firstPath.geometry.coordinates.length > 0) {
      const firstPoint = firstPath.geometry.coordinates[0];
      
      // Calculate offset needed to move first point to user location
      this.pathOffset.lat = this.userLat - firstPoint[1];
      this.pathOffset.lon = this.userLon - firstPoint[0];
      
      this.testingMode = true;
      
      console.log('Testing mode enabled - paths moved to your location');
      console.log('Offset:', this.pathOffset);
      
      const btn = document.getElementById('test-mode-btn');
      if (btn) {
        btn.textContent = 'Reset Paths to Real Location';
        btn.style.background = '#ff6600';
      }
    }
  }
  
  resetPathLocations() {
    this.pathOffset = { lat: 0, lon: 0 };
  window.arView = new ARFootpathView();
  
  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    window.const btn = document.getElementById('test-mode-btn');
    if (btn) {
      btn.textContent = 'Move Paths to My Location (Testing)';
      btn.style.background = '#0096ff';
    }
  }
  
  toggleTestingMode() {
    if (this.testingMode) {
      this.resetPathLocations();
    } else {
      this.movePathsToMyLocation();
    }
  }       console.log('Manual heading set:', this.userHeading);
        }
      });
    }
    
    console.log('Manual controls setup complete');
  }

  showError(message) {
    const errorDiv = document.getElementById('error-message');
    const errorText = document.getElementById('error-text');
    if (errorText) {
      errorText.textContent = message;
    } else {
      errorDiv.textContent = message;
    }
    errorDiv.style.display = 'block';
    document.getElementById('loading').style.display = 'none';
    console.error('AR Error displayed:', message);
  }

  cleanup() {
    if (this.watchId) {
      navigator.geolocation.clearWatch(this.watchId);
    }
    if (this.orientationHandler) {
      window.removeEventListener('deviceorientation', this.orientationHandler);
      window.removeEventListener('deviceorientationabsolute', this.orientationHandler);
    }
    if (this.video && this.video.srcObject) {
      this.video.srcObject.getTracks().forEach(track => track.stop());
    }
  }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
  const arView = new ARFootpathView();
  
  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    arView.cleanup();
  });
});

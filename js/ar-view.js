/**
 * AR Memorial View
 * Displays memorial images overlaid on device camera
 * using GPS location and device orientation
 */

class ARMemorialView {
  constructor() {
    // TESTING MODE - Force location for development
    this.forcedTestLocation = true;
    this.testLat = 52.728256; // 52°43'41.72"N
    this.testLon = -1.729161; // 1°43'44.98"W
    
    this.userLat = null;
    this.userLon = null;
    this.userHeading = 0;
    this.userPitch = 0; // Device tilt (up/down)
    this.memorials = [];
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
    
    // Memorial AR specific
    this.memorialElements = new Map(); // Track image elements for each memorial
    this.preloadedImages = new Map(); // Preloaded images
    
    // Smoothing for GPS and heading
    this.locationHistory = [];
    this.headingHistory = [];
    this.pitchHistory = [];
    this.smoothingWindow = 20; // Increased to 20 for maximum stability
    this.minHeadingChange = 3; // Increased to 3 degrees to reduce jitter
    this.minLocationChange = 0.00001; // Increased threshold - ignore more GPS drift
    this.minPitchChange = 1; // Reduced to 1 degree for responsive tilt
    
    // Search functionality
    this.searchQuery = '';
    this.searchActive = false;
    
    // Camera field of view (adjustable based on device)
    this.fov = 60; // degrees
    this.maxDistance = 50; // meters - default max distance to show memorials
    this.searchMaxDistance = 200; // meters - max distance when searching for a specific memorial
    this.minDistance = 5; // meters - minimum distance to show memorial
    
    // Image sizing
    this.baseImageSize = 150; // pixels at close range
    this.minImageSize = 50; // pixels at max distance
    
    // Check if this is iOS/mobile
    this.isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    
    // Set forced test location if enabled
    if (this.forcedTestLocation) {
      this.userLat = this.testLat;
      this.userLon = this.testLon;
      console.log(`🔧 FORCED TEST LOCATION: ${this.testLat}, ${this.testLon}`);
    }
    
    // Always require user interaction for better cross-browser compatibility
    console.log('Waiting for user to click Start button...');
    this.setupStartButton();
  }

  setupStartButton() {
    console.log('=== setupStartButton() called ===');
    console.log('Document ready state:', document.readyState);
    console.log('User agent:', navigator.userAgent);
    console.log('Is mobile:', this.isMobile);
    
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      console.log('DOM still loading, waiting for DOMContentLoaded event...');
      document.addEventListener('DOMContentLoaded', () => {
        console.log('DOMContentLoaded event fired!');
        this.setupStartButtonElements();
      });
    } else {
      console.log('DOM already ready, setting up button elements immediately');
      this.setupStartButtonElements();
    }
    
    // Failsafe: try again after a short delay in case of timing issues
    setTimeout(() => {
      const startScreen = document.getElementById('start-button-screen');
      if (startScreen && startScreen.style.display === 'none') {
        console.warn('FAILSAFE: Button still hidden after delay, attempting to show again...');
        this.setupStartButtonElements();
      }
    }, 100);
  }
  
  setupStartButtonElements() {
    console.log('=== setupStartButtonElements() called ===');
    const startScreen = document.getElementById('start-button-screen');
    const startButton = document.getElementById('start-ar-button');
    const loading = document.getElementById('loading');
    
    console.log('Elements found:', {
      startScreen: !!startScreen,
      startButton: !!startButton,
      loading: !!loading
    });
    
    if (!startScreen || !startButton || !loading) {
      console.error('CRITICAL: Start button elements not found!');
      console.error('Missing elements:', {
        'start-button-screen': !startScreen,
        'start-ar-button': !startButton,
        'loading': !loading
      });
      console.error('All body elements:', document.body ? document.body.children.length : 'NO BODY');
      return;
    }
    
    console.log('All elements found! Showing start screen...');
    console.log('Loading display before:', loading.style.display);
    console.log('Start screen display before:', startScreen.style.display);
    
    loading.style.display = 'none';
    startScreen.style.display = 'flex';
    
    console.log('Loading display after:', loading.style.display);
    console.log('Start screen display after:', startScreen.style.display);
    
    startButton.addEventListener('click', () => {
      console.log('=== START BUTTON CLICKED ===');
      console.log('Time:', new Date().toISOString());
      this.userInteracted = true;
      startScreen.style.display = 'none';
      loading.style.display = 'flex';
      this.init();
    });
    
    console.log('Start button click handler attached successfully!');
  }

  async init() {
    // Setup manual controls first so they work even if camera fails
    console.log('========================================');
    console.log('AR Memorial View v3.0 - Build 2026-04-16');
    console.log('Mobile device:', this.isMobile);
    console.log('User interacted:', this.userInteracted);
    console.log('User agent:', navigator.userAgent);
    console.log('Forced Test Location:', this.forcedTestLocation ? 'ENABLED' : 'DISABLED');
    if (this.forcedTestLocation) {
      console.log('Test Location:', this.testLat, this.testLon);
    }
    console.log('========================================');
    console.log('AR View: Setting up manual controls...');
    this.setupManualControls();
    this.setupSearchControls();
    
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
        </div>
      `;
    }, 10000); // 10 second timeout
    
    console.log('AR View: Starting initialization...');
    
    // Load memorials data
    try {
      console.log('AR View: Loading memorials...');
      await this.loadMemorials();
      console.log('AR View: Memorials loaded successfully');
    } catch (error) {
      this.showError('Failed to load memorials: ' + error.message);
      console.error('Memorials loading error:', error);
      return;
    }
    
    // Setup canvas (always needed for overlay container)
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
    
    // Get user location (optional if using forced location)
    if (!this.forcedTestLocation) {
      console.log('AR View: Starting location tracking...');
      this.startLocationTracking();
    } else {
      console.log('AR View: Using forced test location - skipping GPS');
      document.getElementById('user-location').textContent = 
        `${this.testLat.toFixed(6)}, ${this.testLon.toFixed(6)} (TEST MODE)`;
      document.getElementById('location-accuracy').textContent = 'Forced';
    }
    
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
      alert('Camera not available. You can still test with manual heading controls.');
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

  async loadMemorials() {
    try {
      console.log('Fetching memorials from: ../data/memorials.json');
      const response = await fetch('../data/memorials.json');
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!Array.isArray(data)) {
        throw new Error('Invalid memorials data format');
      }
      
      // Filter memorials that have valid coordinates
      this.memorials = data.filter(memorial => {
        const lat = parseFloat(memorial.lat || memorial.location?.lat);
        const lng = parseFloat(memorial.lng || memorial.location?.lng);
        return !isNaN(lat) && !isNaN(lng);
      }).map(memorial => {
        // Normalize the data structure
        const lat = parseFloat(memorial.lat || memorial.location?.lat);
        const lng = parseFloat(memorial.lng || memorial.location?.lng);
        return {
          name: memorial.name,
          zone: memorial.zone,
          lat: lat,
          lng: lng,
          description: memorial.description
        };
      });
      
      console.log(`Loaded ${this.memorials.length} memorials with valid coordinates`);
      
      // Preload images for memorials
      await this.preloadMemorialImages();
      
    } catch (error) {
      console.error('Memorials loading error:', error);
      throw new Error('Could not load memorials data: ' + error.message);
    }
  }
  
  async preloadMemorialImages() {
    console.log('Preloading memorial images...');
    let loaded = 0;
    let failed = 0;
    
    const promises = this.memorials.map(memorial => {
      return new Promise((resolve) => {
        const img = new Image();
        const imagePath = `../img/zone${memorial.zone}/${memorial.name}.jpeg`;
        
        img.onload = () => {
          this.preloadedImages.set(memorial.name, img);
          loaded++;
          resolve();
        };
        
        img.onerror = () => {
          console.warn(`Failed to load image for: ${memorial.name}`);
          failed++;
          resolve();
        };
        
        img.src = imagePath;
      });
    });
    
    await Promise.all(promises);
    console.log(`Preloaded ${loaded} images, ${failed} failed`);
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
    if (this.forcedTestLocation) return; // Ignore GPS updates when using forced location
    if (this.manualLocationMode) return; // Ignore GPS updates in manual mode
    
    const newLat = position.coords.latitude;
    const newLon = position.coords.longitude;
    
    // Check if change is significant (reduce GPS drift)
    if (this.userLat !== null && this.userLon !== null) {
      const latDiff = Math.abs(newLat - this.userLat);
      const lonDiff = Math.abs(newLon - this.userLon);
      
      if (latDiff < this.minLocationChange && lonDiff < this.minLocationChange) {
        // Change too small, skip to prevent jitter
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
    
    console.log(`Location updated: ${this.userLat}, ${this.userLon} (±${accuracy}m)`);
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
            console.log('Orientation permission response:', response);
            if (response === 'granted') {
              this.startOrientationTracking();
              requestBtn.remove();
            } else {
              console.warn('Orientation permission denied');
              requestBtn.textContent = 'Permission Denied - Use Manual Heading';
              requestBtn.style.background = '#cc0000';
            }
          })
          .catch(err => {
            console.error('Orientation permission error:', err);
            requestBtn.textContent = 'Error - Use Manual Heading';
            requestBtn.style.background = '#cc0000';
          });
      };
      document.body.appendChild(requestBtn);
    } else {
      // Non-iOS or older iOS
      console.log('Direct orientation access (no permission needed)');
      this.startOrientationTracking();
    }
  }

  startOrientationTracking() {
    // Use DeviceOrientationEvent for compass heading and device tilt
    this.orientationHandler = (event) => {
      if (this.manualHeadingMode) return; // Ignore device orientation in manual mode
      
      if (event.alpha !== null) {
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
      
      // Track pitch (device tilt up/down) - beta property
      // beta: -180 to 180 (negative = tilted up, positive = tilted down)
      if (event.beta !== null) {
        let newPitch = event.beta;
        
        // Normalize to -90 to 90 (clamped to reasonable tilt range)
        newPitch = Math.max(-90, Math.min(90, newPitch));
        
        // Add to history for smoothing
        this.pitchHistory.push(newPitch);
        if (this.pitchHistory.length > 5) { // Smaller window for more responsive tilt
          this.pitchHistory.shift();
        }
        
        // Calculate smoothed average
        let avgPitch = 0;
        this.pitchHistory.forEach(p => avgPitch += p);
        avgPitch /= this.pitchHistory.length;
        
        this.userPitch = avgPitch;
        
        // Debug log
        if (Math.abs(avgPitch) > 5) {
          console.log('Device pitch:', avgPitch.toFixed(1) + '°');
        }
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
    
    let avgRad = Math.atan2(y, x);
    let avgDeg = avgRad * 180 / Math.PI;
    
    // Normalize to 0-360
    return ((avgDeg % 360) + 360) % 360;
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
    
    // Remove all existing memorial elements
    this.memorialElements.forEach(element => {
      if (element.parentNode) {
        element.parentNode.removeChild(element);
      }
    });
    this.memorialElements.clear();
    
    if (!this.userLat || !this.userLon) {
      return; // Wait for location
    }

    // Find nearby memorials
    const nearbyMemorials = this.findNearbyMemorials();
    document.getElementById('paths-count').textContent = nearbyMemorials.length;
    
    // Draw each memorial
    nearbyMemorials.forEach(memorialData => {
      this.drawMemorial(memorialData);
    });
    
    // Update directional arrow if search is active
    if (this.searchActive) {
      this.updateDirectionalArrow();
    }
  }

  findNearbyMemorials() {
    const nearby = [];
    
    // Use larger distance when searching for a specific memorial
    const effectiveMaxDistance = this.searchActive ? this.searchMaxDistance : this.maxDistance;
    
    this.memorials.forEach(memorial => {
      // Apply search filter if active
      if (this.searchActive && this.searchQuery) {
        if (!memorial.name.toLowerCase().includes(this.searchQuery.toLowerCase())) {
          return; // Skip this memorial
        }
      }
      
      const distance = this.calculateDistance(
        this.userLat, this.userLon,
        memorial.lat, memorial.lng
      );
      
      // Use effectiveMaxDistance (50m default, 200m when searching)
      if (distance >= this.minDistance && distance <= effectiveMaxDistance) {
        nearby.push({
          memorial: memorial,
          distance: distance
        });
      }
    });
    
    // Sort by distance (closest first)
    nearby.sort((a, b) => a.distance - b.distance);
    
    console.log(`Showing ${nearby.length} memorials within ${effectiveMaxDistance}m`);
    
    return nearby;
  }

  drawMemorial(memorialData) {
    const memorial = memorialData.memorial;
    const distance = memorialData.distance;
    
    // Project the memorial location to screen coordinates
    const projection = this.projectPoint(memorial.lat, memorial.lng);
    
    if (!projection) return; // Memorial not in view
    
    // Get preloaded image
    const img = this.preloadedImages.get(memorial.name);
    if (!img) {
      // Draw placeholder if image not available
      this.drawPlaceholder(memorial.name, projection.x, projection.y, distance);
      return;
    }
    
    // Calculate image size based on distance
    const distanceRatio = 1 - (distance / this.maxDistance);
    const imageSize = this.minImageSize + (this.baseImageSize - this.minImageSize) * distanceRatio;
    
    // Click/Touch handlers for cross-platform compatibility (defined before element check)
    const showPopup = (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.showMemorialPopup(memorial, distance, img.src);
    };
    
    // Create or update image element
    let imgElement = this.memorialElements.get(memorial.name);
    if (!imgElement) {
      imgElement = document.createElement('div');
      imgElement.className = 'ar-memorial-image';
      imgElement.style.position = 'absolute';
      imgElement.style.cursor = 'pointer';
      imgElement.style.transition = 'all 0.3s ease';
      imgElement.style.zIndex = '500';
      
      // Image
      const imgTag = document.createElement('img');
      imgTag.src = img.src;
      imgTag.style.width = '100%';
      imgTag.style.height = '100%';
      imgTag.style.objectFit = 'cover';
      imgTag.style.borderRadius = '10px';
      imgTag.style.border = '3px solid rgba(0, 150, 255, 0.8)';
      imgTag.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.5)';
      
      // Label - positioned well below image to avoid overlap
      const label = document.createElement('div');
      label.textContent = `${memorial.name} (${Math.round(distance)}m)`;
      label.style.position = 'absolute';
      label.style.bottom = '-45px'; // Increased from -30px to ensure it's below image
      label.style.left = '50%';
      label.style.transform = 'translateX(-50%)';
      label.style.background = 'rgba(0, 0, 0, 0.8)';
      label.style.color = 'white';
      label.style.padding = '4px 8px';
      label.style.borderRadius = '5px';
      label.style.fontSize = '11px';
      label.style.whiteSpace = 'normal';
      label.style.wordWrap = 'break-word';
      label.style.maxWidth = '250px';
      label.style.textAlign = 'center';
      label.style.lineHeight = '1.3';
      
      imgElement.appendChild(imgTag);
      imgElement.appendChild(label);
      
      // Add event listeners
      imgElement.addEventListener('click', showPopup);
      imgElement.addEventListener('touchend', showPopup);
      
      this.memorialElements.set(memorial.name, imgElement);
      document.getElementById('ar-scene').appendChild(imgElement);
    }
    
    // Update position and size
    imgElement.style.left = `${projection.x - imageSize / 2}px`;
    imgElement.style.top = `${projection.y - imageSize / 2}px`;
    imgElement.style.width = `${imageSize}px`;
    imgElement.style.height = `${imageSize}px`;
    
    // Update distance in label
    const label = imgElement.querySelector('div');
    if (label) {
      label.textContent = `${memorial.name} (${Math.round(distance)}m)`;
    }
  }

  drawPlaceholder(name, x, y, distance) {
    // Draw a simple circle placeholder when image is not available
    this.ctx.beginPath();
    this.ctx.arc(x, y, 30, 0, 2 * Math.PI);
    this.ctx.fillStyle = 'rgba(0, 150, 255, 0.6)';
    this.ctx.fill();
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    this.ctx.lineWidth = 2;
    this.ctx.stroke();
    
    // Draw name
    this.drawLabel(`${name.substring(0, 20)}...\n${Math.round(distance)}m`, x, y + 45);
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

  showMemorialPopup(memorial, distance, imageSrc) {
    // Remove existing popup if any
    const existingPopup = document.getElementById('ar-memorial-popup');
    if (existingPopup) {
      existingPopup.remove();
    }

    // Create popup overlay
    const popup = document.createElement('div');
    popup.id = 'ar-memorial-popup';
    popup.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100vh;
      background: rgba(0, 0, 0, 0.9);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow-y: auto;
      padding: 20px;
      box-sizing: border-box;
    `;

    // Create popup content
    const content = document.createElement('div');
    content.style.cssText = `
      background: white;
      border-radius: 12px;
      max-width: 600px;
      width: 100%;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
      position: relative;
    `;

    // Content HTML
    content.innerHTML = `
      <div style="padding: 20px; padding-top: 50px;">
        <h2 style="margin-top: 0; color: #333;">${memorial.name}</h2>
        <p style="color: #666; font-size: 14px; margin: 5px 0;">
          <strong>Zone:</strong> ${memorial.zone} | 
          <strong>Distance:</strong> ${Math.round(distance)}m away
        </p>
        <div style="margin: 15px 0;">
          <img src="${imageSrc}" 
               alt="${memorial.name}" 
               style="width: 100%; height: auto; border-radius: 8px; border: 2px solid #ddd;" />
        </div>
        <div style="color: #444; line-height: 1.6; white-space: pre-wrap; font-size: 15px;">
          ${memorial.description || 'No description available.'}
        </div>
      </div>
    `;

    // Orange X close button in top-right corner
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '✕';
    closeBtn.style.cssText = `
      position: fixed;
      top: 15px;
      right: 15px;
      background: #ff6600;
      color: white;
      border: none;
      border-radius: 50%;
      width: 45px;
      height: 45px;
      font-size: 28px;
      font-weight: bold;
      cursor: pointer;
      z-index: 10001;
      box-shadow: 0 4px 12px rgba(255, 102, 0, 0.4);
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    const closePopup = (e) => {
      e.preventDefault();
      e.stopPropagation();
      popup.remove();
    };
    closeBtn.addEventListener('click', closePopup);
    closeBtn.addEventListener('touchend', closePopup);
    
    popup.appendChild(closeBtn);
    popup.appendChild(content);
    document.body.appendChild(popup);

    // Close on background click
    popup.onclick = (e) => {
      if (e.target === popup) {
        popup.remove();
      }
    };
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
    
    // y: Center all memorials vertically (ignore pitch for ground-level memorials)
    // This is important when user is elevated (e.g., second floor) looking at ground-level memorials
    const y = this.canvas.height * 0.5; // Always center vertically
    
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
          console.log('Manual heading set:', this.userHeading);
        }
      });
    }
    
    console.log('Manual controls setup complete');
  }
  
  setupSearchControls() {
    console.log('Setting up search controls...');
    
    const searchBtn = document.getElementById('ar-search-btn');
    const searchPanel = document.getElementById('ar-search-panel');
    const searchInput = document.getElementById('ar-search-input');
    const searchResults = document.getElementById('ar-search-results');
    const clearBtn = document.getElementById('ar-search-clear-btn');
    
    if (!searchBtn || !searchPanel || !searchInput || !searchResults || !clearBtn) {
      console.error('Search control elements not found!');
      return;
    }
    
    let searchDebounce = null;
    const MIN_SEARCH_LENGTH = 2;
    const MAX_RESULTS = 30;
    
    // Toggle search panel
    searchBtn.addEventListener('click', () => {
      const isVisible = searchPanel.style.display !== 'none';
      searchPanel.style.display = isVisible ? 'none' : 'block';
      if (!isVisible) {
        searchInput.focus();
      } else {
        // Clear search when closing panel
        this.clearSearch();
      }
    });
    
    // Search as user types (with debouncing)
    searchInput.addEventListener('input', () => {
      clearTimeout(searchDebounce);
      searchDebounce = setTimeout(() => {
        this.performSearch(searchInput.value.trim());
      }, 300); // 300ms debounce
    });
    
    // Clear search
    clearBtn.addEventListener('click', () => {
      this.clearSearch();
    });
    
    // Helper function to render search results
    this.renderSearchResults = (query) => {
      searchResults.innerHTML = '';
      
      if (query.length < MIN_SEARCH_LENGTH) {
        searchResults.style.display = 'none';
        return;
      }
      
      const queryLower = query.toLowerCase();
      const matches = this.memorials
        .filter(m => m.name.toLowerCase().includes(queryLower))
        .sort((a, b) => a.name.localeCompare(b.name))
        .slice(0, MAX_RESULTS);
      
      if (matches.length === 0) {
        searchResults.innerHTML = '<li style="padding: 10px; color: #666; text-align: center;">No matches</li>';
        searchResults.style.display = 'block';
        return;
      }
      
      matches.forEach(memorial => {
        const li = document.createElement('li');
        li.textContent = memorial.name;
        li.style.cssText = `
          padding: 10px;
          cursor: pointer;
          border-bottom: 1px solid #eee;
          color: #333;
          font-size: 14px;
        `;
        
        // Hover effect
        li.addEventListener('mouseenter', () => {
          li.style.background = '#f0f0f0';
        });
        li.addEventListener('mouseleave', () => {
          li.style.background = 'white';
        });
        
        // Click/Touch to select memorial (cross-platform compatibility)
        const selectHandler = (e) => {
          e.preventDefault();
          this.selectMemorial(memorial.name);
        };
        li.addEventListener('click', selectHandler);
        li.addEventListener('touchend', selectHandler);
        
        searchResults.appendChild(li);
      });
      
      searchResults.style.display = 'block';
    };
    
    // Helper function to perform search (only renders results, does NOT activate search)
    this.performSearch = (query) => {
      this.renderSearchResults(query);
      
      // Don't set searchActive here - user must select a memorial from the list
      // This ensures exact memorial selection, not partial matching
    };
    
    // Helper function to select a memorial
    this.selectMemorial = (memorialName) => {
      searchInput.value = memorialName;
      this.searchQuery = memorialName;
      this.searchActive = true;
      searchResults.style.display = 'none';
      console.log('Memorial selected:', memorialName);
      this.updateDirectionalArrow();
    };
    
    // Helper function to clear search
    this.clearSearch = () => {
      searchInput.value = '';
      searchResults.innerHTML = '';
      searchResults.style.display = 'none';
      this.searchQuery = '';
      this.searchActive = false;
      searchPanel.style.display = 'none';
      document.getElementById('ar-direction-arrow').style.display = 'none';
      console.log('Search cleared');
    };
    
    console.log('Search controls setup complete');
  }
  
  updateDirectionalArrow() {
    if (!this.searchActive || !this.userLat || !this.userLon) {
      document.getElementById('ar-direction-arrow').style.display = 'none';
      return;
    }
    
    // Count how many memorials match the search query
    const matchingMemorials = this.memorials.filter(m => 
      m.name.toLowerCase().includes(this.searchQuery.toLowerCase())
    );
    
    // Only show arrow if EXACTLY 1 memorial matches
    if (matchingMemorials.length !== 1) {
      document.getElementById('ar-direction-arrow').style.display = 'none';
      return;
    }
    
    const searchedMemorial = matchingMemorials[0];
    
    // Check if memorial is on screen
    const projection = this.projectPoint(searchedMemorial.lat, searchedMemorial.lng);
    
    if (!projection) {
      // Memorial is off-screen, show directional arrow
      const bearing = this.calculateBearing(
        this.userLat, this.userLon,
        searchedMemorial.lat, searchedMemorial.lng
      );
      
      let relativeAngle = bearing - this.userHeading;
      while (relativeAngle > 180) relativeAngle -= 360;
      while (relativeAngle < -180) relativeAngle += 360;
      
      // Determine arrow direction
      let arrow = '';
      if (relativeAngle > 15) {
        arrow = '→'; // Turn right
      } else if (relativeAngle < -15) {
        arrow = '←'; // Turn left
      } else {
        arrow = '↑'; // Straight ahead (but may be outside FOV vertically)
      }
      
      const arrowElement = document.getElementById('ar-direction-arrow');
      arrowElement.innerHTML = arrow;
      arrowElement.style.display = 'block';
    } else {
      // Memorial is visible
      document.getElementById('ar-direction-arrow').style.display = 'none';
    }
  }
  
  toggleForcedLocation() {
    this.forcedTestLocation = !this.forcedTestLocation;
    
    if (this.forcedTestLocation) {
      this.userLat = this.testLat;
      this.userLon = this.testLon;
      document.getElementById('user-location').textContent = 
        `${this.testLat.toFixed(6)}, ${this.testLon.toFixed(6)} (TEST MODE)`;
      console.log('🔧 Forced test location ENABLED');
    } else {
      // Resume GPS tracking
      this.userLat = null;
      this.userLon = null;
      console.log('📡 GPS location tracking RESUMED');
    }
    
    const btn = document.getElementById('test-mode-btn');
    if (btn) {
      btn.textContent = this.forcedTestLocation ? 
        'Disable Test Location' : 'Enable Test Location';
      btn.style.background = this.forcedTestLocation ? '#ff6600' : '#0096ff';
    }
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
  window.arView = new ARMemorialView();
  
  // Attach test mode button handler
  const testModeBtn = document.getElementById('test-mode-btn');
  if (testModeBtn) {
    testModeBtn.addEventListener('click', () => {
      console.log('Test mode button clicked');
      if (window.arView) {
        window.arView.toggleForcedLocation();
      }
    });
    console.log('Test mode button handler attached');
  }
  
  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    if (window.arView) {
      window.arView.cleanup();
    }
  });
});

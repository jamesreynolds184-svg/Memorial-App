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
    
    // Camera field of view (adjustable based on device)
    this.fov = 60; // degrees
    this.maxDistance = 100; // meters - max distance to show paths
    
    this.init();
  }

  async init() {
    try {
      // Load footpaths data
      await this.loadFootpaths();
      
      // Setup camera
      await this.setupCamera();
      
      // Setup canvas
      this.setupCanvas();
      
      // Get user location
      this.startLocationTracking();
      
      // Setup device orientation
      this.setupOrientation();
      
      // Setup manual controls
      this.setupManualControls();
      
      // Start rendering
      this.startRendering();
      
      document.getElementById('loading').style.display = 'none';
      
      // Hide calibration notice after 5 seconds
      setTimeout(() => {
        const notice = document.getElementById('calibration-notice');
        if (notice) {
          notice.style.opacity = '0';
          notice.style.transition = 'opacity 1s';
          setTimeout(() => notice.remove(), 1000);
        }
      }, 5000);
      
    } catch (error) {
      this.showError('Failed to initialize AR view: ' + error.message);
      console.error('AR initialization error:', error);
    }
  }

  async loadFootpaths() {
    try {
      const response = await fetch('../data/footpathsTEMP.geojson');
      const data = await response.json();
      this.footpaths = data.features;
      console.log(`Loaded ${this.footpaths.length} footpaths`);
    } catch (error) {
      throw new Error('Could not load footpaths data');
    }
  }

  async setupCamera() {
    try {
      this.video = document.getElementById('camera-view');
      
      // Request camera with environment-facing (rear) camera
      const constraints = {
        video: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.video.srcObject = stream;
      
      return new Promise((resolve) => {
        this.video.onloadedmetadata = () => {
          this.video.play();
          resolve();
        };
      });
    } catch (error) {
      throw new Error('Camera access denied or not available');
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
      this.showError('Geolocation not supported on this device');
      return;
    }

    const options = {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 5000
    };

    this.watchId = navigator.geolocation.watchPosition(
      (position) => this.onLocationUpdate(position),
      (error) => this.onLocationError(error),
      options
    );
  }if (this.manualLocationMode) return; // Ignore GPS updates in manual mode
    
    

  onLocationUpdate(position) {
    this.userLat = position.coords.latitude;
    this.userLon = position.coords.longitude;
    
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
    this.showError(message);
  }

  setupOrientation() {
    // Check if we need to request permission (iOS 13+)
    if (typeof DeviceOrientationEvent !== 'undefined' && 
        typeof DeviceOrientationEvent.requestPermission === 'function') {
      
      DeviceOrientationEvent.requestPermission()
        .then(response => {
          if (response === 'granted') {
            this.startOrientationTracking();
          } else {
            this.showError('Device orientation permission denied');
          }
        })
        .catch(console.error);
    } else {
      // Non-iOS or older iOS
      this.startOrientationTracking();
    }
  }

  startOrientationTracking() {
    // Usethis.manualHeadingMode) return; // Ignore device orientation in manual mode
      
      if ( DeviceOrientationEvent for compass heading
    this.orientationHandler = (event) => {
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
    const render = () => {
      this.renderFrame();
      requestAnimationFrame(render);
    };
    render();
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
          
          // Calculate distance to segment midpoint for simplicity
          const midLon = (point1[0] + point2[0]) / 2;
          const midLat = (point1[1] + point2[1]) / 2;
          
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
    
    // Project both points
    const proj1 = this.projectPoint(point1[1], point1[0]);
    const proj2 = this.projectPoint(point2[1], point2[0]);
    
    if (!proj1 || !proj2) return;
    
    // Draw line
    this.ctx.strokeStyle = 'rgba(0, 150, 255, 0.8)';
    this.ctx.lineWidth = 4;
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
   etupManualControls() {
    // Manual location toggle
    const manualToggle = document.getElementById('manual-location-toggle');
    const manualInputs = document.getElementById('manual-location-inputs');
    const setLocationBtn = document.getElementById('set-manual-location');
    
    manualToggle.addEventListener('change', (e) => {
      this.manualLocationMode = e.target.checked;
      manualInputs.style.display = e.target.checked ? 'block' : 'none';
      
      if (e.target.checked) {
        document.getElementById('location-accuracy').textContent = 'Manual';
      }
    });
    
    setLocationBtn.addEventListener('click', () => {
      const lat = parseFloat(document.getElementById('manual-lat').value);
      const lon = parseFloat(document.getElementById('manual-lon').value);
      
      if (!isNaN(lat) && !isNaN(lon)) {
        this.userLat = lat;
        this.userLon = lon;
        document.getElementById('user-location').textContent = 
          `${lat.toFixed(6)}, ${lon.toFixed(6)} (Manual)`;
        console.log(`Manual location set: ${lat}, ${lon}`);
      }
    });
    
    // Manual heading toggle
    const headingToggle = document.getElementById('manual-heading-toggle');
    const headingInput = document.getElementById('manual-heading');
    
    headingToggle.addEventListener('change', (e) => {
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
      }
    });
  }

  s 
    return bearing;
  }

  showError(message) {
    const errorDiv = document.getElementById('error-message');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    document.getElementById('loading').style.display = 'none';
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

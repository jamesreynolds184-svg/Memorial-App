(() => {
  const checkImagesBtn = document.getElementById('check-images-btn');
  const resultsContainer = document.getElementById('results-container');
  const checkCoordsBtn = document.getElementById('check-coords-btn');
  const coordsResultsContainer = document.getElementById('coords-results-container');
  
  if (!checkImagesBtn || !resultsContainer) return;
  if (!checkCoordsBtn || !coordsResultsContainer) return;

  // Check if image exists
  function imageExists(url) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = url;
    });
  }

  // Main verification function
  async function checkMemorialImages() {
    checkImagesBtn.disabled = true;
    checkImagesBtn.textContent = 'Checking...';
    resultsContainer.style.display = 'block';
    resultsContainer.innerHTML = '<div class="progress">Loading memorials data...</div>';

    try {
      // Load memorials data
      const response = await fetch('../data/memorials.json');
      if (!response.ok) throw new Error('Failed to load memorials data');
      const memorials = await response.json();

      resultsContainer.innerHTML = '<div class="progress">Checking images for ' + memorials.length + ' memorials...</div>';

      const missingImages = [];
      const foundImages = [];
      let checked = 0;

      // Check each memorial
      for (const memorial of memorials) {
        if (!memorial.name || !memorial.zone) {
          missingImages.push({
            name: memorial.name || 'Unknown',
            zone: memorial.zone || 'N/A',
            reason: 'Missing name or zone information'
          });
          checked++;
          continue;
        }

        // Construct image path - images are in ../img/zone<number>/<memorial name>.jpeg
        const imagePath = `../img/zone${memorial.zone}/${memorial.name}.jpeg`;
        const exists = await imageExists(imagePath);

        if (!exists) {
          missingImages.push({
            name: memorial.name,
            zone: memorial.zone,
            path: imagePath
          });
        } else {
          foundImages.push(memorial.name);
        }

        checked++;
        
        // Update progress every 10 memorials
        if (checked % 10 === 0) {
          resultsContainer.innerHTML = `<div class="progress">Checked ${checked} of ${memorials.length} memorials...</div>`;
        }
      }

      // Display results
      displayResults(memorials.length, foundImages.length, missingImages);

    } catch (error) {
      resultsContainer.innerHTML = `<div class="error-item">Error: ${error.message}</div>`;
      console.error('Error checking images:', error);
    } finally {
      checkImagesBtn.disabled = false;
      checkImagesBtn.textContent = 'Check Memorial Images';
    }
  }

  function displayResults(total, found, missing) {
    let html = '<div class="result-section">';
    
    // Statistics
    html += '<div class="result-title">Summary</div>';
    html += `<div class="stat-box">
      <div class="stat-label">Total Memorials</div>
      <div class="stat-value">${total}</div>
    </div>`;
    html += `<div class="stat-box">
      <div class="stat-label">Images Found</div>
      <div class="stat-value">${found}</div>
    </div>`;
    html += `<div class="stat-box">
      <div class="stat-label">Images Missing</div>
      <div class="stat-value ${missing.length > 0 ? 'error' : ''}">${missing.length}</div>
    </div>`;
    html += '</div>';

    // Results
    if (missing.length === 0) {
      html += '<div class="result-section">';
      html += '<div class="success-message">✓ All memorials have corresponding images!</div>';
      html += '</div>';
    } else {
      html += '<div class="result-section">';
      html += '<div class="result-title">Missing Images (' + missing.length + ')</div>';
      html += '<div class="warning-message">The following memorials are missing images:</div><br>';
      
      // Group by zone
      const byZone = {};
      missing.forEach(item => {
        if (!byZone[item.zone]) byZone[item.zone] = [];
        byZone[item.zone].push(item);
      });

      // Display by zone
      Object.keys(byZone).sort((a, b) => {
        const numA = parseInt(a) || 999;
        const numB = parseInt(b) || 999;
        return numA - numB;
      }).forEach(zone => {
        html += `<div style="margin-top: 15px;"><strong>Zone ${zone}:</strong></div>`;
        byZone[zone].forEach(item => {
          html += '<div class="error-item">';
          html += `<strong>${item.name}</strong>`;
          if (item.reason) {
            html += ` - <em>${item.reason}</em>`;
          } else {
            html += `<br><small>Expected: ${item.path}</small>`;
          }
          html += '</div>';
        });
      });
      
      html += '</div>';
    }

    resultsContainer.innerHTML = html;
  }

  // Check coordinates function
  async function checkMemorialCoordinates() {
    checkCoordsBtn.disabled = true;
    checkCoordsBtn.textContent = 'Checking...';
    coordsResultsContainer.style.display = 'block';
    coordsResultsContainer.innerHTML = '<div class="progress">Loading memorials data...</div>';

    try {
      // Load memorials data
      const response = await fetch('../data/memorials.json');
      if (!response.ok) throw new Error('Failed to load memorials data');
      const memorials = await response.json();

      coordsResultsContainer.innerHTML = '<div class="progress">Checking coordinates for ' + memorials.length + ' memorials...</div>';

      const missingCoords = [];
      const invalidCoords = [];
      const validCoords = [];

      // Check each memorial
      memorials.forEach((memorial, index) => {
        const name = memorial.name || `Unknown (index ${index})`;
        const zone = memorial.zone || 'N/A';

        // Check for coordinates in multiple possible formats
        let lat = memorial.lat;
        let lng = memorial.lng;

        // Also check location object
        if (memorial.location) {
          if (lat === undefined) lat = memorial.location.lat;
          if (lng === undefined) lng = memorial.location.lng;
        }

        // Check if coordinates exist
        if (lat === undefined || lng === undefined || lat === null || lng === null) {
          missingCoords.push({ name, zone, reason: 'Missing lat or lng' });
        } 
        // Check if coordinates are valid numbers
        else {
          const latNum = parseFloat(lat);
          const lngNum = parseFloat(lng);
          
          if (isNaN(latNum) || isNaN(lngNum)) {
            invalidCoords.push({ name, zone, lat, lng, reason: 'Invalid number format' });
          }
          // Check if coordinates are in reasonable range (UK roughly 49-61°N, -8-2°E)
          else if (latNum < 49 || latNum > 61 || lngNum < -8 || lngNum > 2) {
            invalidCoords.push({ name, zone, lat: latNum, lng: lngNum, reason: 'Out of UK range' });
          }
          else {
            validCoords.push(name);
          }
        }
      });

      // Display results
      displayCoordinateResults(memorials.length, validCoords.length, missingCoords, invalidCoords);

    } catch (error) {
      coordsResultsContainer.innerHTML = `<div class="error-item">Error: ${error.message}</div>`;
      console.error('Error checking coordinates:', error);
    } finally {
      checkCoordsBtn.disabled = false;
      checkCoordsBtn.textContent = 'Check Memorial Coordinates';
    }
  }

  function displayCoordinateResults(total, valid, missing, invalid) {
    let html = '<div class="result-section">';
    
    // Statistics
    html += '<div class="result-title">Summary</div>';
    html += `<div class="stat-box">
      <div class="stat-label">Total Memorials</div>
      <div class="stat-value">${total}</div>
    </div>`;
    html += `<div class="stat-box">
      <div class="stat-label">Valid Coordinates</div>
      <div class="stat-value">${valid}</div>
    </div>`;
    html += `<div class="stat-box">
      <div class="stat-label">Missing Coordinates</div>
      <div class="stat-value ${missing.length > 0 ? 'error' : ''}">${missing.length}</div>
    </div>`;
    html += `<div class="stat-box">
      <div class="stat-label">Invalid Coordinates</div>
      <div class="stat-value ${invalid.length > 0 ? 'error' : ''}">${invalid.length}</div>
    </div>`;
    html += '</div>';

    // Results
    if (missing.length === 0 && invalid.length === 0) {
      html += '<div class="result-section">';
      html += '<div class="success-message">✓ All memorials have valid coordinates!</div>';
      html += '</div>';
    } else {
      // Missing coordinates
      if (missing.length > 0) {
        html += '<div class="result-section">';
        html += '<div class="result-title">Missing Coordinates (' + missing.length + ')</div>';
        html += '<div class="warning-message">The following memorials are missing coordinates:</div><br>';
        
        // Group by zone
        const byZone = {};
        missing.forEach(item => {
          if (!byZone[item.zone]) byZone[item.zone] = [];
          byZone[item.zone].push(item);
        });

        Object.keys(byZone).sort((a, b) => {
          const numA = parseInt(a) || 999;
          const numB = parseInt(b) || 999;
          return numA - numB;
        }).forEach(zone => {
          html += `<div style="margin-top: 15px;"><strong>Zone ${zone}:</strong></div>`;
          byZone[zone].forEach(item => {
            html += '<div class="error-item">';
            html += `<strong>${item.name}</strong> - <em>${item.reason}</em>`;
            html += '</div>';
          });
        });
        
        html += '</div>';
      }

      // Invalid coordinates
      if (invalid.length > 0) {
        html += '<div class="result-section">';
        html += '<div class="result-title">Invalid Coordinates (' + invalid.length + ')</div>';
        html += '<div class="warning-message">The following memorials have invalid coordinates:</div><br>';
        
        // Group by zone
        const byZone = {};
        invalid.forEach(item => {
          if (!byZone[item.zone]) byZone[item.zone] = [];
          byZone[item.zone].push(item);
        });

        Object.keys(byZone).sort((a, b) => {
          const numA = parseInt(a) || 999;
          const numB = parseInt(b) || 999;
          return numA - numB;
        }).forEach(zone => {
          html += `<div style="margin-top: 15px;"><strong>Zone ${zone}:</strong></div>`;
          byZone[zone].forEach(item => {
            html += '<div class="error-item">';
            html += `<strong>${item.name}</strong> - <em>${item.reason}</em>`;
            if (item.lat !== undefined && item.lng !== undefined) {
              html += `<br><small>Current: lat=${item.lat}, lng=${item.lng}</small>`;
            }
            html += '</div>';
          });
        });
        
        html += '</div>';
      }
    }

    coordsResultsContainer.innerHTML = html;
  }

  // Add event listeners
  checkImagesBtn.addEventListener('click', checkMemorialImages);
  checkCoordsBtn.addEventListener('click', checkMemorialCoordinates);
})();

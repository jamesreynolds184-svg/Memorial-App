(function () {
  const params = new URLSearchParams(location.search);
  const name = params.get('name');
  const service = params.get('service');
  const date = params.get('date');
  const panel = params.get('panel');
  const panel_Loc = params.get('panel_Loc');
  
  const root = document.getElementById('afm-detail');

  // Set up back button navigation
  const backBtn = document.getElementById('back-btn');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      // Go back to AFM list page
      window.location.href = 'afm-list.html';
    });
  }

  if (!root) {
    console.error('#afm-detail not found');
    return;
  }
  
  if (!name) {
    root.innerHTML = '<p>Missing person name.</p>';
    return;
  }

  // Display the data
  const nameEl = document.getElementById('afm-name');
  const serviceEl = document.getElementById('afm-service');
  const yearEl = document.getElementById('afm-year');
  const panelEl = document.getElementById('afm-panel');
  const locationEl = document.getElementById('afm-location');

  if (nameEl) {
    nameEl.textContent = name;
  }

  if (serviceEl) {
    if (service && service !== 'null' && service !== '') {
      const badge = document.createElement('span');
      badge.className = 'service-badge-large';
      
      // Add service-specific class
      if (service === 'Army') {
        badge.classList.add('service-army');
      } else if (service === 'Royal Navy') {
        badge.classList.add('service-navy');
      } else if (service === 'Royal Air Force') {
        badge.classList.add('service-raf');
      }
      
      badge.textContent = service;
      serviceEl.appendChild(badge);
    } else {
      serviceEl.textContent = 'Unknown';
    }
  }

  if (yearEl) {
    yearEl.textContent = (date && date !== 'null' && date !== '') ? date : 'Unknown';
  }

  if (panelEl) {
    panelEl.textContent = (panel && panel !== 'null' && panel !== '') ? panel : 'Unknown';
  }

  if (locationEl) {
    if (panel_Loc && panel_Loc !== 'null' && panel_Loc !== '') {
      const badge = document.createElement('span');
      badge.className = 'panel-location-badge ' + panel_Loc.toLowerCase();
      badge.textContent = panel_Loc;
      locationEl.appendChild(badge);
    } else {
      locationEl.textContent = 'Unknown';
    }
  }

  // Load panel location map
  if (panel && panel !== 'null' && panel !== '') {
    const panelNumber = parseInt(panel);
    
    // Determine which wall JSON file to load based on panel number
    // Panels 1-77: AFM-Wall-A.json
    // Panels 78-118: AFM-Wall-B.json
    let wallFile, pinIndex;
    if (panelNumber >= 1 && panelNumber <= 77) {
      wallFile = '../data/AFM-Wall-A.json';
      pinIndex = panelNumber - 1; // Panel 1 = index 0
    } else if (panelNumber >= 78 && panelNumber <= 118) {
      wallFile = '../data/AFM-Wall-B.json';
      pinIndex = panelNumber - 78; // Panel 78 = index 0
    } else {
      console.error(`Invalid panel number: ${panelNumber}`);
      return;
    }
    
    // Load the appropriate wall JSON file to get pin coordinates
    fetch(wallFile)
      .then(response => response.json())
      .then(data => {
        if (pinIndex >= 0 && pinIndex < data.features.length) {
          const coordinates = data.features[pinIndex].geometry.coordinates;
          const [lng, lat] = coordinates;
          
          // Show map section
          const mapSection = document.getElementById('panel-map-section');
          mapSection.style.display = 'block';
          
          // Fixed center point for all panels
          const mapCenter = [52.72743177636369, -1.7278725375796];
          
          // Create Leaflet map
          const map = L.map('panel-map', {
            center: mapCenter,
            zoom: 22,
            zoomControl: false,
            scrollWheelZoom: false,
            dragging: false,
            touchZoom: false,
            doubleClickZoom: false,
            boxZoom: false,
            keyboard: false
          });
          
          // Add satellite tiles
          L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: 'Esri, DigitalGlobe, GeoEye, Earthstar Geographics',
            maxZoom: 19
          }).addTo(map);
          
          // Add marker for the panel location
          const marker = L.marker([lat, lng], {
            title: `Panel ${panelNumber}`
          }).addTo(map);
          
          marker.bindPopup(`<b>Panel ${panelNumber}</b><br>${name}`);
          
          console.log(`Loaded map for Panel ${panelNumber} at [${lat}, ${lng}] from ${wallFile}`);
        }
      })
      .catch(error => {
        console.error('Error loading panel map:', error);
      });
  }

  // Update page title
  document.title = `${name} - Armed Forces Memorial`;
})();

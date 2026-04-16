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
    // Panels 119-134: AFM-Wall-C.json
    // Panels 135-150: AFM-Wall-D.json
    // Panels 151-166: AFM-Wall-E.json
    // Panels 167-182: AFM-Wall-F.json
    // Panels 183-205: AFM-Wall-G.json
    // Panels 207-223: AFM-Wall-H.json
    // Panels 224-230: AFM-Wall-I.json
    let wallFile, pinIndex;
    if (panelNumber >= 1 && panelNumber <= 77) {
      wallFile = '../data/AFM-Wall-A.json';
      pinIndex = panelNumber - 1; // Panel 1 = index 0
    } else if (panelNumber >= 78 && panelNumber <= 118) {
      wallFile = '../data/AFM-Wall-B.json';
      pinIndex = panelNumber - 78; // Panel 78 = index 0
    } else if (panelNumber >= 119 && panelNumber <= 134) {
      wallFile = '../data/AFM-Wall-C.json';
      pinIndex = panelNumber - 119; // Panel 119 = index 0
    } else if (panelNumber >= 135 && panelNumber <= 150) {
      wallFile = '../data/AFM-Wall-D.json';
      pinIndex = panelNumber - 135; // Panel 135 = index 0
    } else if (panelNumber >= 151 && panelNumber <= 166) {
      wallFile = '../data/AFM-Wall-E.json';
      pinIndex = panelNumber - 151; // Panel 151 = index 0
    } else if (panelNumber >= 167 && panelNumber <= 182) {
      wallFile = '../data/AFM-Wall-F.json';
      pinIndex = panelNumber - 167; // Panel 167 = index 0
    } else if (panelNumber >= 183 && panelNumber <= 205) {
      wallFile = '../data/AFM-Wall-G.json';
      pinIndex = panelNumber - 183; // Panel 183 = index 0
    } else if (panelNumber >= 207 && panelNumber <= 223) {
      wallFile = '../data/AFM-Wall-H.json';
      pinIndex = panelNumber - 207; // Panel 207 = index 0
    } else if (panelNumber >= 224 && panelNumber <= 230) {
      wallFile = '../data/AFM-Wall-I.json';
      pinIndex = panelNumber - 224; // Panel 224 = index 0
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

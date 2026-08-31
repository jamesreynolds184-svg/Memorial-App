(function() {
  // Get plaque ID from URL if present
  const params = new URLSearchParams(location.search);
  const plaqueId = params.get('plaque');

  // Data path
  const dataPath = '../data/allied-special-forces.json';

  // Initialize map centered on NMA Allied Special Forces area
  const map = L.map('asf-map', {
    center: [52.7318, -1.7215],
    zoom: 17,
    zoomControl: true,
  });

  // Add tile layer
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);

  // Use standard blue pin markers (no custom icon needed)
  let markers = [];
  let selectedMarker = null;

  // Load plaque data
  fetch(dataPath)
    .then(r => {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(plaques => {
      // Filter plaques that have location data
      const plaquesWithLocation = plaques.filter(p => 
        p.location && 
        p.location.lat && 
        p.location.lng &&
        Number.isFinite(p.location.lat) && 
        Number.isFinite(p.location.lng)
      );

      console.log(`Loaded ${plaquesWithLocation.length} plaques with locations`);

      if (plaquesWithLocation.length === 0) {
        alert('No plaque locations available yet.');
        return;
      }

      // Add markers for each plaque
      plaquesWithLocation.forEach(plaque => {
        const marker = L.marker([plaque.location.lat, plaque.location.lng], {
          title: plaque.plaque
        }).addTo(map);

        // Create popup content
        const popupContent = `
          <div style="min-width: 200px;">
            <strong style="font-size: 14px;">${escapeHtml(plaque.plaque)}</strong><br>
            <span style="font-size: 12px; color: #666;">${escapeHtml(plaque.garden || '')}</span><br>
            <a href="asf-plaque.html?id=${encodeURIComponent(plaque.id)}&from=asf-map" 
               style="display: inline-block; margin-top: 8px; padding: 6px 12px; background: #007AFF; color: white; text-decoration: none; border-radius: 6px; font-size: 13px;">
              View Details
            </a>
          </div>
        `;

        marker.bindPopup(popupContent);

        // Store reference
        marker.plaqueId = plaque.id;
        markers.push(marker);

        // If this is the selected plaque, open its popup
        if (plaqueId && plaque.id === plaqueId) {
          marker.openPopup();
          map.setView([plaque.location.lat, plaque.location.lng], 18);
          selectedMarker = marker;
        }
      });

      // Show All button - fit bounds to all markers
      document.getElementById('show-all-btn').addEventListener('click', () => {
        if (markers.length > 0) {
          const group = L.featureGroup(markers);
          map.fitBounds(group.getBounds().pad(0.1));
          
          // Reset selected marker
          selectedMarker = null;
        }
      });
    })
    .catch(err => {
      console.error('Failed to load Allied Special Forces data:', err);
      alert('Failed to load plaque locations.');
    });

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
})();

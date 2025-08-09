(function () {
  const params = new URLSearchParams(location.search);
  const name = params.get('name');
  const root = document.getElementById('memorial-detail');

  if (!name) {
    root.innerHTML = '<p>Missing memorial name.</p>';
    return;
  }

  const dataPath = (function() {
    // If current page is in /pages/ go up one level
    return location.pathname.includes('/pages/') ? '../data/memorials.json' : 'data/memorials.json';
  })();
  fetch(dataPath)
    .then(r => {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(all => {
      const item = (Array.isArray(all) ? all : []).find(m => m && m.name === name);
      if (!item) {
        root.innerHTML = '<p>Memorial not found.</p>';
        return;
      }

      window.currentMemorial = item;

      document.getElementById('mem-name').textContent = item.name;
      document.getElementById('mem-zone').textContent = item.zone ? `Zone ${item.zone}` : '';
      document.getElementById('mem-desc').textContent = item.description || '';

      // Removed tags + static map image handling

      // Background image attempt
      if (item.zone && item.name) {
        const bgPath = `/img/zone${item.zone}/${item.name}.JPEG`;
        const testImg = new Image();
        testImg.onload = () => {
          document.body.style.backgroundImage = `url('${bgPath}')`;
          document.body.style.backgroundSize = 'cover';
          document.body.style.backgroundPosition = 'center center';
          document.body.style.backgroundRepeat = 'no-repeat';
        };
        testImg.src = bgPath;
      }

      // Leaflet map if location present
      if (item.location && typeof item.location === 'object') {
        const { lat, lng } = item.location;
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          initLeafletMemorialMap({ lat, lng });
        }
      }
    })
    .catch(err => {
      console.error('Failed to load data', err);
      root.innerHTML = '<p>Failed to load data.</p>';
    });
})();

// Remove / ignore previous loadGoogleMapForMemorial + augmentMemorialWithMap if not needed.

// Simple parser still OK for legacy strings:
function parseMemorialLocation(raw) {
  if (!raw) return null;
  if (typeof raw === 'object' && Number.isFinite(raw.lat) && Number.isFinite(raw.lng)) {
    return { lat: raw.lat, lng: raw.lng };
  }
  if (typeof raw !== 'string') return null;
  const latHem = raw.match(/1:\s*'([NS])'/);
  const latDms = raw.match(/2:\s*\(([\d.]+),\s*([\d.]+),\s*([\d.]+)\)/);
  const lonHem = raw.match(/3:\s*'([EW])'/);
  const lonDms = raw.match(/4:\s*\(([\d.]+),\s*([\d.]+),\s*([\d.]+)\)/);
  if (!latHem || !latDms || !lonHem || !lonDms) return null;
  const dmsToDec = (d, m, s, hem) => {
    let v = +d + +m / 60 + +s / 3600;
    if (hem === 'S' || hem === 'W') v = -v;
    return v;
  };
  const lat = dmsToDec(latDms[1], latDms[2], latDms[3], latHem[1]);
  const lng = dmsToDec(lonDms[1], lonDms[2], lonDms[3], lonHem[1]);
  return (Number.isFinite(lat) && Number.isFinite(lng)) ? { lat, lng } : null;
}

// New: Leaflet map init (no API key)
function initLeafletMemorialMap(coords) {
  const mapEl = document.getElementById('mem-gmap');
  if (!mapEl) return;
  mapEl.style.display = 'block';

  // Wait until Leaflet script loaded
  function start() {
    if (!window.L) { setTimeout(start, 50); return; }

    const map = L.map(mapEl, { center: [coords.lat, coords.lng], zoom: 17 });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);
    L.marker([coords.lat, coords.lng]).addTo(map);
  }
  start();
}
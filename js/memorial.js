(function () {
  const params = new URLSearchParams(location.search);
  const name = params.get('name');
  const root = document.getElementById('memorial-detail');

  if (!root) {
    console.error('#memorial-detail not found');
    return;
  }
  if (!name) {
    root.innerHTML = '<p>Missing memorial name.</p>';
    return;
  }

  // JSON path (works from root or /pages/)
  const dataPath = location.pathname.includes('/pages/')
    ? '../data/memorials.json'
    : 'data/memorials.json';

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

      const nameEl = document.getElementById('mem-name');
      const zoneEl = document.getElementById('mem-zone');
      const descEl = document.getElementById('mem-desc');

      if (nameEl) nameEl.textContent = item.name || '';
      if (zoneEl) zoneEl.textContent = item.zone ? `Zone ${item.zone}` : '';
      if (descEl) descEl.textContent = item.description || '';

      // Background image (robust variants)
      if (item.zone && item.name) {
        const zone = String(item.zone).replace(/[^0-9]/g, '');
        const rawName = item.name.trim();

        const punctRemoved = rawName.replace(/[:;,'"]/g, '');
        const singleSpaced = punctRemoved.replace(/\s+/g, ' ');
        const underscore = singleSpaced.replace(/\s+/g, '_');
        const dash = singleSpaced.replace(/\s+/g, '-');
        const encoded = encodeURIComponent(rawName);

        const stems = Array.from(new Set([
          underscore,
          rawName,
          singleSpaced,
            punctRemoved,
          dash,
          encoded
        ])).filter(Boolean);

        const baseDir = location.pathname.toLowerCase().includes('/pages/')
          ? '../img'
          : 'img';

        const exts = ['jpg','jpeg','png','webp','JPG','JPEG','PNG','WEBP'];
        const candidates = [];
        for (const s of stems) for (const e of exts)
          candidates.push(`${baseDir}/zone${zone}/${s}.${e}`);

        let applied = false;
        function tryNext(i = 0) {
          if (i >= candidates.length) {
            console.warn('No background image found for', item.name, candidates);
            return;
          }
          const url = candidates[i];
          const img = new Image();
          img.onload = () => {
            applied = true;
            document.body.style.backgroundImage = `url("${url}")`;
            document.body.style.backgroundSize = 'cover';
            document.body.style.backgroundPosition = 'center center';
            document.body.style.backgroundRepeat = 'no-repeat';
            console.log('Background image loaded:', url);
          };
          img.onerror = () => tryNext(i + 1);
          img.src = url;
        }
        console.log('Trying background candidates:', candidates);
        tryNext();
      }

      // Leaflet map
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

// Leaflet map init
function initLeafletMemorialMap(coords) {
  const mapEl = document.getElementById('mem-gmap');
  if (!mapEl) return;
  mapEl.style.display = 'block';

  function start() {
    if (!window.L) { setTimeout(start, 60); return; }
    const map = L.map(mapEl, { center: [coords.lat, coords.lng], zoom: 17 });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);
    L.marker([coords.lat, coords.lng]).addTo(map);
  }
  start();
}
(function () {
  const params = new URLSearchParams(location.search);
  const id = params.get('id');
  const from = params.get('from');
  const root = document.getElementById('plaque-detail');

  // Set up back button navigation
  const backBtn = document.getElementById('back-btn');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      if (from === 'asf-plaques') {
        location.href = 'asf-plaques.html';
      } else if (from === 'asf-map') {
        location.href = 'asf-map.html';
      } else {
        history.back();
      }
    });
  }

  if (!root) {
    console.error('#plaque-detail not found');
    return;
  }
  if (!id) {
    root.innerHTML = '<p>No plaque ID provided.</p>';
    return;
  }

  // JSON path (works from root or /pages/)
  const dataPath = location.pathname.includes('/pages/')
    ? '../data/allied-special-forces.json'
    : 'data/allied-special-forces.json';

  fetch(dataPath)
    .then(r => {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(all => {
      const plaque = all.find(p => p.id === id);
      if (!plaque) {
        root.innerHTML = '<p>Plaque not found.</p>';
        return;
      }

      // Store for map reference
      window.currentPlaque = plaque;

      // Set title and description
      document.getElementById('plaque-name').textContent = plaque.plaque || 'Unknown Plaque';
      document.getElementById('plaque-desc').textContent = plaque.description || 'No description available.';
      document.getElementById('plaque-garden').textContent = plaque.garden || '';

      // Handle photo
      const photoWrapper = document.getElementById('plaque-photo-wrapper');
      const photoEl = document.getElementById('plaque-photo');
      if (plaque.plaque && photoWrapper && photoEl) {
        // Determine correct path based on current location
        const isInPages = location.pathname.includes('/pages/');
        const imgPath = isInPages 
          ? `../img/ASF/${plaque.plaque}.jpg`
          : `img/ASF/${plaque.plaque}.jpg`;
        
        console.log('Attempting to load image:', imgPath);
        console.log('Plaque name:', plaque.plaque);
        console.log('Current path:', location.pathname);
        console.log('Is in pages dir:', isInPages);
        
        photoEl.src = imgPath;
        photoEl.alt = plaque.plaque;
        
        // Show photo on successful load
        photoEl.onload = () => {
          console.log('✓ Image loaded successfully:', imgPath);
          photoWrapper.style.display = 'block';
          
          // Add click to fullscreen
          photoEl.style.cursor = 'pointer';
          photoEl.addEventListener('click', () => {
            createFullscreenOverlay(imgPath, plaque.plaque);
          });
        };
        
        // Hide on error
        photoEl.onerror = () => {
          console.error('✗ Image failed to load:', imgPath);
          console.error('  Please check if file exists in img/ASF/ directory');
          console.error('  Expected filename:', plaque.plaque + '.jpg');
          photoWrapper.style.display = 'none';
        };
      } else {
        // No plaque name or elements not found, hide wrapper
        if (photoWrapper) photoWrapper.style.display = 'none';
      }

      // Handle map if location exists
      if (plaque.location && plaque.location.lat && plaque.location.lng) {
        const mapBtn = document.getElementById('see-on-map-btn');
        if (mapBtn) {
          mapBtn.style.display = 'inline-block';
          mapBtn.addEventListener('click', () => {
            location.href = `asf-map.html?plaque=${encodeURIComponent(plaque.id)}`;
          });
        }

        // Initialize Leaflet map
        if (typeof L !== 'undefined') {
          initLeafletPlaqueMap(plaque.location);
        } else {
          // Wait for Leaflet to load
          const checkLeaflet = setInterval(() => {
            if (typeof L !== 'undefined') {
              clearInterval(checkLeaflet);
              initLeafletPlaqueMap(plaque.location);
            }
          }, 100);
        }
      }

      // Update page title
      document.title = plaque.plaque || 'Plaque Detail';
    })
    .catch(err => {
      console.error('Error loading plaque:', err);
      root.innerHTML = '<p>Failed to load plaque data.</p>';
    });
})();

// Leaflet map initialization
function initLeafletPlaqueMap(coords) {
  if (!coords || !Number.isFinite(coords.lat) || !Number.isFinite(coords.lng)) return;
  const el = document.getElementById('plaque-gmap');
  if (!el) return;
  el.style.display = 'block';

  const map = L.map(el, {
    center: [coords.lat, coords.lng],
    zoom: 18,
    attributionControl: false,
    scrollWheelZoom: false,
    dragging: false,
    touchZoom: false,
    doubleClickZoom: false,
    boxZoom: false,
    keyboard: false
  });

  L.tileLayer(
    'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }
  ).addTo(map);

  L.control.attribution({ position: 'bottomright' })
    .addTo(map)
    .addAttribution('&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors');

  // Add marker
  const plaque = window.currentPlaque;
  const marker = L.marker([coords.lat, coords.lng]).addTo(map);
  
  if (plaque && plaque.plaque) {
    marker.bindPopup(`<strong>${escapeHtml(plaque.plaque)}</strong>`);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]);
  }
}

// Read aloud functionality
(function setupReadAloud() {
  const btn = document.getElementById('read-aloud-btn');
  const nameEl = document.getElementById('plaque-name');
  const descEl = document.getElementById('plaque-desc');
  
  if (!btn || !nameEl || !descEl) return;
  if (!('speechSynthesis' in window)) {
    btn.style.display = 'none';
    return;
  }

  let speaking = false;
  let currentUtterance = null;

  function stopSpeech() {
    if (speaking) {
      window.speechSynthesis.cancel();
      speaking = false;
      btn.textContent = 'Read aloud';
      btn.setAttribute('aria-pressed', 'false');
    }
  }

  function startSpeech() {
    if (speaking) {
      stopSpeech();
      return;
    }

    const text = `${nameEl.textContent}. ${descEl.textContent}`;
    const utterance = new SpeechSynthesisUtterance(text);
    
    utterance.onend = () => {
      speaking = false;
      btn.textContent = 'Read aloud';
      btn.setAttribute('aria-pressed', 'false');
    };

    utterance.onerror = () => {
      speaking = false;
      btn.textContent = 'Read aloud';
      btn.setAttribute('aria-pressed', 'false');
    };

    window.speechSynthesis.speak(utterance);
    speaking = true;
    currentUtterance = utterance;
    btn.textContent = 'Stop reading';
    btn.setAttribute('aria-pressed', 'true');
  }

  btn.addEventListener('click', () => {
    if (speaking) {
      stopSpeech();
    } else {
      startSpeech();
    }
  });

  // Stop when navigating away
  window.addEventListener('pagehide', stopSpeech);
  window.addEventListener('beforeunload', stopSpeech);
})();

// Fullscreen overlay for images
function createFullscreenOverlay(imgSrc, altText) {
  const absoluteImgSrc = resolveImagePath(imgSrc);
  
  const overlay = document.createElement('div');
  overlay.className = 'fullscreen-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100vw;
    height: 100vh;
    background-color: rgba(0, 0, 0, 0.95);
    z-index: 10000;
    display: flex;
    justify-content: center;
    align-items: center;
    touch-action: none;
  `;

  const imgContainer = document.createElement('div');
  imgContainer.style.cssText = `
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    overflow: hidden;
  `;

  const img = document.createElement('img');
  img.src = absoluteImgSrc;
  img.alt = altText + ' (fullscreen)';
  img.style.cssText = `
    max-width: 92%;
    max-height: 92%;
    width: auto;
    height: auto;
    object-fit: contain;
    user-select: none;
  `;

  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = '✕';
  closeBtn.setAttribute('aria-label', 'Close fullscreen image');
  closeBtn.style.cssText = `
    position: absolute;
    top: max(20px, env(safe-area-inset-top, 20px));
    right: 20px;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.9);
    color: #000;
    font-size: 24px;
    font-weight: bold;
    border: none;
    cursor: pointer;
    z-index: 10002;
  `;

  imgContainer.appendChild(img);
  overlay.appendChild(imgContainer);
  overlay.appendChild(closeBtn);
  document.body.appendChild(overlay);

  const originalOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';

  function removeOverlay() {
    document.body.style.overflow = originalOverflow;
    overlay.remove();
  }

  closeBtn.addEventListener('click', removeOverlay);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) removeOverlay();
  });
}

function resolveImagePath(relativePath) {
  if (!relativePath) return '';
  if (relativePath.startsWith('http://') || relativePath.startsWith('https://') || relativePath.startsWith('/')) {
    return relativePath;
  }
  const base = window.location.href.substring(0, window.location.href.lastIndexOf('/') + 1);
  return new URL(relativePath, base).href;
}

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
      if (nameEl) nameEl.textContent = item.name || 'Memorial';
      if (zoneEl) zoneEl.textContent = item.zone ? `Zone: ${item.zone}` : '';
      if (descEl) descEl.textContent = (item.description || '').trim();

      // Coordinates (object or legacy string) -> map
      const coords = extractCoords(item.location);
      if (coords) {
        initLeafletMemorialMap(coords);
      }

      // See on map button
      const seeBtn = document.getElementById('see-on-map-btn');
      if (seeBtn) {
        if (coords) {
          seeBtn.style.display = '';
          seeBtn.addEventListener('click', () => {
            location.href = `map.html?focus=${encodeURIComponent(item.name)}`;
          }, { once:true });
        } else {
          seeBtn.style.display = 'none';
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
  if (!coords || !Number.isFinite(coords.lat) || !Number.isFinite(coords.lng)) return;
  const el = document.getElementById('mem-gmap');
  if (!el) return;
  el.style.display = 'block';

  const map = L.map(el, {
    center: [coords.lat, coords.lng],
    zoom: 17,
    attributionControl: false
  });

  L.tileLayer(
    'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png',
    {
      maxZoom: 20,
      attribution: '© OpenStreetMap contributors | Tiles © CARTO'
    }
  ).addTo(map);

  L.control.attribution({ position: 'bottomright' })
    .addTo(map)
    .addAttribution('© OpenStreetMap contributors | Tiles © CARTO');

  const marker = L.marker([coords.lat, coords.lng]).addTo(map);

  const title = (window.currentMemorial && window.currentMemorial.name) ? window.currentMemorial.name : 'Memorial';
  marker.bindPopup(escapeHtml(title)).openPopup();

  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g,c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;" }[c]));
  }
}

// After memorial data (name/desc) is set:
(function setupReadAloud() {
  const btn = document.getElementById('read-aloud-btn');
  const nameEl = document.getElementById('mem-name');
  const descEl = document.getElementById('mem-desc');
  if (!btn || !nameEl || !descEl) return;
  if (!('speechSynthesis' in window)) { btn.style.display = 'none'; return; }

  let speaking = false;
  let currentUtterance = null;
  let voicesCache = [];
  let currentVoiceIndex = 0;
  const isiOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

  function loadVoicesAsync() {
    return new Promise(resolve => {
      const voices = speechSynthesis.getVoices();
      if (voices.length) return resolve(voices);
      speechSynthesis.onvoiceschanged = () => resolve(speechSynthesis.getVoices());
      // Force a (no-op) utterance to trigger voice load in some browsers
      speechSynthesis.speak(new SpeechSynthesisUtterance(' '));
      speechSynthesis.cancel();
      setTimeout(()=>resolve(speechSynthesis.getVoices()), 1200);
    });
  }

  function rankVoices(list) {
    const iosPref = [
      /Siri Voice 3.*en/i,
      /Siri Voice 2.*en/i,
      /Siri Voice 1.*en/i,
      /Daniel/i,
      /Serena/i,
      /Martha/i,
      /Kate/i,
      /Ellis/i
    ];
    const genericPref = [
      /en-GB.*(Natural|Neural)/i,
      /en-GB/i,
      /en-US.*(Natural|Neural)/i,
      /en-US/i,
      /en-/i
    ];
    const prefs = isiOS ? iosPref.concat(genericPref) : genericPref;
    return list
      .filter(v => /en/i.test(v.lang))
      .sort((a,b) => score(b)-score(a));

    function score(v){
      const nameLang = (v.name + ' ' + v.lang);
      for (let i=0;i<prefs.length;i++){
        if (prefs[i].test(nameLang)) return 100 - i*5;
      }
      // Slight bonus to non-localService (often network / higher quality off iOS)
      return v.localService ? 10 : 15;
    }
  }

  async function initVoices() {
    const raw = await loadVoicesAsync();
    voicesCache = rankVoices(raw);
    if (!voicesCache.length) return;
    currentVoiceIndex = 0;
    const v = currentVoice();
    if (v) flash(`Voice: ${v.name}`);
  }

  function currentVoice() {
    return voicesCache[currentVoiceIndex] || null;
  }

  function cycleVoice() {
    if (!voicesCache.length) return;
    currentVoiceIndex = (currentVoiceIndex + 1) % voicesCache.length;
    const v = currentVoice();
    btn.dataset.voice = v ? v.name : '';
    if (speaking) {
      stopSpeech();
      startSpeech(); // restart with new voice
    } else {
      flash(`Voice: ${v.name.replace(/English/i,'').trim()}`);
    }
  }

  function flash(msg) {
    let n = document.getElementById('tts-flash');
    if (!n) {
      n = document.createElement('div');
      n.id = 'tts-flash';
      n.style.cssText = 'position:fixed;bottom:14px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,.65);color:#fff;padding:6px 14px;border-radius:20px;font:12px system-ui;z-index:4000;pointer-events:none;opacity:0;transition:opacity .25s';
      document.body.appendChild(n);
    }
    n.textContent = msg;
    requestAnimationFrame(()=>{ n.style.opacity = '1'; });
    clearTimeout(n._t);
    n._t = setTimeout(()=> n.style.opacity='0', 1800);
  }

  function stopSpeech() {
    speechSynthesis.cancel();
    speaking = false;
    btn.classList.remove('playing');
    btn.setAttribute('aria-pressed','false');
    btn.textContent = '🔈 Read Aloud';
  }

  function buildText() {
    const title = (nameEl.textContent || '').trim();
    const desc = (descEl.textContent || '').trim();
    return title + (desc ? '. ' + desc : '');
  }

  function startSpeech() {
    const text = buildText();
    if (!text) return;
    if (!voicesCache.length) {
      // Defer until voices ready
      initVoices().then(() => startSpeech());
      return;
    }
    currentUtterance = new SpeechSynthesisUtterance(text);
    const v = currentVoice();
    if (v) currentUtterance.voice = v;
    currentUtterance.rate = isiOS ? 1.02 : 1;   // slight lift
    currentUtterance.pitch = isiOS ? 1.05 : 1;  // brighten deep voices
    currentUtterance.onend = stopSpeech;
    currentUtterance.onerror = stopSpeech;
    speechSynthesis.cancel();
    speechSynthesis.speak(currentUtterance);
    speaking = true;
    btn.classList.add('playing');
    btn.setAttribute('aria-pressed','true');
    btn.textContent = '⏹ Stop';
  }

  function autoStop() { if (speaking) stopSpeech(); }

  // Stop when navigating away / hiding
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) autoStop();
  });
  window.addEventListener('pagehide', autoStop);
  window.addEventListener('beforeunload', autoStop);

  btn.addEventListener('click', () => {
    if (speaking) stopSpeech(); else startSpeech();
  });

  // Long press (hold >500ms) cycles voice
  let pressTimer;
  btn.addEventListener('mousedown', startPress);
  btn.addEventListener('touchstart', startPress, { passive:true });
  btn.addEventListener('mouseup', cancelPress);
  btn.addEventListener('mouseleave', cancelPress);
  btn.addEventListener('touchend', cancelPress);
  btn.addEventListener('touchcancel', cancelPress);

  function startPress(e) {
    if (e.type === 'mousedown' && e.button !== 0) return;
    pressTimer = setTimeout(() => {
      cycleVoice();
    }, 600);
  }
  function cancelPress() {
    clearTimeout(pressTimer);
  }

  initVoices().then(() => {
    if (voicesCache.length) {
      const v = currentVoice();
      if (v) btn.title = 'Tap: play / stop. Hold: cycle voice';
    }
  });
})();

// Add near bottom (before file end) helper:
function extractCoords(raw) {
  if (!raw) return null;
  // Already an object with numbers
  if (typeof raw === 'object') {
    const lat = Number(raw.lat);
    const lng = Number(raw.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    return null;
  }
  // Try to parse legacy string "{ 'lat': 52.x, 'lng': -1.x }"
  if (typeof raw === 'string') {
    // Quick JSON attempt
    try {
      const maybe = JSON.parse(raw);
      return extractCoords(maybe);
    } catch {}
    // Regex fallback
    const m = raw.match(/lat[^0-9-]*([-+]?\d+(\.\d+)?).+?lng[^0-9-]*([-+]?\d+(\.\d+)?)/i);
    if (m) {
      const lat = Number(m[1]);
      const lng = Number(m[3]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    }
  }
  return null;
}
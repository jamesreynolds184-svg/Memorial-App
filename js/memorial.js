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

      // Background image + foreground photo (no collapse toggle)
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
        for (const s of stems) {
          for (const e of exts) {
            candidates.push(`${baseDir}/zone${zone}/${s}.${e}`);
          }
        }

        const photoEl = document.getElementById('mem-photo');

        function tryNext(i = 0) {
          if (i >= candidates.length) {
            console.warn('No memorial image found for', item.name);
            return;
          }
            const url = candidates[i];
            const img = new Image();
            img.onload = () => {
              // Apply background
              document.body.style.backgroundImage = `url("${url}")`;
              document.body.style.backgroundSize = 'cover';
              document.body.style.backgroundPosition = 'center center';
              document.body.style.backgroundRepeat = 'no-repeat';
              document.body.classList.add('memorial-bg-set');

              // Show foreground image (if element exists)
              if (photoEl) {
                photoEl.src = url;
                photoEl.alt = item.name;
                photoEl.style.display = 'block';
                // Orientation class
                photoEl.onload = () => {
                  const portrait = photoEl.naturalHeight > photoEl.naturalWidth;
                  photoEl.classList.toggle('portrait', portrait);
                  photoEl.classList.toggle('landscape', !portrait);
                };
              }
              console.log('Memorial image loaded:', url);
            };
            img.onerror = () => tryNext(i + 1);
            img.src = url;
        }
        console.log('Trying memorial image candidates:', candidates);
        tryNext();
      }

      // Leaflet map
      if (item.location && typeof item.location === 'object') {
        const { lat, lng } = item.location;
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          initLeafletMemorialMap({ lat, lng });
        }
      }

      // See on map button logic
      const seeBtn = document.getElementById('see-on-map-btn');
      if (seeBtn && item && item.location &&
          Number.isFinite(item.location.lat) && Number.isFinite(item.location.lng)) {
        seeBtn.style.display = 'inline-flex';
        seeBtn.addEventListener('click', () => {
          location.href = 'map.html?focus=' + encodeURIComponent(item.name);
        });
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
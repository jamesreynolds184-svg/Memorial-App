(function () {
  const SAVED_KEY = 'savedMemorials';
  const params = new URLSearchParams(location.search);
  const name = params.get('name');
  const from = params.get('from');
  const root = document.getElementById('memorial-detail');
  // Helper functions for saved memorials
  function loadSaved() {
    try {
      const arr = JSON.parse(localStorage.getItem(SAVED_KEY));
      return Array.isArray(arr) ? arr : [];
    } catch { return []; }
  }
  function saveSaved(savedSet) {
    localStorage.setItem(SAVED_KEY, JSON.stringify([...savedSet]));
  }
  // Set up back button navigation
  const backBtn = document.getElementById('back-btn');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      const backPages = {
        'saved': 'saved.html',
        'memorials': 'memorials.html',
        'search-by-zone': 'search-by-zone.html',
        'nearby': 'nearby-memorials.html',
        'map': 'map.html',
        'identify': 'identify-memorial.html',
        'manage': 'manage-memorials.html',
        'global-search': 'memorials.html' // Default to memorials for global search
      };
      location.href = backPages[from] || 'memorials.html';
    });
  }

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

      // --- New image display block ---
      // Remove any old image if present
      let oldImg = document.getElementById('memorial-photo-img');
      if (oldImg) oldImg.remove();

      // Build image path (prefer item.photo, else fallback)
      let imgPath = item.photo;
      let triedExtensions = [];
      if (!imgPath && item.zone && item.name) {
        // Try .JPEG, .jpeg, .jpg in order
        const basePath = `../img/zone${item.zone}/`;
        const baseName = item.name;
        triedExtensions = [
          basePath + baseName + '.JPEG',
          basePath + baseName + '.jpeg',
          basePath + baseName + '.jpg'
        ];
        imgPath = triedExtensions.shift();
      }

      if (imgPath) {
        const img = document.createElement('img');
        img.id = 'memorial-photo-img';
        // Convert relative path to absolute path for iOS compatibility
        img.src = resolveImagePath(imgPath);
        img.alt = item.name + ' photo';
        img.style.display = 'block';
        img.style.maxWidth = '60%';
        img.style.margin = '18px auto 0 auto';
        img.style.borderRadius = '18px';
        img.style.boxShadow = '0 4px 18px rgba(0,0,0,0.18)';
        img.style.cursor = 'pointer';
        
        // Add fullscreen capability - pass the resolved path
        img.addEventListener('click', () => {
          createFullscreenOverlay(img.src, item.name); // Use img.src which is already resolved
        });
        
        img.onerror = function() {
          if (triedExtensions.length > 0) {
            img.src = resolveImagePath(triedExtensions.shift());
          } else {
            img.style.display = 'none';
          }
        };
        // Insert below description
        if (descEl && descEl.parentNode) {
          descEl.parentNode.insertBefore(img, descEl.nextSibling);
        }
      }
      // --- End new image display block ---

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

      // Save memorial button
      const saveBtn = document.getElementById('save-memorial-btn');
      if (saveBtn && item.name) {
        const saved = new Set(loadSaved());
        const isSaved = saved.has(item.name);
        
        // Set initial state
        saveBtn.textContent = isSaved ? '★ Save' : '☆ Save';
        saveBtn.setAttribute('aria-label', isSaved ? 'Unsave memorial' : 'Save memorial');
        saveBtn.title = isSaved ? 'Remove from saved' : 'Save memorial';
        
        // Toggle save on click
        saveBtn.addEventListener('click', () => {
          const currentSaved = new Set(loadSaved());
          const isCurrentlySaved = currentSaved.has(item.name);
          
          if (isCurrentlySaved) {
            currentSaved.delete(item.name);
          } else {
            currentSaved.add(item.name);
          }
          
          saveSaved(currentSaved);
          
          const nowSaved = currentSaved.has(item.name);
          saveBtn.textContent = nowSaved ? '★ Save' : '☆ Save';
          saveBtn.setAttribute('aria-label', nowSaved ? 'Unsave memorial' : 'Save memorial');
          saveBtn.title = nowSaved ? 'Remove from saved' : 'Save memorial';
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
  if (!coords || !Number.isFinite(coords.lat) || !Number.isFinite(coords.lng)) return;
  const el = document.getElementById('mem-gmap');
  if (!el) return;
  el.style.display = 'block';

  const map = L.map(el, {
    center: [coords.lat, coords.lng],
    zoom: 17,
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

  // --- Custom marker icon logic ---
  const memorial = window.currentMemorial;
  let marker;
  if (memorial && memorial.zone && memorial.name) {
    // Build icon path (relative to map.html or current page)
    const iconPath = `../icons/zone${memorial.zone}/${memorial.name}.png`;

    // Try to load the icon image
    const img = new window.Image();
    img.onload = function() {
      // Use the image's natural size to preserve proportions
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      // Optionally, scale down if too large (e.g., max 48px)
      const maxDim = 60;
      let scale = 1;
      if (w > maxDim || h > maxDim) {
        scale = Math.min(maxDim / w, maxDim / h);
      }
      const iconW = Math.round(w * scale);
      const iconH = Math.round(h * scale);

      const customIcon = L.icon({
        iconUrl: iconPath,
        iconSize: [iconW, iconH],
        iconAnchor: [iconW / 2, iconH], // bottom center
        popupAnchor: [0, -iconH]
      });
      marker = L.marker([coords.lat, coords.lng], { icon: customIcon }).addTo(map);
      const title = memorial.name ? memorial.name : 'Memorial';
      marker.bindPopup(escapeHtml(title)).openPopup();
    };
    img.onerror = function() {
      // Fallback to default marker
      marker = L.marker([coords.lat, coords.lng]).addTo(map);
      const title = memorial.name ? memorial.name : 'Memorial';
      marker.bindPopup(escapeHtml(title)).openPopup();
    };
    img.src = iconPath;
  } else {
    // Fallback to default marker
    marker = L.marker([coords.lat, coords.lng]).addTo(map);
    const title = (memorial && memorial.name) ? memorial.name : 'Memorial';
    marker.bindPopup(escapeHtml(title)).openPopup();
  }

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
  
  // Audio file playback
  let audioElement = null;
  let usingPreRecorded = false;
  
  // Expose for debugging
  window.debugAudioElement = () => audioElement;

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
    // Don't cycle voice if using pre-recorded audio
    if (usingPreRecorded) {
      flash('Using pre-recorded audio');
      return;
    }
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
    // Stop TTS
    speechSynthesis.cancel();
    
    // Stop audio file if playing
    if (audioElement) {
      audioElement.pause();
      audioElement.currentTime = 0;
      
      // Clean up blob URL if it was created
      if (audioElement.src && audioElement.src.startsWith('blob:')) {
        URL.revokeObjectURL(audioElement.src);
      }
      
      audioElement = null;
    }
    
    speaking = false;
    usingPreRecorded = false;
    btn.classList.remove('playing');
    btn.setAttribute('aria-pressed','false');
    btn.textContent = '🔈 Read Aloud';
  }

  function buildText() {
    const title = (nameEl.textContent || '').trim();
    const desc = (descEl.textContent || '').trim();
    return title + (desc ? '. ' + desc : '');
  }

  async function startSpeech() {
    const text = buildText();
    if (!text) return;
    
    // Check if audio files are available
    const memorial = window.currentMemorial;
    console.log('Starting speech for memorial:', memorial ? memorial.name : 'unknown');
    console.log('Memorial ID:', memorial ? memorial.id : 'missing');
    
    if (memorial && memorial.id) {
      // Check if audio files have been downloaded
      const audioAvailable = await checkAudioAvailable();
      console.log('Audio available:', audioAvailable);
      
      if (!audioAvailable) {
        // Show download prompt
        const shouldDownload = await showAudioDownloadPrompt();
        if (shouldDownload) {
          const success = await downloadAndExtractAudio();
          if (!success) {
            // Download failed, fall back to TTS
            console.log('Download failed, using TTS');
            startTTS();
            return;
          }
        } else {
          // User declined, use TTS
          console.log('User declined download, using TTS');
          startTTS();
          return;
        }
      }
      
      // Build audio path (relative to current page)
      let audioPath;
      if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem) {
        // For Capacitor apps, load from data directory
        const { Filesystem } = window.Capacitor.Plugins;
        try {
          const fileUri = await Filesystem.getUri({
            path: `memorial_audio/${memorial.id}.mp3`,
            directory: Filesystem.Directory.Data
          });
          audioPath = window.Capacitor.convertFileSrc(fileUri.uri);
          console.log('Capacitor audio path:', audioPath);
        } catch (err) {
          console.log('Could not get file URI, falling back to web path');
          audioPath = location.pathname.includes('/pages/')
            ? `../memorial_audio/${memorial.id}.mp3`
            : `memorial_audio/${memorial.id}.mp3`;
        }
      } else {
        // For web browsers, try to load from IndexedDB first
        console.log('Web browser detected, trying IndexedDB for memorial ID:', memorial.id);
        try {
          const audioBlob = await getAudioFromIndexedDB(memorial.id);
          if (audioBlob) {
            console.log('✅ Found audio in IndexedDB, size:', audioBlob.size, 'bytes', 'type:', audioBlob.type);
            // Ensure blob has correct MIME type
            const mp3Blob = new Blob([audioBlob], { type: 'audio/mpeg' });
            audioPath = URL.createObjectURL(mp3Blob);
            console.log('Created blob URL:', audioPath);
          } else {
            console.log('❌ Audio not found in IndexedDB for ID:', memorial.id);
            // Fallback to file system path (if files were manually placed)
            audioPath = location.pathname.includes('/pages/')
              ? `../memorial_audio/${memorial.id}.mp3`
              : `memorial_audio/${memorial.id}.mp3`;
            console.log('Falling back to file path:', audioPath);
          }
        } catch (err) {
          console.error('IndexedDB error:', err);
          audioPath = location.pathname.includes('/pages/')
            ? `../memorial_audio/${memorial.id}.mp3`
            : `memorial_audio/${memorial.id}.mp3`;
          console.log('Falling back to file path:', audioPath);
        }
      }
      
      console.log('Attempting to load audio from:', audioPath);
      
      // Try to load and play the audio file
      audioElement = new Audio(audioPath);
      
      audioElement.addEventListener('canplaythrough', function() {
        // Audio file exists and is ready to play
        console.log('✅ Audio canplaythrough event - ready to play');
        usingPreRecorded = true;
        speaking = true;
        btn.classList.add('playing');
        btn.setAttribute('aria-pressed','true');
        btn.textContent = '⏹ Stop';
        audioElement.play().then(() => {
          console.log('✅ Audio playing');
        }).catch(err => {
          console.error('❌ Audio playback failed:', err);
          // Clean up blob URL if it was created
          if (audioPath && audioPath.startsWith('blob:')) {
            URL.revokeObjectURL(audioPath);
          }
          audioElement = null;
          usingPreRecorded = false;
          startTTS();
        });
      }, { once: true });
      
      audioElement.addEventListener('loadstart', function() {
        console.log('Audio loadstart - beginning to load');
      });
      
      audioElement.addEventListener('loadedmetadata', function() {
        console.log('Audio metadata loaded, duration:', audioElement.duration, 'seconds');
      });
      
      audioElement.addEventListener('ended', () => {
        console.log('Audio ended');
        // Clean up blob URL if it was created
        if (audioPath && audioPath.startsWith('blob:')) {
          URL.revokeObjectURL(audioPath);
        }
        stopSpeech();
      }, { once: true });
      
      audioElement.addEventListener('error', function(e) {
        // Audio file doesn't exist, fall back to TTS
        console.error('❌ Audio error event:', e);
        console.error('Audio error code:', audioElement.error ? audioElement.error.code : 'unknown');
        console.error('Audio error message:', audioElement.error ? audioElement.error.message : 'unknown');
        // Clean up blob URL if it was created
        if (audioPath && audioPath.startsWith('blob:')) {
          URL.revokeObjectURL(audioPath);
        }
        audioElement = null;
        usingPreRecorded = false;
        startTTS();
      }, { once: true });
      
      // Load the audio (triggers either 'canplaythrough' or 'error')
      audioElement.load();
    } else {
      // No memorial ID, use TTS
      startTTS();
    }
  }
  
  function startTTS() {
    const text = buildText();
    if (!text) return;
    if (!voicesCache.length) {
      // Defer until voices ready
      initVoices().then(() => startTTS());
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

// ========== Audio Download System ==========
const AUDIO_DOWNLOAD_KEY = 'audioFilesDownloaded';
const AUDIO_ZIP_URL = 'https://nma-app-dlc.s3.eu-north-1.amazonaws.com/memorial_audio.zip';
const USE_CORS_PROXY = false; // Set to true if S3 CORS is not configured yet
const CORS_PROXY = 'https://corsproxy.io/?';

// Helper function to reset download state (for testing/debugging)
// Call in browser console: window.resetAudioDownload()
window.resetAudioDownload = function() {
  localStorage.removeItem(AUDIO_DOWNLOAD_KEY);
  // Also clear IndexedDB
  const request = indexedDB.deleteDatabase('MemorialAudioDB');
  request.onsuccess = () => console.log('IndexedDB cleared');
  request.onerror = () => console.error('Failed to clear IndexedDB');
  console.log('Audio download state reset. Refresh the page and try Read Aloud again.');
};

// Helper function to check what's in IndexedDB
// Call in browser console: window.checkAudioStorage()
window.checkAudioStorage = async function() {
  try {
    const db = await openAudioDB();
    const transaction = db.transaction(['audioFiles'], 'readonly');
    const store = transaction.objectStore('audioFiles');
    
    // Get count
    const countRequest = store.count();
    const count = await new Promise((resolve, reject) => {
      countRequest.onsuccess = () => resolve(countRequest.result);
      countRequest.onerror = () => reject(countRequest.error);
    });
    
    console.log(`📊 Total audio files in IndexedDB: ${count}`);
    
    // Get all keys
    const keysRequest = store.getAllKeys();
    const keys = await new Promise((resolve, reject) => {
      keysRequest.onsuccess = () => resolve(keysRequest.result);
      keysRequest.onerror = () => reject(keysRequest.error);
    });
    
    console.log('📝 Memorial IDs stored:', keys.slice(0, 20).join(', '), keys.length > 20 ? '...' : '');
    
    // Get total size
    const allRequest = store.getAll();
    const all = await new Promise((resolve, reject) => {
      allRequest.onsuccess = () => resolve(allRequest.result);
      allRequest.onerror = () => reject(allRequest.error);
    });
    
    let totalSize = 0;
    for (const item of all) {
      if (item.audio) {
        totalSize += item.audio.size;
      }
    }
    
    console.log(`💾 Total storage used: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
    
    db.close();
    return { count, keys, totalSizeMB: (totalSize / 1024 / 1024).toFixed(2) };
  } catch (err) {
    console.error('❌ Error checking storage:', err);
    return null;
  }
};

// Helper function to test playing a specific audio by ID
// Call in browser console: window.testAudio('000')
window.testAudio = async function(memorialId) {
  try {
    console.log('🔍 Testing audio for memorial ID:', memorialId);
    const audioBlob = await getAudioFromIndexedDB(memorialId);
    
    if (!audioBlob) {
      console.error('❌ No audio found in IndexedDB for ID:', memorialId);
      return false;
    }
    
    console.log('✅ Found audio - Size:', audioBlob.size, 'Type:', audioBlob.type);
    
    // Create and play audio
    const mp3Blob = new Blob([audioBlob], { type: 'audio/mpeg' });
    const audioURL = URL.createObjectURL(mp3Blob);
    const audio = new Audio(audioURL);
    
    audio.addEventListener('canplaythrough', () => {
      console.log('✅ Audio ready to play, duration:', audio.duration, 'seconds');
      audio.play();
    });
    
    audio.addEventListener('error', (e) => {
      console.error('❌ Audio error:', e, audio.error);
    });
    
    audio.addEventListener('ended', () => {
      console.log('✅ Audio finished playing');
      URL.revokeObjectURL(audioURL);
    });
    
    return true;
  } catch (err) {
    console.error('❌ Error testing audio:', err);
    return false;
  }
};

function getAudioURL() {
  return USE_CORS_PROXY ? CORS_PROXY + encodeURIComponent(AUDIO_ZIP_URL) : AUDIO_ZIP_URL;
}

// IndexedDB functions for web browser storage
function openAudioDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('MemorialAudioDB', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('audioFiles')) {
        db.createObjectStore('audioFiles', { keyPath: 'id' });
      }
    };
  });
}

function saveAudioToIndexedDB(db, memorialId, blob) {
  return new Promise((resolve, reject) => {
    console.log('Saving to IndexedDB - ID:', memorialId, 'Blob size:', blob.size, 'Type:', blob.type);
    const transaction = db.transaction(['audioFiles'], 'readwrite');
    const store = transaction.objectStore('audioFiles');
    const data = { id: memorialId, audio: blob };
    const request = store.put(data);
    
    request.onsuccess = () => {
      console.log('✅ IndexedDB save success for ID:', memorialId);
      resolve();
    };
    request.onerror = () => {
      console.error('❌ IndexedDB save error for ID:', memorialId, request.error);
      reject(request.error);
    };
  });
}

function getAudioFromIndexedDB(memorialId) {
  return new Promise(async (resolve, reject) => {
    try {
      console.log('Opening IndexedDB to retrieve audio for ID:', memorialId);
      const db = await openAudioDB();
      const transaction = db.transaction(['audioFiles'], 'readonly');
      const store = transaction.objectStore('audioFiles');
      const request = store.get(memorialId);
      
      request.onsuccess = () => {
        db.close();
        if (request.result && request.result.audio) {
          console.log('✅ Audio found in IndexedDB for ID:', memorialId, 'Size:', request.result.audio.size);
          resolve(request.result.audio);
        } else {
          console.log('❌ No audio found in IndexedDB for ID:', memorialId);
          resolve(null);
        }
      };
      request.onerror = () => {
        console.error('❌ IndexedDB request error:', request.error);
        db.close();
        reject(request.error);
      };
    } catch (err) {
      console.error('❌ Failed to open IndexedDB:', err);
      reject(err);
    }
  });
}

async function checkAudioAvailable() {
  // Check localStorage flag
  const downloaded = localStorage.getItem(AUDIO_DOWNLOAD_KEY);
  if (downloaded === 'true') {
    return true;
  }
  
  // Check if Capacitor is available (native app)
  if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem) {
    try {
      const { Filesystem } = window.Capacitor.Plugins;
      // Check if memorial_audio directory exists
      const result = await Filesystem.readdir({
        path: 'memorial_audio',
        directory: Filesystem.Directory.Data
      });
      if (result.files && result.files.length > 0) {
        localStorage.setItem(AUDIO_DOWNLOAD_KEY, 'true');
        return true;
      }
    } catch (err) {
      console.log('Audio directory not found in native app');
      return false;
    }
  }
  
  // For web, check IndexedDB
  try {
    const db = await openAudioDB();
    const transaction = db.transaction(['audioFiles'], 'readonly');
    const store = transaction.objectStore('audioFiles');
    const countRequest = store.count();
    
    const count = await new Promise((resolve, reject) => {
      countRequest.onsuccess = () => resolve(countRequest.result);
      countRequest.onerror = () => reject(countRequest.error);
    });
    
    db.close();
    
    if (count > 0) {
      console.log(`Found ${count} audio files in IndexedDB`);
      localStorage.setItem(AUDIO_DOWNLOAD_KEY, 'true');
      return true;
    }
  } catch (err) {
    console.log('IndexedDB check failed:', err);
  }
  
  // Fallback: try to check if a sample audio file exists in file system
  try {
    const testPath = location.pathname.includes('/pages/')
      ? '../memorial_audio/1.mp3'
      : 'memorial_audio/1.mp3';
    const response = await fetch(testPath, { method: 'HEAD' });
    if (response.ok) {
      localStorage.setItem(AUDIO_DOWNLOAD_KEY, 'true');
      return true;
    }
  } catch (err) {
    console.log('Audio files not found in file system');
  }
  
  return false;
}

function showAudioDownloadPrompt() {
  return new Promise((resolve) => {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'audio-download-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(0, 0, 0, 0.7);
      z-index: 10000;
      display: flex;
      justify-content: center;
      align-items: center;
      touch-action: none;
    `;
    
    // Create dialog
    const dialog = document.createElement('div');
    dialog.className = 'audio-download-dialog';
    dialog.style.cssText = `
      background: white;
      border-radius: 12px;
      padding: 24px;
      max-width: 90%;
      width: 340px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      text-align: center;
    `;
    
    // Title
    const title = document.createElement('h3');
    title.textContent = 'Download Audio Files';
    title.style.cssText = 'margin: 0 0 16px 0; font-size: 20px; color: #333;';
    dialog.appendChild(title);
    
    // Message
    const message = document.createElement('p');
    message.textContent = 'You need to download the audio files (426MB) to use Read Aloud. Continue?';
    message.style.cssText = 'margin: 0 0 24px 0; font-size: 16px; color: #666; line-height: 1.5;';
    dialog.appendChild(message);
    
    // Buttons container
    const buttons = document.createElement('div');
    buttons.style.cssText = 'display: flex; gap: 12px; justify-content: center;';
    
    // Cancel button
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.cssText = `
      padding: 12px 24px;
      border: 1px solid #ccc;
      background: white;
      color: #333;
      border-radius: 8px;
      font-size: 16px;
      cursor: pointer;
      min-width: 100px;
    `;
    cancelBtn.onclick = () => {
      document.body.removeChild(overlay);
      resolve(false);
    };
    
    // Download button
    const downloadBtn = document.createElement('button');
    downloadBtn.textContent = 'Download';
    downloadBtn.style.cssText = `
      padding: 12px 24px;
      border: none;
      background: #007AFF;
      color: white;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      min-width: 100px;
    `;
    downloadBtn.onclick = () => {
      document.body.removeChild(overlay);
      resolve(true);
    };
    
    buttons.appendChild(cancelBtn);
    buttons.appendChild(downloadBtn);
    dialog.appendChild(buttons);
    
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
  });
}

async function downloadAndExtractAudio() {
  // Create progress overlay
  const overlay = document.createElement('div');
  overlay.className = 'audio-progress-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.7);
    z-index: 10000;
    display: flex;
    justify-content: center;
    align-items: center;
    touch-action: none;
  `;
  
  // Create dialog
  const dialog = document.createElement('div');
  dialog.className = 'audio-progress-dialog';
  dialog.style.cssText = `
    background: white;
    border-radius: 12px;
    padding: 24px;
    max-width: 90%;
    width: 340px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    text-align: center;
  `;
  
  // Title
  const title = document.createElement('h3');
  title.textContent = 'Downloading Audio Files';
  title.style.cssText = 'margin: 0 0 16px 0; font-size: 20px; color: #333;';
  dialog.appendChild(title);
  
  // Status text
  const status = document.createElement('p');
  status.textContent = 'Preparing download...';
  status.style.cssText = 'margin: 0 0 16px 0; font-size: 14px; color: #666;';
  dialog.appendChild(status);
  
  // Progress bar container
  const progressContainer = document.createElement('div');
  progressContainer.style.cssText = `
    width: 100%;
    height: 8px;
    background: #e0e0e0;
    border-radius: 4px;
    overflow: hidden;
    margin-bottom: 8px;
  `;
  
  // Progress bar fill
  const progressBar = document.createElement('div');
  progressBar.style.cssText = `
    width: 0%;
    height: 100%;
    background: #007AFF;
    transition: width 0.3s ease;
  `;
  progressContainer.appendChild(progressBar);
  dialog.appendChild(progressContainer);
  
  // Progress percentage
  const percentage = document.createElement('p');
  percentage.textContent = '0%';
  percentage.style.cssText = 'margin: 0 0 16px 0; font-size: 14px; color: #999; font-weight: 600;';
  dialog.appendChild(percentage);
  
  // Close button (initially hidden)
  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'Close';
  closeBtn.style.cssText = `
    padding: 12px 24px;
    border: none;
    background: #007AFF;
    color: white;
    border-radius: 8px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    min-width: 100px;
    display: none;
  `;
  closeBtn.onclick = () => {
    document.body.removeChild(overlay);
  };
  dialog.appendChild(closeBtn);
  
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);
  
  try {
    // Download the ZIP file
    status.textContent = 'Downloading audio files...';
    const audioURL = getAudioURL();
    console.log('Fetching audio ZIP from:', audioURL);
    
    const response = await fetch(audioURL);
    
    if (!response.ok) {
      console.error('Download failed with status:', response.status, response.statusText);
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    console.log('Download started successfully');
    const contentLength = response.headers.get('Content-Length');
    const total = parseInt(contentLength, 10);
    console.log('Total file size:', total, 'bytes (~' + Math.round(total / 1024 / 1024) + 'MB)');
    
    let loaded = 0;
    
    const reader = response.body.getReader();
    const chunks = [];
    
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;
      
      chunks.push(value);
      loaded += value.length;
      
      const progress = Math.round((loaded / total) * 50); // Download is 50% of total progress
      progressBar.style.width = progress + '%';
      percentage.textContent = progress + '%';
    }
    
    console.log('Download complete. Downloaded:', loaded, 'bytes');
    
    // Combine chunks into single Uint8Array
    const zipData = new Uint8Array(loaded);
    let position = 0;
    for (const chunk of chunks) {
      zipData.set(chunk, position);
      position += chunk.length;
    }
    
    // Extract ZIP file
    title.textContent = 'Extracting Audio Files';
    status.textContent = 'Unzipping files...';
    progressBar.style.width = '50%';
    percentage.textContent = '50%';
    
    // Load JSZip library if not already loaded
    if (!window.JSZip) {
      console.log('Loading JSZip library...');
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
      await new Promise((resolve, reject) => {
        script.onload = () => {
          console.log('JSZip loaded successfully');
          resolve();
        };
        script.onerror = (e) => {
          console.error('Failed to load JSZip:', e);
          reject(new Error('Failed to load JSZip library'));
        };
        document.head.appendChild(script);
      });
    } else {
      console.log('JSZip already loaded');
    }
    
    console.log('Starting ZIP extraction...');
    const zip = await JSZip.loadAsync(zipData);
    console.log('ZIP loaded successfully');
    const files = Object.keys(zip.files);
    const totalFiles = files.length;
    let processedFiles = 0;
    
    // Check if Capacitor is available (native app)
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem) {
      const { Filesystem } = window.Capacitor.Plugins;
      
      // Create directory
      try {
        await Filesystem.mkdir({
          path: 'memorial_audio',
          directory: Filesystem.Directory.Data,
          recursive: true
        });
      } catch (err) {
        console.log('Directory might already exist:', err);
      }
      
      // Extract files
      for (const filename of files) {
        const file = zip.files[filename];
        
        if (!file.dir && filename.includes('memorial_audio/') && filename.endsWith('.mp3')) {
          const content = await file.async('base64');
          const justFilename = filename.split('/').pop();
          
          try {
            await Filesystem.writeFile({
              path: `memorial_audio/${justFilename}`,
              data: content,
              directory: Filesystem.Directory.Data
            });
          } catch (writeErr) {
            console.error('Error writing file:', justFilename, writeErr);
          }
        }
        
        processedFiles++;
        const progress = 50 + Math.round((processedFiles / totalFiles) * 50);
        progressBar.style.width = progress + '%';
        percentage.textContent = progress + '%';
      }
    } else {
      // For web browsers: Use IndexedDB to store audio files
      console.log('Web browser detected, using IndexedDB for storage');
      const db = await openAudioDB();
      
      let savedCount = 0;
      // Extract and store files
      for (const filename of files) {
        const file = zip.files[filename];
        
        if (!file.dir && filename.includes('memorial_audio/') && filename.endsWith('.mp3')) {
          const blob = await file.async('blob');
          // Ensure blob has correct MIME type
          const mp3Blob = new Blob([blob], { type: 'audio/mpeg' });
          const justFilename = filename.split('/').pop();
          const memorialId = justFilename.replace('.mp3', '');
          
          console.log('Extracting audio:', filename, '→ ID:', memorialId, 'Size:', mp3Blob.size);
          
          try {
            await saveAudioToIndexedDB(db, memorialId, mp3Blob);
            savedCount++;
            console.log('✅ Saved to IndexedDB:', memorialId);
          } catch (writeErr) {
            console.error('❌ Error storing audio in IndexedDB:', justFilename, writeErr);
          }
        }
        
        processedFiles++;
        const progress = 50 + Math.round((processedFiles / totalFiles) * 50);
        progressBar.style.width = progress + '%';
        percentage.textContent = progress + '%';
      }
      
      db.close();
      console.log(`✅ All audio files stored in IndexedDB. Total saved: ${savedCount}`);
    }
    
    // Success
    title.textContent = 'Success!';
    status.textContent = 'Audio files are ready to use.';
    progressBar.style.width = '100%';
    percentage.textContent = '100%';
    closeBtn.style.display = 'block';
    
    // Mark as downloaded
    localStorage.setItem(AUDIO_DOWNLOAD_KEY, 'true');
    
    return true;
    
  } catch (err) {
    console.error('Download/extract error:', err);
    console.error('Error name:', err.name);
    console.error('Error message:', err.message);
    console.error('Error stack:', err.stack);
    
    // Show error
    title.textContent = 'Failed';
    
    // Provide more specific error message
    let errorMsg = 'Could not download audio files. ';
    if (err.message.includes('Failed to fetch') || err.name === 'TypeError') {
      errorMsg += 'Network error - check your internet connection or CORS settings.';
    } else if (err.message.includes('HTTP')) {
      errorMsg += err.message;
    } else if (err.message.includes('Manual extraction')) {
      errorMsg += 'Web browser detected. Please manually extract the ZIP file to the memorial_audio folder.';
    } else {
      errorMsg += 'Please try again later. Error: ' + err.message;
    }
    
    status.textContent = errorMsg;
    status.style.fontSize = '13px';
    status.style.lineHeight = '1.4';
    progressBar.style.background = '#FF3B30';
    closeBtn.style.display = 'block';
    
    return false;
  }
}

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

// Add fullscreen overlay functionality
function createFullscreenOverlay(imgSrc, altText) {
  // Ensure image path is absolute
  const absoluteImgSrc = resolveImagePath(imgSrc);
  
  // Create overlay
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
    -webkit-tap-highlight-color: transparent;
  `;

  // Create image container for pinch-zoom
  const imgContainer = document.createElement('div');
  imgContainer.className = 'zoom-container';
  imgContainer.style.cssText = `
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    overflow: hidden;
    touch-action: none;
  `;

  // Create image
  const img = document.createElement('img');
  img.src = absoluteImgSrc;
  img.alt = altText + ' (fullscreen)';
  img.style.cssText = `
    max-width: 92%;
    max-height: 92%;
    width: auto;
    height: auto;
    object-fit: contain;
    transform-origin: center center;
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
    touch-action: none;
    pointer-events: auto;
  `;

  // Create close button
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
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10002;
    padding: 0;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
  `;

  // Add elements to the DOM
  imgContainer.appendChild(img);
  overlay.appendChild(imgContainer);
  overlay.appendChild(closeBtn);
  document.body.appendChild(overlay);

  // Prevent body scrolling while overlay is open
  const originalOverflow = document.body.style.overflow;
  const originalPosition = document.body.style.position;
  document.body.style.overflow = 'hidden';
  document.body.style.position = 'fixed';
  document.body.style.width = '100%';

  // Function to safely remove overlay
  function removeOverlay() {
    if (overlay.parentNode) {
      document.body.removeChild(overlay);
    }
    document.body.style.overflow = originalOverflow;
    document.body.style.position = originalPosition;
    document.body.style.width = '';
  }

  // Close button handler - use both click and touchend for reliability
  const closeHandler = (e) => {
    e.preventDefault();
    e.stopPropagation();
    removeOverlay();
  };
  
  closeBtn.addEventListener('click', closeHandler, { passive: false });
  closeBtn.addEventListener('touchend', closeHandler, { passive: false });

  // Close overlay when clicking/tapping background (not the image)
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay || e.target === imgContainer) {
      removeOverlay();
    }
  });

  // Also handle tap on background for mobile
  overlay.addEventListener('touchend', (e) => {
    if (e.target === overlay || e.target === imgContainer) {
      e.preventDefault();
      removeOverlay();
    }
  }, { passive: false });

  // Initialize pinch-zoom functionality
  initPinchZoom(imgContainer, img);

  // Handle image load error
  img.addEventListener('error', () => {
    console.error('Failed to load fullscreen image:', absoluteImgSrc);
    removeOverlay();
    alert('Failed to load image');
  });

  // Prevent context menu on long press (mobile)
  img.addEventListener('contextmenu', (e) => e.preventDefault());
  
  // Prevent default touch behavior on overlay
  overlay.addEventListener('touchmove', (e) => {
    // Allow gestures on the image container
    if (e.target === img || e.target === imgContainer) {
      return;
    }
    e.preventDefault();
  }, { passive: false });
}

// Pinch-zoom and pan functionality
function initPinchZoom(container, img) {
  let currentScale = 1;
  let startScale = 1;
  let startDistance = 0;
  let initialPinchCenter = { x: 0, y: 0 };
  let isPanning = false;
  
  // For single touch panning
  let lastTouchX = 0;
  let lastTouchY = 0;
  
  // Transform values
  let translateX = 0;
  let translateY = 0;
  
  // Minimum and maximum scale
  const MIN_SCALE = 1;
  const MAX_SCALE = 5;

  function getDistance(touches) {
    return Math.hypot(
      touches[0].clientX - touches[1].clientX,
      touches[0].clientY - touches[1].clientY
    );
  }

  function getMidpoint(touches) {
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2
    };
  }

  function updateTransform() {
    img.style.transform = `translate(${translateX}px, ${translateY}px) scale(${currentScale})`;
  }

  function handleTouchStart(e) {
    // Only handle touches on the image
    if (e.target !== img) return;
    
    if (e.touches.length === 2) {
      e.preventDefault();
      // Two finger pinch to zoom
      startDistance = getDistance(e.touches);
      startScale = currentScale;
      initialPinchCenter = getMidpoint(e.touches);
      isPanning = false;
    } else if (e.touches.length === 1) {
      // Single finger pan (only if zoomed)
      if (currentScale > 1) {
        e.preventDefault();
      }
      lastTouchX = e.touches[0].clientX;
      lastTouchY = e.touches[0].clientY;
      isPanning = true;
    }
  }

  function handleTouchMove(e) {
    // Only handle touches on the image
    if (e.target !== img) return;
    
    if (e.touches.length === 2) {
      e.preventDefault();
      // Pinch-zoom
      const currentDistance = getDistance(e.touches);
      const pinchRatio = currentDistance / startDistance;
      currentScale = Math.min(Math.max(startScale * pinchRatio, MIN_SCALE), MAX_SCALE);
      
      // Adjust pan during pinch to keep pinch center stable
      const currentCenter = getMidpoint(e.touches);
      if (currentScale > MIN_SCALE) {
        const dragOffsetX = currentCenter.x - initialPinchCenter.x;
        const dragOffsetY = currentCenter.y - initialPinchCenter.y;
        translateX += dragOffsetX / 5;
        translateY += dragOffsetY / 5;
        initialPinchCenter = currentCenter;
      }
      
      updateTransform();
    } else if (e.touches.length === 1 && isPanning && currentScale > 1) {
      e.preventDefault();
      // Pan (only if zoomed in)
      const touchX = e.touches[0].clientX;
      const touchY = e.touches[0].clientY;
      
      const deltaX = touchX - lastTouchX;
      const deltaY = touchY - lastTouchY;
      
      translateX += deltaX;
      translateY += deltaY;
      
      lastTouchX = touchX;
      lastTouchY = touchY;
      
      updateTransform();
    }
  }

  function handleTouchEnd(e) {
    if (e.touches.length === 0) {
      // Remove the auto-reset that was causing the issue
      // Only do boundary checks now
      
      // Boundary check
      const imgRect = img.getBoundingClientRect();
      const maxTranslateX = (imgRect.width * (currentScale - 1)) / 2;
      const maxTranslateY = (imgRect.height * (currentScale - 1)) / 2;
      
      if (Math.abs(translateX) > maxTranslateX) {
        translateX = translateX > 0 ? maxTranslateX : -maxTranslateX;
      }
      
      if (Math.abs(translateY) > maxTranslateY) {
        translateY = translateY > 0 ? maxTranslateY : -maxTranslateY;
      }
      
      updateTransform();
      isPanning = false;
    }
  }

  // Double tap to zoom
  let lastTapTime = 0;
  function handleDoubleTap(e) {
    if (e.target !== img) return;
    
    const currentTime = new Date().getTime();
    const tapLength = currentTime - lastTapTime;
    
    if (tapLength < 300 && tapLength > 0) {
      e.preventDefault();
      // Double tap detected
      if (currentScale === 1) {
        currentScale = 2.5;
        const rect = container.getBoundingClientRect();
        const touch = e.changedTouches[0];
        translateX = (rect.width / 2 - touch.clientX) * 0.2;
        translateY = (rect.height / 2 - touch.clientY) * 0.2;
      } else {
        currentScale = 1;
        translateX = 0;
        translateY = 0;
      }
      updateTransform();
    }
    lastTapTime = currentTime;
  }

  // Add event listeners
  img.addEventListener('touchstart', handleTouchStart, { passive: false });
  img.addEventListener('touchmove', handleTouchMove, { passive: false });
  img.addEventListener('touchend', handleTouchEnd, { passive: false });
  img.addEventListener('touchcancel', handleTouchEnd);
  img.addEventListener('touchend', handleDoubleTap, { passive: false });

  // Desktop mouse wheel zoom support
  container.addEventListener('wheel', (e) => {
    e.preventDefault();
    const scaleFactor = 1 - e.deltaY * 0.01;
    const newScale = Math.min(Math.max(currentScale * scaleFactor, MIN_SCALE), MAX_SCALE);
    
    if (newScale !== currentScale) {
      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      const dx = mouseX - rect.width / 2;
      const dy = mouseY - rect.height / 2;
      const scaleDelta = newScale - currentScale;
      
      translateX -= dx * (scaleDelta / currentScale) * 0.5;
      translateY -= dy * (scaleDelta / currentScale) * 0.5;
      currentScale = newScale;
      
      updateTransform();
    }
  }, { passive: false });
}

// Add this helper function before extractCoords:
function resolveImagePath(relativePath) {
  if (!relativePath) return '';
  // If already absolute, return as-is
  if (relativePath.startsWith('http://') || relativePath.startsWith('https://') || relativePath.startsWith('/')) {
    return relativePath;
  }
  // Convert relative path to absolute using current page location
  const base = window.location.href.substring(0, window.location.href.lastIndexOf('/') + 1);
  return new URL(relativePath, base).href;
}
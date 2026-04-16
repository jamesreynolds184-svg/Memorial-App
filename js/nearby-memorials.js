(() => {
  const statusEl = document.getElementById('geo-status');
  const listEl = document.getElementById('memorial-list');
  const retryBtn = document.getElementById('retry-geo');
  const refreshBtn = document.getElementById('refresh-geo');
  if (!statusEl || !listEl) return;

  // Zone name mapping
  const ZONE_NAMES = {
    1: 'Special Forces',
    2: 'Poppy Fields',
    3: 'Ash Grove',
    4: 'Merchant Navy',
    5: 'Naval Review',
    6: 'Children\'s Wood',
    7: 'Yeomanry',
    8: 'Far East',
    9: 'Guiford',
    10: 'Rememberance Centre',
    11: 'The Beat',
    12: 'Armed Forces Memorial',
    13: 'RAF Wing',
    14: 'Bastion Memorial',
    15: 'Lichfield Wood',
    16: 'Polish Memorial'
  };

  const SAVED_KEY = 'savedMemorials';
  function loadSaved() {
    try { return JSON.parse(localStorage.getItem(SAVED_KEY) || '[]'); }
    catch { return []; }
  }
  function saveSaved(set) {
    localStorage.setItem(SAVED_KEY, JSON.stringify(Array.from(set)));
  }
  let saved = new Set(loadSaved());

  const dataPath = location.pathname.includes('/pages/')
    ? '../data/memorials.json'
    : 'data/memorials.json';

  let memorials = [];

  function loadData() {
    return fetch(dataPath)
      .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(data => {
        memorials = (Array.isArray(data) ? data : []).filter(m =>
          m && m.name && m.location &&
          Number.isFinite(m.location.lat) && Number.isFinite(m.location.lng)
        );
      });
  }

  function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const toRad = d => d * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat/2)**2 +
              Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  }

  // Always show meters; add 0.1m precision when very close (<20m)
  function fmtDist(m) {
    if (m < 20) return (Math.round(m * 10) / 10).toFixed(1) + ' m';
    return Math.round(m) + ' m';
  }

  function render(userLat, userLng) {
    const withDist = memorials.map(m => ({
      ...m,
      _distance: haversine(userLat, userLng, m.location.lat, m.location.lng)
    })).sort((a,b) => a._distance - b._distance);

    listEl.innerHTML = '';
    if (!withDist.length) {
      listEl.innerHTML = '<li class="empty">No memorials with coordinates.</li>';
      return;
    }

    // Filter to only show memorials within 50 meters
    const nearby = withDist.filter(m => m._distance <= 50);
    if (!nearby.length) {
      listEl.innerHTML = '<li class="empty" style="padding: 40px 20px; text-align: center;"><div style="font-size: 36px; margin-bottom: 10px;">📍</div><strong>No Memorials Within 50 Meters</strong><div style="margin-top: 8px; font-size: 14px; opacity: 0.7;">Visit the memorial site to see nearby memorials.</div></li>';
      return;
    }

    const frag = document.createDocumentFragment();
    for (const m of nearby) {
      const li = document.createElement('li');
      li.className = 'memorial-row';

      const leftCol = document.createElement('div');
      leftCol.className = 'mem-info';

      const a = document.createElement('a');
      a.className = 'mem-link';
      a.href = `memorial.html?name=${encodeURIComponent(m.name)}&from=nearby`;
      a.textContent = m.name;
      leftCol.appendChild(a);

      // Add zone name if available
      if (m.zone && ZONE_NAMES[m.zone]) {
        const zoneName = document.createElement('div');
        zoneName.className = 'memorial-zone-name';
        zoneName.textContent = ZONE_NAMES[m.zone];
        leftCol.appendChild(zoneName);
      }

      li.appendChild(leftCol);

      const dist = document.createElement('span');
      dist.className = 'near-distance';
      dist.textContent = fmtDist(m._distance);
      li.appendChild(dist);

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'save-btn' + (saved.has(m.name) ? ' saved' : '');
      btn.dataset.name = m.name;
      btn.setAttribute('aria-label', saved.has(m.name) ? 'Unsave memorial' : 'Save memorial');
      btn.textContent = saved.has(m.name) ? '★' : '☆';
      li.appendChild(btn);

      frag.appendChild(li);
    }
    listEl.appendChild(frag);
  }

  function onLocSuccess(pos) {
    const { latitude, longitude, accuracy } = pos.coords;
    statusEl.textContent = `Location acquired (±${Math.round(accuracy)} m)`;
    refreshBtn.style.display = 'inline-block';
    render(latitude, longitude);
  }

  function onLocError(err) {
    let msg = 'Location error: ';
    switch(err.code) {
      case err.PERMISSION_DENIED:
        msg += 'Permission denied. Please enable location in your device settings and browser.';
        break;
      case err.POSITION_UNAVAILABLE:
        msg += 'Position unavailable. Please ensure GPS is enabled.';
        break;
      case err.TIMEOUT:
        msg += 'Request timed out. Please try again.';
        break;
      default:
        msg += err.message;
    }
    statusEl.textContent = msg;
    retryBtn.style.display = 'inline-block';
  }

  function requestLocation() {
    retryBtn.style.display = 'none';
    refreshBtn.style.display = 'none';
    statusEl.textContent = 'Requesting location…';
    if (!navigator.geolocation) {
      statusEl.textContent = 'Geolocation not supported.';
      return;
    }
    
    // Check for HTTPS on Android (required for geolocation)
    if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
      const isAndroid = /Android/.test(navigator.userAgent);
      if (isAndroid) {
        console.warn('Geolocation requires HTTPS on Android');
      }
    }
    
    // Android devices often need more time, especially for first permission request
    // and GPS acquisition. iOS is generally faster.
    navigator.geolocation.getCurrentPosition(onLocSuccess, onLocError, {
      enableHighAccuracy: true,
      timeout: 30000,        // Increased to 30 seconds for Android compatibility
      maximumAge: 60000      // Accept cached position up to 60 seconds old
    });
  }

  // Handle save toggles (reuse existing styling)
  listEl.addEventListener('click', e => {
    const btn = e.target.closest('.save-btn');
    if (!btn) return;
    const name = btn.dataset.name;
    if (!name) return;
    if (saved.has(name)) saved.delete(name); else saved.add(name);
    saveSaved(saved);
    btn.classList.toggle('saved');
    btn.textContent = btn.classList.contains('saved') ? '★' : '☆';
    btn.setAttribute('aria-label', btn.classList.contains('saved') ? 'Unsave memorial' : 'Save memorial');
  });

  retryBtn?.addEventListener('click', requestLocation);
  refreshBtn?.addEventListener('click', requestLocation);

  loadData().then(requestLocation).catch(e => {
    statusEl.textContent = 'Failed to load memorial data.';
    console.error(e);
  });
})();
(() => {
  const statusEl = document.getElementById('geo-status');
  const listEl = document.getElementById('memorial-list');
  const retryBtn = document.getElementById('retry-geo');
  const refreshBtn = document.getElementById('refresh-geo');
  if (!statusEl || !listEl) return;

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

    const frag = document.createDocumentFragment();
    for (const m of withDist) {
      const li = document.createElement('li');
      li.className = 'memorial-row';

      const a = document.createElement('a');
      a.className = 'mem-link';
      a.href = `memorial.html?name=${encodeURIComponent(m.name)}`;
      a.textContent = m.name;
      li.appendChild(a);

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
    statusEl.textContent = `Location error: ${err.message}`;
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
    navigator.geolocation.getCurrentPosition(onLocSuccess, onLocError, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 10000
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
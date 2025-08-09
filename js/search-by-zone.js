(() => {
  const SAVED_KEY = 'savedMemorials';
  const ZONES = Array.from({ length: 16 }, (_, i) => i + 1);

  const listEl = document.getElementById('memorial-list');
  const searchEl = document.getElementById('search');
  const pickerEl = document.getElementById('zone-picker');

  let all = [];
  let saved = new Set(loadSaved());
  let currentZone = getInitialZone();

  function loadSaved() {
    try {
      const arr = JSON.parse(localStorage.getItem(SAVED_KEY));
      return Array.isArray(arr) ? arr : [];
    } catch { return []; }
  }
  function saveSaved() {
    localStorage.setItem(SAVED_KEY, JSON.stringify([...saved]));
  }

  function getInitialZone() {
    const p = new URLSearchParams(location.search);
    const z = p.get('zone');
    if (z && ZONES.includes(Number(z))) return String(Number(z));
    try {
      const last = localStorage.getItem('lastZone');
      if (last && ZONES.includes(Number(last))) return String(Number(last));
    } catch {}
    return '1';
  }

  function updateURL() {
    const p = new URLSearchParams(location.search);
    p.set('zone', currentZone);
    history.replaceState(null, '', `${location.pathname}?${p.toString()}`);
    try { localStorage.setItem('lastZone', currentZone); } catch {}
  }

  function buildPicker() {
    pickerEl.innerHTML = '';
    ZONES.forEach(n => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'zone-btn' + (String(n) === currentZone ? ' active' : '');
      btn.textContent = n;
      btn.dataset.zone = String(n);
      btn.setAttribute('aria-pressed', String(n) === currentZone ? 'true' : 'false');
      pickerEl.appendChild(btn);
    });
  }

  function render(filter = '') {
    const q = filter.trim().toLowerCase();
    const items = all
      .filter(m => m && m.name && String(m.zone) === currentZone)
      .filter(m => {
        if (!q) return true;
        const hay = [
          m.name,
          m.zone || '',
          (m.description || ''),
          ...(Array.isArray(m.tags) ? m.tags : [])
        ].join(' ').toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    listEl.innerHTML = '';
    if (!items.length) {
      listEl.innerHTML = '<li class="empty">No memorials in this zone.</li>';
      return;
    }

    for (const m of items) {
      const li = document.createElement('li');
      li.className = 'memorial-row';

      const a = document.createElement('a');
      a.className = 'mem-link';
      a.href = `memorial.html?name=${encodeURIComponent(m.name)}`;
      a.textContent = m.name;

      const btn = document.createElement('button');
      const isSaved = saved.has(m.name);
      btn.className = 'save-btn' + (isSaved ? ' saved' : '');
      btn.type = 'button';
      btn.dataset.name = m.name;
      btn.setAttribute('aria-label', isSaved ? 'Unsave memorial' : 'Save memorial');
      btn.textContent = isSaved ? '★' : '☆';

      li.appendChild(a);
      li.appendChild(btn);
      listEl.appendChild(li);
    }
  }

  // Zone change
  pickerEl.addEventListener('click', (e) => {
    const b = e.target.closest('.zone-btn');
    if (!b) return;
    const z = b.dataset.zone;
    if (!z || z === currentZone) return;

    currentZone = z;
    updateURL();

    // Update active state
    [...pickerEl.querySelectorAll('.zone-btn')].forEach(x => {
      const active = x.dataset.zone === currentZone;
      x.classList.toggle('active', active);
      x.setAttribute('aria-pressed', active ? 'true' : 'false');
    });

    render(searchEl.value);
  });

  // Save/unsave (event delegation)
  listEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.save-btn');
    if (!btn) return;
    const name = btn.dataset.name;
    if (!name) return;

    if (saved.has(name)) saved.delete(name);
    else saved.add(name);

    saveSaved();
    btn.classList.toggle('saved', saved.has(name));
    btn.textContent = saved.has(name) ? '★' : '☆';
    btn.setAttribute('aria-label', saved.has(name) ? 'Unsave memorial' : 'Save memorial');
  });

  // Live search
  let t;
  searchEl.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(() => render(searchEl.value), 120);
  });

  // Load data and init
  fetch('../data/memorials.json')
    .then(r => r.json())
    .then(data => {
      all = (Array.isArray(data) ? data : []).filter(m => m && m.name);
      buildPicker();
      updateURL();
      render('');
    })
    .catch(() => {
      listEl.innerHTML = '<li class="empty">Failed to load memorials.</li>';
      buildPicker();
    });
})();
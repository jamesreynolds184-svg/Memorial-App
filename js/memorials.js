(() => {
  const SAVED_KEY = 'savedMemorials';
  const listEl = document.getElementById('memorial-list');
  const searchEl = document.getElementById('search');

  if (!listEl || !searchEl) {
    console.error('Required elements #memorial-list or #search missing on this page.');
    return;
  }

  // Dynamic data path (works in / and /pages/)
  const dataPath = location.pathname.includes('/pages/')
    ? '../data/memorials.json'
    : 'data/memorials.json';

  let all = [];
  let saved = new Set(loadSaved());

  function loadSaved() {
    try {
      const arr = JSON.parse(localStorage.getItem(SAVED_KEY));
      return Array.isArray(arr) ? arr : [];
    } catch { return []; }
  }
  function saveSaved() {
    localStorage.setItem(SAVED_KEY, JSON.stringify([...saved]));
  }

  function render(filter = '') {
    const q = filter.trim().toLowerCase();
    const items = all.filter(m => {
      if (!m || !m.name) return false;
      if (!q) return true;
      const hay = [
        m.name,
        m.zone || '',
        (m.description || ''),
        ...(Array.isArray(m.tags) ? m.tags : [])
      ].join(' ').toLowerCase();
      return hay.includes(q);
    });

    listEl.innerHTML = '';
    if (!items.length) {
      listEl.innerHTML = '<li class="empty">No memorials match your search.</li>';
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
      btn.className = 'save-btn' + (saved.has(m.name) ? ' saved' : '');
      btn.type = 'button';
      btn.setAttribute('aria-label', saved.has(m.name) ? 'Unsave memorial' : 'Save memorial');
      btn.dataset.name = m.name;
      btn.textContent = saved.has(m.name) ? '★' : '☆';

      li.appendChild(a);
      li.appendChild(btn);
      listEl.appendChild(li);
    }
  }

  // Toggle save using event delegation
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

  // Load data
  fetch(dataPath)
    .then(r => {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(data => {
      all = (Array.isArray(data) ? data : []).filter(m => m && m.name);
      all.sort((a, b) => a.name.localeCompare(b.name));
      render('');
    })
    .catch(err => {
      console.error('Failed to load memorials.json', err);
      listEl.innerHTML = '<li class="empty">Failed to load memorials.</li>';
    });
})();
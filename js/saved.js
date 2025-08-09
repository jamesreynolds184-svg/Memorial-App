(() => {
  const SAVED_KEY = 'savedMemorials';
  const listEl = document.getElementById('memorial-list');
  const searchEl = document.getElementById('search');

  let all = [];
  let savedNames = new Set(loadSaved());

  function loadSaved() {
    try {
      const arr = JSON.parse(localStorage.getItem(SAVED_KEY));
      return Array.isArray(arr) ? arr : [];
    } catch { return []; }
  }
  function saveSaved() {
    localStorage.setItem(SAVED_KEY, JSON.stringify([...savedNames]));
  }

  function render(filter = '') {
    const q = filter.trim().toLowerCase();

    const items = all
      .filter(m => m && m.name && savedNames.has(m.name))
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
      listEl.innerHTML = '<li class="empty">No saved memorials.</li>';
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
      btn.className = 'save-btn saved';
      btn.type = 'button';
      btn.dataset.name = m.name;
      btn.setAttribute('aria-label', 'Unsave memorial');
      btn.textContent = '★';

      li.appendChild(a);
      li.appendChild(btn);
      listEl.appendChild(li);
    }
  }

  // Unsave on star click (and remove from the list)
  listEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.save-btn');
    if (!btn) return;
    const name = btn.dataset.name;
    if (!name) return;

    savedNames.delete(name);
    saveSaved();

    const row = btn.closest('li');
    if (row) row.remove();
    if (!listEl.children.length) {
      listEl.innerHTML = '<li class="empty">No saved memorials.</li>';
    }
  });

  // Live search
  let t;
  searchEl.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(() => render(searchEl.value), 120);
  });

  // Load all memorials, then render saved subset
  fetch('../data/memorials.json')
    .then(r => r.json())
    .then(data => {
      all = (Array.isArray(data) ? data : []).filter(m => m && m.name);
      render('');
    })
    .catch(() => {
      listEl.innerHTML = '<li class="empty">Failed to load memorials.</li>';
    });
})();
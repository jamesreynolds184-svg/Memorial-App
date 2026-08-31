(() => {
  const listEl = document.getElementById('plaque-list');
  const searchEl = document.getElementById('search');

  if (!listEl || !searchEl) {
    console.error('Required elements #plaque-list or #search missing on this page.');
    return;
  }

  // Dynamic data path (works in / and /pages/)
  const dataPath = location.pathname.includes('/pages/')
    ? '../data/allied-special-forces.json'
    : 'data/allied-special-forces.json';

  let all = [];

  function render(filter = '') {
    const q = filter.trim().toLowerCase();
    const items = all.filter(p => {
      if (!p || !p.plaque) return false;
      if (!q) return true;
      const nameMatch = p.plaque.toLowerCase().includes(q);
      const descMatch = p.description && p.description.toLowerCase().includes(q);
      return nameMatch || descMatch;
    });

    listEl.innerHTML = '';
    if (!items.length) {
      listEl.innerHTML = '<li class="empty">No plaques match your search.</li>';
      return;
    }

    for (const p of items) {
      const li = document.createElement('li');
      li.className = 'memorial-row';
      
      const a = document.createElement('a');
      a.className = 'mem-link';
      a.href = `asf-plaque.html?id=${encodeURIComponent(p.id)}&from=asf-plaques`;
      a.textContent = p.plaque;
      
      li.appendChild(a);
      listEl.appendChild(li);
    }
  }

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
      all = (Array.isArray(data) ? data : []).filter(p => p && p.plaque);
      all.sort((a, b) => a.plaque.localeCompare(b.plaque));
      render('');
    })
    .catch(err => {
      console.error('Failed to load allied-special-forces.json', err);
      listEl.innerHTML = '<li class="empty">Failed to load plaques.</li>';
    });
})();

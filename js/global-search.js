(() => {
  const btn = document.getElementById('global-search-btn');
  const panel = document.getElementById('global-search-panel');
  const input = document.getElementById('global-search-input');
  const closeBtn = document.getElementById('gsp-close');
  const list = document.getElementById('global-search-results');
  if (!btn || !panel || !input || !closeBtn || !list) return;

  const dataPath = 'data/memorials.json'; // home.html is at repo root
  let all = [];
  let loaded = false;
  let debounce;
  const MIN = 2;
  const MAX_RESULTS = 30;

  function load() {
    if (loaded) return;
    fetch(dataPath)
      .then(r => {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(data => {
        all = (Array.isArray(data) ? data : []).filter(m => m && m.name);
        all.sort((a,b) => a.name.localeCompare(b.name));
        loaded = true;
      })
      .catch(err => console.error('Global search load failed', err));
  }

  function openPanel() {
    panel.classList.add('active');
    panel.setAttribute('aria-hidden', 'false');
    document.body.classList.add('no-scroll');
    load();
    setTimeout(() => input.focus(), 40);
  }

  function closePanel() {
    panel.classList.remove('active');
    panel.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('no-scroll');
    input.value = '';
    list.innerHTML = '';
  }

  function render(q) {
    const query = q.trim().toLowerCase();
    list.innerHTML = '';
    if (query.length < MIN) return;
    const matches = all.filter(m => m.name.toLowerCase().includes(query)).slice(0, MAX_RESULTS);
    if (!matches.length) {
      list.innerHTML = '<li>No matches</li>';
      return;
    }
    const frag = document.createDocumentFragment();
    for (const m of matches) {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = `pages/memorial.html?name=${encodeURIComponent(m.name)}`;
      a.textContent = m.name;
      a.addEventListener('click', () => closePanel());
      li.appendChild(a);
      if (m.zone) {
        const z = document.createElement('span');
        z.className = 'zone';
        z.textContent = `Z${m.zone}`;
        li.appendChild(z);
      }
      frag.appendChild(li);
    }
    list.appendChild(frag);
  }

  btn.addEventListener('click', () =>
    panel.classList.contains('active') ? closePanel() : openPanel()
  );
  closeBtn.addEventListener('click', closePanel);
  panel.addEventListener('click', e => { if (e.target === panel) closePanel(); });
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape' && panel.classList.contains('active')) closePanel();
  });

  input.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => render(input.value), 130);
  });
})();
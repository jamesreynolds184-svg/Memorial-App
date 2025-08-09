(() => {
  const TABS = ['add', 'list', 'raw'];
  const addResultEl = document.getElementById('add-result');
  const listResultEl = document.getElementById('list-result');
  const fileStatusEl = document.getElementById('file-status');
  const adminListEl = document.getElementById('admin-list');
  const rawJsonEl = document.getElementById('raw-json');

  let data = [];
  let fileHandle = null;

  // Tabs
  function activateTab(name) {
    if (!TABS.includes(name)) name = 'add';
    document.querySelectorAll('.tab-panel')
      .forEach(p => p.classList.toggle('active', p.id === `tab-${name}`));
    document.querySelectorAll('.tab-button')
      .forEach(b => b.classList.toggle('active', b.dataset.tab === name));
    if (location.hash !== `#${name}`) history.replaceState(null, '', `#${name}`);
  }
  document.querySelectorAll('.tab-button').forEach(el => {
    el.addEventListener('click', (e) => { e.preventDefault(); activateTab(el.dataset.tab); });
  });
  window.addEventListener('hashchange', () => activateTab(location.hash.slice(1)));
  activateTab(location.hash.replace('#', '') || 'add');

  // Utils
  const norm = s => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const msg = (el, text, type = 'ok') => { if (el) { el.textContent = text; el.className = `status ${type}`; } };

  // Convert ALL CAPS to Title Case (first letter of each word)
  function titleCase(input) {
    return String(input || '')
      .toLowerCase()
      .replace(/\b([a-z])([a-z'’]*)/g, (_, a, b) => a.toUpperCase() + b);
  }

  // Normalize bullets: strip symbols and use new lines
  function normalizeDescription(input) {
    if (!input) return '';
    let s = String(input);

    // Normalize line breaks
    s = s.replace(/\r\n?/g, '\n');

    // If HTML list items were pasted
    if (/<li[\s>]/i.test(s)) {
      s = s
        .replace(/<\/li>\s*<li[^>]*>/gi, '\n')  // li separators → newline
        .replace(/<li[^>]*>/gi, '')             // remove opening li
        .replace(/<\/li>/gi, '')                // remove closing li
        .replace(/<\/?(ul|ol)[^>]*>/gi, '');    // remove list containers
    }

    // Replace common bullet characters anywhere with newline
    // • \u2022, ● \u25CF, ◦ \u25E6, ▪ \u25AA, ■ \u25A0, ‣ \u2023, · \u00B7, ∙ \u2219
    s = s.replace(/[\u2022\u25CF\u25E6\u25AA\u25A0\u2023\u00B7\u2219]/g, '\n');

    // For each line, strip any leading bullets/dashes and extra spaces
    s = s.split('\n').map(line => {
      return line.replace(/^\s*(?:[–—-]|[\u2022\u25CF\u25E6\u25AA\u25A0\u2023\u00B7\u2219])\s*/, '').trimEnd();
    }).join('\n');

    // Collapse multiple blank lines into a single newline and trim
    s = s.replace(/\n{2,}/g, '\n').trim();

    return s;
  }

  function buildEntry({ name, zone, description }) {
    const z = String(zone).trim();
    return {
      name: titleCase(name),
      zone: z,
      description: normalizeDescription(description),
      map: `/img/maps/map-${z}.png`
    };
  }

  // File choose/save
  async function pickFile() {
    if (!window.showOpenFilePicker) {
      msg(addResultEl, 'This browser cannot choose files. Use Export JSON when done.', 'warn');
      return;
    }
    try {
      const [handle] = await showOpenFilePicker({
        types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }],
        multiple: false
      });
      fileHandle = handle;
      if (fileStatusEl) fileStatusEl.textContent = `Selected: ${handle.name || 'memorials.json'}`;
      msg(addResultEl, 'File selected. Changes will save directly.', 'ok');
      msg(listResultEl, 'File selected. Changes will save directly.', 'ok');
    } catch {}
  }

  async function saveToFile(updated, onOk, onFail) {
    if (!fileHandle?.createWritable) {
      onFail?.('No file selected. Changes kept locally. Use Export JSON when done.');
      return false;
    }
    try {
      const writable = await fileHandle.createWritable();
      await writable.write(JSON.stringify(updated, null, 2));
      await writable.close();
      onOk?.('Saved to memorials.json.');
      return true;
    } catch {
      onFail?.('Failed to save to file. Keep working and Export later.');
      return false;
    }
  }

  function exportJSON(current, onDone) {
    const blob = new Blob([JSON.stringify(current, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'memorials.json';
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    onDone?.('Exported memorials.json. Replace /data/memorials.json manually.');
  }

  // Data load/render
  async function loadData() {
    try {
      const res = await fetch('../data/memorials.json', { cache: 'no-store' });
      data = await res.json();
      if (!Array.isArray(data)) data = [];
    } catch {
      data = [];
      msg(addResultEl, 'Could not read memorials.json (check JSON validity).', 'warn');
    }
    renderList();
    renderRaw();
  }

  function renderList() {
    if (!adminListEl) return;
    adminListEl.innerHTML = '';
    const items = data.filter(m => m && m.name).sort((a,b)=>a.name.localeCompare(b.name));
    if (!items.length) { adminListEl.innerHTML = '<li class="empty">No memorials.</li>'; return; }
    for (const m of items) {
      const li = document.createElement('li'); li.className = 'memorial-row';
      const a = document.createElement('a');
      a.className = 'mem-link'; a.href = `memorial.html?name=${encodeURIComponent(m.name)}`; a.textContent = m.name;
      const del = document.createElement('button'); del.type = 'button'; del.className = 'del-btn'; del.dataset.name = m.name; del.textContent = 'Delete';
      li.appendChild(a); li.appendChild(del); adminListEl.appendChild(li);
    }
  }

  function renderRaw() {
    if (rawJsonEl) rawJsonEl.textContent = JSON.stringify(data, null, 2);
  }

  // Events
  document.getElementById('choose-file')?.addEventListener('click', pickFile);
  document.getElementById('export-btn')?.addEventListener('click', () => exportJSON(data, t => msg(addResultEl, t, 'ok')));

  // Add memorial (no auto-download)
  document.getElementById('add-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('mm-name')?.value;
    const zone = document.getElementById('mm-zone')?.value;
    const description = document.getElementById('mm-desc')?.value;
    if (!name || !zone || !description) { msg(addResultEl, 'Fill in name, zone, and description.', 'warn'); return; }
    const zNum = Number(zone);
    if (!Number.isFinite(zNum) || zNum < 1 || zNum > 16) { msg(addResultEl, 'Zone must be 1–16.', 'warn'); return; }
    if (data.some(m => m && norm(m.name) === norm(name))) { msg(addResultEl, 'That memorial already exists.', 'error'); return; }

    const entry = buildEntry({ name, zone: String(zNum), description });
    const updated = [...data, entry];

    const ok = await saveToFile(updated, t => msg(addResultEl, t, 'ok'), t => msg(addResultEl, t, 'warn'));
    data = updated;
    document.getElementById('add-form')?.reset();
    renderList(); renderRaw();

    if (!ok) msg(addResultEl, 'Added locally. Choose file to save, or click Export JSON when finished.', 'warn');
  });

  // Delete memorial (no auto-download)
  adminListEl?.addEventListener('click', async (e) => {
    const btn = e.target.closest('.del-btn'); if (!btn) return;
    const name = btn.dataset.name; if (!name) return;
    if (!confirm(`Delete "${name}"?`)) return;

    const updated = data.filter(m => m && m.name !== name);
    btn.disabled = true;
    const ok = await saveToFile(updated, t => msg(listResultEl, t, 'ok'), t => msg(listResultEl, t, 'warn'));
    btn.disabled = false;

    data = updated; renderList(); renderRaw();
    if (!ok) msg(listResultEl, 'Deleted locally. Choose file to save, or Export JSON when finished.', 'warn');
  });

  // Normalize all descriptions (for existing entries)
  document.getElementById('normalize-all')?.addEventListener('click', async () => {
    const updated = data.map(m => ({ ...m, description: normalizeDescription(m.description) }));
    const ok = await saveToFile(updated, t => msg(addResultEl, t, 'ok'), t => msg(addResultEl, t, 'warn'));
    data = updated; renderList(); renderRaw();
    if (!ok) msg(addResultEl, 'Normalized locally. Choose file to save, or Export JSON when finished.', 'warn');
  });

  // Init
  loadData();
})();
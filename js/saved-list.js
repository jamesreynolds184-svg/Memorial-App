console.log('[saved-list] loaded');

const SAVED_KEY = 'savedMemorials';

const listEl = document.getElementById('memorial-list');
const searchEl = document.getElementById('search');

let allMemorials = [];
let savedNames = new Set(loadSavedNames());

init();

function init() {
  renderMessage('Loading memorials...');
  fetch('../data/memorials.json')
    .then(r => r.ok ? r.json() : Promise.reject(r.status))
    .then(data => {
      allMemorials = Array.isArray(data) ? data : [];
      renderList();
      wireSearch();
    })
    .catch(err => {
      console.error('[saved-list] load error', err);
      renderMessage('Failed to load memorials.');
    });

  listEl.addEventListener('click', onListClick);
}

function loadSavedNames() {
  try {
    const arr = JSON.parse(localStorage.getItem(SAVED_KEY));
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveSavedNames() {
  localStorage.setItem(SAVED_KEY, JSON.stringify([...savedNames]));
}

function wireSearch() {
  if (!searchEl) return;
  let t;
  searchEl.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(() => renderList(searchEl.value), 120);
  });
}

function onListClick(e) {
  const btn = e.target.closest('.unsave-btn');
  if (!btn) return;
  const name = btn.dataset.name;
  if (!name) return;
  savedNames.delete(name);
  saveSavedNames();
  renderList(searchEl ? searchEl.value : '');
}

function renderMessage(msg) {
  listEl.innerHTML = `<li class="empty">${msg}</li>`;
}

function renderList(filter = '') {
  const q = filter.trim().toLowerCase();
  const items = allMemorials
    .filter(m => savedNames.has(m.name))
    .filter(m => {
      if (!q) return true;
      return (m.name + ' ' + (m.description || '')).toLowerCase().includes(q);
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  if (!items.length) {
    renderMessage('No saved memorials.');
    return;
  }

  const fragments = items.map(m => {
    const desc = (m.description || '').slice(0, 80);
    return `
      <li class="saved-item">
        <div class="saved-line">
          <a class="mem-link" href="memorial.html?name=${encodeURIComponent(m.name)}">${escapeHtml(m.name)}</a>
          <button type="button" class="unsave-btn" data-name="${escapeHtml(m.name)}" title="Remove from saved">✕</button>
        </div>
        ${desc ? `<div class="saved-desc">${escapeHtml(desc)}${m.description && m.description.length > 80 ? '…' : ''}</div>` : ''}
      </li>
    `;
  });

  listEl.innerHTML = fragments.join('');
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}
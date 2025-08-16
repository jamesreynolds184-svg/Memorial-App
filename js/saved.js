// Simplified restored logic for saved page

const SAVED_KEY = 'savedMemorials';
const MIN_STOPS = 2;

const buildBtn = document.getElementById('build-tour-btn');
const statusEl = document.getElementById('tour-status');
const listEl = document.getElementById('memorial-list');
const searchEl = document.getElementById('search');

let allMemorials = [];
let savedNames = loadSavedNames(); // Set of names (exact names)

init();

function init(){
  log('init saved.js; saved count:', savedNames.size);
  if(buildBtn){
    buildBtn.disabled = true;
  }

  fetch('../data/memorials.json')
    .then(r=>r.json())
    .then(data=>{
      allMemorials = Array.isArray(data)? data : [];
      log('memorials loaded', allMemorials.length);
      // Dispatch so tour-planner gets list
      window.dispatchEvent(new CustomEvent('memorialsData',{ detail:{ all: allMemorials }}));
      renderSavedList();
      updateBuildButton();
    })
    .catch(e=>console.error('memorials load failed', e));

  if(searchEl){
    searchEl.addEventListener('input', ()=>{
      renderSavedList(searchEl.value);
    });
  }
}

function loadSavedNames(){
  try{
    const arr = JSON.parse(localStorage.getItem(SAVED_KEY));
    return new Set(Array.isArray(arr)?arr:[]);
  }catch{
    return new Set();
  }
}

function getSavedMemorials(){
  return allMemorials.filter(m=>savedNames.has(m.name));
}

function renderSavedList(filter=''){
  if(!listEl) return;
  const f = filter.trim().toLowerCase();
  const items = getSavedMemorials().filter(m => {
    if(!f) return true;
    return m.name.toLowerCase().includes(f);
  }).sort((a,b)=>a.name.localeCompare(b.name));

  listEl.innerHTML = '';
  if(!items.length){
    const li = document.createElement('li');
    li.textContent = 'No saved memorials.';
    listEl.appendChild(li);
    return;
  }
  items.forEach(m=>{
    const li = document.createElement('li');
    li.textContent = m.name;
    listEl.appendChild(li);
  });
  log('rendered saved list', items.length);
}

function updateBuildButton(){
  if(!buildBtn) return;
  const count = getSavedMemorials().length;
  buildBtn.disabled = count < MIN_STOPS;
  if(statusEl){
    statusEl.textContent = count < MIN_STOPS
      ? `Need ${MIN_STOPS - count} more saved to build a tour`
      : 'Ready to build a tour';
  }
  log('updateBuildButton count:', count, 'disabled:', buildBtn.disabled);
}

function log(...a){ console.log('[saved]', ...a); }
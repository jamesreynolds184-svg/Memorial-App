(function(){
  const DEBUG = location.search.includes('tourDebug=1');
  function d(tag,obj){ if(DEBUG) console.log('[TourPlanner]',tag,obj||''); logBox(tag,obj); }
  function logBox(tag,obj){
    const el = document.getElementById('tour-debug-box');
    if(!el) return;
    el.textContent += tag+' '+JSON.stringify(obj||{})+'\n';
  }

  function loadSavedNames(){
    try{
      const arr = JSON.parse(localStorage.getItem('savedMemorials'));
      return Array.isArray(arr)?arr:[];
    }catch{ return []; }
  }

  // Very simple Haversine (meters)
  function hav(a,b){
    const R=6371000,toRad=x=>x*Math.PI/180;
    const dLat=toRad(b.lat-a.lat), dLng=toRad(b.lng-a.lng);
    const sa=Math.sin(dLat/2), sb=Math.sin(dLng/2);
    const h=sa*sa+Math.cos(toRad(a.lat))*Math.cos(toRad(b.lat))*sb*sb;
    return 2*R*Math.atan2(Math.sqrt(h), Math.sqrt(1-h));
  }

  const planner = {
    _all: [],
    lastTour: null,
    enableIfPossible(all){
      this._all = all||this._all;
      this.refreshButtons();
    },
    refreshButtons(){
      const saved = loadSavedNames();
      const buildBtn = document.getElementById('build-tour-btn');
      const mapBtn = document.getElementById('view-map-btn');
      const ok = saved.length >= 2;
      if(buildBtn){ buildBtn.disabled = !ok; }
      if(mapBtn){ mapBtn.disabled = !ok; }
      d('refreshButtons',{saved: saved.length, ok});
    },
    buildFromSaved(opts={}){
      const savedNames = loadSavedNames();
      if(savedNames.length < 2){
        d('buildSkipped','need >=2');
        return null;
      }
      // Gather memorial objects in saved order
      const mems = this._all.filter(m=> savedNames.includes(m.name));
      if(mems.length < 2){
        d('buildNoMemorials',{found:mems.length});
        return null;
      }
      // Simple order: as saved (you can plug in TSP later)
      const nodes = mems.map(m=>({
        name: m.name,
        lat: m.lat,
        lng: m.lng
      }));
      // Build trivial order array
      const order = nodes.map((_,i)=>i);
      // Total straight distance
      let total=0;
      for(let i=1;i<nodes.length;i++) total += hav(nodes[i-1], nodes[i]);
      const tour = { nodes, order, totalMeters: total };
      sessionStorage.setItem('plannedTour', JSON.stringify(tour));
      this.lastTour = tour;
      d('tourBuilt',{stops:nodes.length,total:Math.round(total)});
      if(!opts.silent){
        const status = document.getElementById('tour-status');
        if(status) status.textContent = `Tour ready (${nodes.length} stops)`;
      }
      return tour;
    }
  };

  window._tourPlanner = planner;
  window.addEventListener('memorialsData', e=>planner.enableIfPossible(e.detail.all));

  // Wire buttons (safe even if elements not yet present)
  document.addEventListener('DOMContentLoaded', ()=>{
    const buildBtn = document.getElementById('build-tour-btn');
    if(buildBtn){
      buildBtn.addEventListener('click', ()=>{
        planner.buildFromSaved();
      });
    }
    const mapBtn = document.getElementById('view-map-btn');
    if(mapBtn){
      mapBtn.addEventListener('click', ()=>{
        if(!planner.lastTour){
          planner.buildFromSaved({silent:true});
        }
        const hasTour = !!sessionStorage.getItem('plannedTour');
        d('viewMapClick',{hasTour});
        if(hasTour){
          location.href='tour-map.html?debug=1';
        } else {
          alert('Unable to build tour – need at least 2 saved memorials.');
        }
      });
    }
    planner.refreshButtons();
  });
})();
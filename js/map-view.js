(function(){
  const dataPath = '../data/memorials.json';
  const qs = new URLSearchParams(location.search);
  const focusName = qs.get('focus'); // ADDED

  const mapPanel = document.getElementById('map-panel');
  const mapEl = document.getElementById('map-wrap');
  const searchEl = document.getElementById('map-search');
  const zoneEl = document.getElementById('map-zone');
  const listEl = document.getElementById('map-list');
  const countEl = document.getElementById('map-count');
  const btnLocate = document.getElementById('map-locate');
  const btnReset  = document.getElementById('map-reset');
  const btnExpand = document.getElementById('map-expand');
  const btnTrack  = document.getElementById('map-track'); // ADDED

  let map, markersLayer;
  let all = [];
  let points = [];
  let leafletMarkers = new Map();
  let lastBounds = null;
  let geoFence = null;
  let minZoomAllowed = null;
  const GEOFENCE_PAD = 0.35;
  const ZOOM_DELTA  = 1;

  let userMarker = null;        // ADDED
  let userAccuracyCircle = null;// ADDED
  let watchId = null;           // ADDED
  let lastFixTs = 0;            // ADDED
  const STALE_MS = 20000;       // ADDED (ignore >20s old)
  const MIN_ACCURACY_SHOW = 120;// ADDED (hide circle if worse)

  function initMap(center=[52.75,-1.72], zoom=14){
    map = L.map(mapEl, {
      center,
      zoom,
      attributionControl:false
    });

    L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png',
      { attribution: '© OpenStreetMap contributors | Tiles © CARTO', maxZoom: 20 }
    ).addTo(map);

    L.control.attribution({ position:'bottomright' })
      .addTo(map)
      .addAttribution('© OpenStreetMap contributors | Tiles © CARTO');

    markersLayer = L.layerGroup().addTo(map);
  }

  function load(){
    fetch(dataPath).then(r=>r.json()).then(data=>{
      all = Array.isArray(data)?data:[];
      points = all.filter(m =>
        m && m.name && m.location &&
        Number.isFinite(m.location.lat) &&
        Number.isFinite(m.location.lng)
      );
      buildZoneFilter();
      if (points.length) {
        const first = points[0];
        initMap([first.location.lat, first.location.lng]);
      } else {
        initMap();
      }
      render();
      if (focusName) setTimeout(()=>attemptFocus(), 500); // allow markers fit/size first
    }).catch(()=>{
      mapEl.textContent='Failed to load data';
    });
  }

  function buildZoneFilter(){
    const zones = [...new Set(points.map(p=>p.zone).filter(z=>z!==undefined && z!==null && z!==''))].sort((a,b)=>a-b);
    zones.forEach(z=>{
      const opt=document.createElement('option');
      opt.value=z;
      opt.textContent='Zone '+z;
      zoneEl.appendChild(opt);
    });
  }

  function applyFilters(){
    const q = (searchEl.value||'').trim().toLowerCase();
    const z = zoneEl.value;
    return points.filter(p=>{
      if (z && String(p.zone)!==z) return false;
      if (q && !p.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }

  function render(){
    const filtered = applyFilters();
    countEl.textContent = filtered.length + ' shown';

    listEl.innerHTML = '';
    filtered.forEach(m=>{
      const li=document.createElement('li');
      li.innerHTML = `<span>${m.name}</span>${m.zone?`<span class="zone">Z${m.zone}</span>`:''}`;
      li.onclick = ()=> focusMarker(m);
      listEl.appendChild(li);
    });

    markersLayer.clearLayers();
    leafletMarkers.clear();
    filtered.forEach(m=>{
      const mk = L.marker([m.location.lat, m.location.lng])
        .addTo(markersLayer);

      // Bind popup with autoPan disabled so map does NOT shift marker upward
      mk.bindPopup(
        `<strong>${escapeHtml(m.name)}</strong><br>` +
        (m.zone?`Zone ${escapeHtml(m.zone)}<br>`:'') +
        `<a href="memorial.html?name=${encodeURIComponent(m.name)}">Open page</a>`,
        { autoPan:false, closeButton:true }
      );

      leafletMarkers.set(m.name, mk);
    });

    if (filtered.length){
      const group = L.featureGroup([...leafletMarkers.values()]);
      const b = group.getBounds().pad(0.18);
      map.fitBounds(b);
      lastBounds = b;

      // Derive / refresh geofence from ALL points (not just filtered) once
      if (!geoFence && points.length){
        const allGroup = L.featureGroup(points.map(p=>L.marker([p.location.lat,p.location.lng])));
        geoFence = allGroup.getBounds().pad(GEOFENCE_PAD);
        applyGeoFence();
      }
      // If still no fence (e.g. 0 points) you could set a fixed one here.
    }
  }

  function attemptFocus(){
    const target = points.find(p => p.name.toLowerCase() === focusName.toLowerCase());
    if (!target) return;
    focusMarker(target);
    highlightList(target.name);
  }

  function highlightList(n){
    [...listEl.children].forEach(li=>{
      if (li.textContent.toLowerCase().includes(n.toLowerCase())){
        li.classList.add('pulse-focus');
        setTimeout(()=>li.classList.remove('pulse-focus'), 2600);
      }
    });
  }

  function applyGeoFence(){
    if (!geoFence) return;
    map.setMaxBounds(geoFence);

    // Determine a min zoom: fit all markers, then allow zooming out only a bit
    // Temporarily fit to fence to get its zoom
    const targetCenter = geoFence.getCenter();
    const tmpBounds = geoFence;
    map.fitBounds(tmpBounds);
    const fenceZoom = map.getZoom();
    minZoomAllowed = fenceZoom - ZOOM_DELTA;
    // Restore to lastBounds view if it existed
    if (lastBounds) map.fitBounds(lastBounds);

    // Enforce pan & zoom limits softly
    map.on('moveend', keepInside);
    map.on('drag', keepInside);
    map.on('zoomend', () => {
      if (minZoomAllowed != null && map.getZoom() < minZoomAllowed){
        map.setZoom(minZoomAllowed);
      }
    });
  }

  function keepInside(){
    if (!geoFence) return;
    const c = map.getCenter();
    if (!geoFence.contains(c)){
      map.panInsideBounds(geoFence, { animate:true });
    }
  }

  function focusMarker(m){
    const mk = leafletMarkers.get(m.name);
    if (!mk) return;
    const latlng = mk.getLatLng();

    // Temporarily remove bounds so we can center cleanly (if near edge)
    let restoreFence = false;
    if (geoFence){
      map.setMaxBounds(null);
      restoreFence = true;
    }
    map.setView(latlng, 18, { animate:true });
    setTimeout(()=>{
      mk.openPopup();
      if (restoreFence && geoFence){
        map.setMaxBounds(geoFence);
      }
    }, 350);
  }

  function expandToggle(){
    const fs = mapPanel.classList.toggle('fullscreen');
    btnExpand.setAttribute('aria-expanded', fs ? 'true':'false');
    btnExpand.textContent = fs ? '⤡' : '⤢';
    setTimeout(()=> { map.invalidateSize(); if (fs && lastBounds) map.fitBounds(lastBounds); }, 350);
  }

  function locateUser(){ // MODIFIED (force fresh single fix)
    if (!navigator.geolocation) return;
    btnLocate.disabled = true;
    navigator.geolocation.getCurrentPosition(pos=>{
      btnLocate.disabled = false;
      handlePosition(pos, { single:true });
    }, ()=>{
      btnLocate.disabled = false;
    }, {
      enableHighAccuracy:true,
      timeout:10000,
      maximumAge:0    // force no cached position
    });
  }

  // ADDED: start / stop continuous tracking
  function startTracking(){
    if (!navigator.geolocation || watchId != null) return;
    btnTrack.textContent = '⏹';
    btnTrack.title = 'Stop live tracking';
    btnTrack.setAttribute('aria-pressed','true');
    watchId = navigator.geolocation.watchPosition(
      pos => handlePosition(pos, { single:false }),
      err => {
        console.warn('watchPosition error', err);
        stopTracking();
      },
      {
        enableHighAccuracy:true,
        maximumAge:1000,  // allow up to 1s cached between rapid fixes
        timeout:15000
      }
    );
  }
  function stopTracking(){
    if (watchId != null){
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
    }
    btnTrack.textContent = '▶︎';
    btnTrack.title = 'Start live tracking';
    btnTrack.setAttribute('aria-pressed','false');
  }

  // ADDED: generic handler for both single + watch
  function handlePosition(pos, meta){
    const { latitude, longitude, accuracy } = pos.coords;
    const ts = pos.timestamp || Date.now();

    // Ignore stale (iOS sometimes replays)
    if (Date.now() - ts > STALE_MS){
      console.log('Ignoring stale position', new Date(ts).toISOString());
      return;
    }
    // Ignore if duplicate timestamp
    if (ts <= lastFixTs) return;
    lastFixTs = ts;

    updateUserMarker(latitude, longitude, accuracy);

    if (meta.single){
      // For single locate also pan/zoom
      map.setView([latitude, longitude], 17, { animate:true });
    }
  }

  // ADDED: update / create marker + accuracy circle
  function updateUserMarker(lat, lng, acc){
    if (!map) return;
    if (!userMarker){
      userMarker = L.circleMarker([lat,lng], {
        radius:8, weight:2, color:'#005969', fillColor:'#008ca3', fillOpacity:0.55
      }).addTo(map).bindPopup('You are here');
    } else {
      userMarker.setLatLng([lat,lng]);
    }
    if (acc && acc < MIN_ACCURACY_SHOW){
      if (!userAccuracyCircle){
        userAccuracyCircle = L.circle([lat,lng], {
          radius: acc,
          color:'#008ca3',
          weight:1,
          fillColor:'#008ca3',
          fillOpacity:0.15,
          interactive:false
        }).addTo(map);
      } else {
        userAccuracyCircle.setLatLng([lat,lng]);
        userAccuracyCircle.setRadius(acc);
      }
    } else if (userAccuracyCircle){
      map.removeLayer(userAccuracyCircle);
      userAccuracyCircle = null;
    }
  }

  function resetView(){
    if (lastBounds) map.fitBounds(lastBounds);
  }

  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"
    }[c]));
  }

  searchEl.addEventListener('input', debounce(render, 160));
  zoneEl.addEventListener('change', render);
  btnExpand.addEventListener('click', expandToggle);
  btnLocate.addEventListener('click', locateUser);
  if (btnTrack){
    btnTrack.addEventListener('click', () => {
      if (watchId == null) startTracking(); else stopTracking();
    });
  }

// Optionally auto-start tracking on page load for faster first fix (uncomment to enable):
// startTracking();

  document.addEventListener('keydown', e=>{
    if (e.key==='Escape' && mapPanel.classList.contains('fullscreen')) expandToggle();
  });

  function debounce(fn, ms){
    let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), ms); };
  }

  load();
})();
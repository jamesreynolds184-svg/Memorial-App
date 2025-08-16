(function(){
  const dataPath = '../data/memorials.json';
  const footpathsPath = '../data/footpaths.geojson';
  // --- DEBUG FLAG ---
  const DEBUG_ROUTING = false;
  // Show individual footpath node (blue) debug markers?
  const SHOW_FOOTPATH_NODES = false; // set true only when debugging node graph

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
  const routeInfoEl = document.getElementById('route-info'); // ADDED

  let map, markersLayer;
  let all = [];
  let points = [];
  let leafletMarkers = new Map();
  let lastBounds = null;
  let geoFence = null;
  let minZoomAllowed = null;
  const GEOFENCE_PAD = 0.35;
  const ZOOM_DELTA  = 1;
  const ENABLE_GEOFENCE = false;

  // --- Bridging / hop config ---
  const BRIDGE_MAX_METERS = 5;
  const BRIDGE_SECOND_PASS_MAX = 12;
  let  bridgingExpanded = false;

  const HOP_MAX_METERS = 25;
  const HOP_PENALTY    = 2.0;
  const HOP_MAX_ITER   = 12;

  // === Debug helpers (moved near top so dbg exists before use) ===
  let debugPanelEl = null;
  let debugVisible = true;
  let debugLayers = [];
  function ensureDebugPanel(){
    if (!DEBUG_ROUTING) return;
    if (debugPanelEl) return;
    debugPanelEl = document.createElement('div');
    Object.assign(debugPanelEl.style,{
      position:'fixed',bottom:'0',right:'0',width:'340px',maxHeight:'50vh',
      overflow:'auto',background:'rgba(0,0,0,0.75)',color:'#eee',
      font:'11px/1.35 monospace',padding:'6px 8px',zIndex:9999,
      borderTopLeftRadius:'6px'
    });
    debugPanelEl.innerHTML = '<strong>Routing Debug</strong> (D to toggle)<hr style="border:none;border-top:1px solid #444;margin:4px 0;">';
    document.body.appendChild(debugPanelEl);
  }
  function dbg(){
    if (!DEBUG_ROUTING) return;
    ensureDebugPanel();
    console.log('[ROUTE]', ...arguments);
    if (debugPanelEl){
      const div=document.createElement('div');
      div.textContent = [...arguments].map(a=> typeof a==='object'? JSON.stringify(a): a).join(' ');
      debugPanelEl.appendChild(div);
      debugPanelEl.scrollTop = debugPanelEl.scrollHeight;
    }
  }
  function clearDebugLayers(){
    debugLayers.forEach(l=>{ try{ map.removeLayer(l);}catch(_){ }});
    debugLayers = [];
  }
  document.addEventListener('keydown', e=>{
    if (e.key.toLowerCase()==='d' && debugPanelEl){
      debugVisible = !debugVisible;
      debugPanelEl.style.display = debugVisible?'block':'none';
    }
  });
  // === End debug helpers ===

  let userMarker = null;        // ADDED
  let userAccuracyCircle = null;// ADDED
  let watchId = null;           // ADDED
  let lastFixTs = 0;            // ADDED
  const STALE_MS = 20000;       // ADDED (ignore >20s old)
  const MIN_ACCURACY_SHOW = 120;// ADDED (hide circle if worse)

  let memorials = [];
  let markers = [];

  let footpathsLayer = null; // ADDED
  let footpathGraph = { nodes: [], adj: new Map() }; // ADDED
  let routeLayer = null; // ADDED
  let lastRouteDistance = 0; // ADDED

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
    fetch(dataPath)
      .then(r=>{
        if (!r.ok) throw new Error('HTTP '+r.status);
        return r.json();
      })
      .then(data=>{
        all = Array.isArray(data)?data:[];
        points = all.filter(m =>
          m && m.name && m.location &&
          Number.isFinite(m.location.lat) &&
          Number.isFinite(m.location.lng)
        );
        memorials = points;
        buildZoneFilter();
        if (points.length) {
          const first = points[0];
          initMap([first.location.lat, first.location.lng]);
        } else {
          initMap();
        }
        // Load footpaths once map exists
        loadFootpaths(); // ADDED
        render();
        if (focusName) setTimeout(()=>attemptFocus(), 500);
      })
      .catch(err=>{
        console.error('Data load failed:', err);
        if (!map) {
          initMap();
          loadFootpaths(); // ADDED (still show footpaths even if memorials missing)
        }
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

  function hasCoords(m) {
    return m && m.location && Number.isFinite(m.location.lat) && Number.isFinite(m.location.lng);
  }

  function buildMarkers(list) {
    // Clear old
    markers.forEach(k => map.removeLayer(k.marker));
    markers = [];

    const withCoords = list.filter(hasCoords);
    withCoords.forEach(m => {
      const { lat, lng } = m.location;
      const marker = L.marker([lat, lng]);
      marker.addTo(map).bindPopup(
        `<strong>${escapeHtml(m.name)}</strong><br><button data-go="${escapeHtml(m.name)}" class="go-btn">Open</button>`
      );
      markers.push({ m, marker });
    });

    if (withCoords.length) {
      const group = L.featureGroup(markers.map(o => o.marker));
      map.fitBounds(group.getBounds().pad(0.15));
    }
    updateCount(withCoords.length);
  }

  function updateCount(n) {
    const countEl = document.getElementById('map-count');
    if (countEl) countEl.textContent = String(n);
  }

  function applyFilters() {
    const q = searchEl.value.trim().toLowerCase();
    const z = zoneEl.value;            // FIX: was zoneSel
    const filtered = memorials.filter(m => {
      if (!hasCoords(m)) return false;
      if (z && m.zone !== z) return false;
      if (q) {
        return (m.name || '').toLowerCase().includes(q) ||
               (m.description || '').toLowerCase().includes(q);
      }
      return true;
    });
    return filtered; // FIX: return result
  }

  function render(){
    const filtered = applyFilters(); // now returns array
    updateCount(filtered.length);    // unified count display
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
      const mk = L.marker([m.location.lat, m.location.lng]).addTo(markersLayer);
      mk.bindPopup(
        `<strong>${escapeHtml(m.name)}</strong><br>` +
        (m.zone?`Zone ${escapeHtml(m.zone)}<br>`:'') +
        `<a href="memorial.html?name=${encodeURIComponent(m.name)}">Open page</a><br>` +
        `<button class="route-btn" data-name="${escapeHtml(m.name)}">Route</button>`,
        { autoPan:false, closeButton:true }
      );
      leafletMarkers.set(m.name, mk);
    });

    if (filtered.length){
      const group = L.featureGroup([...leafletMarkers.values()]);
      const b = group.getBounds().pad(0.18);
      map.fitBounds(b);
      lastBounds = b;

      if (!geoFence && points.length){
        if (ENABLE_GEOFENCE){ // ADDED guard
          const allGroup = L.featureGroup(points.map(p=>L.marker([p.location.lat,p.location.lng])));
          geoFence = allGroup.getBounds().pad(GEOFENCE_PAD);
          applyGeoFence();
        }
      }
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
    if (!ENABLE_GEOFENCE) return; // ADDED
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

  // (Event listeners) add null guards to avoid TypeErrors
  searchEl.addEventListener('input', debounce(render, 160));
  zoneEl.addEventListener('change', render);
  if (btnExpand) btnExpand.addEventListener('click', expandToggle);
  if (btnLocate) btnLocate.addEventListener('click', locateUser);
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

  // ADDED: load + add footpaths layer
  function loadFootpaths(){
    fetch(footpathsPath)
      .then(r=>{ if(!r.ok) throw new Error('Footpaths load failed '+r.status); return r.json(); })
      .then(gj=>{
        // Remove any prior layer
        if (footpathsLayer) { map.removeLayer(footpathsLayer); footpathsLayer = null; }

        // Add GeoJSON with ONLY black polylines (no point markers)
        footpathsLayer = L.geoJSON(gj, {
          style: ()=>({
            color:'#000',
            weight:2,
            opacity:0.9
          }),
          onEachFeature: (feat, layer)=>{
            // Optional: no popup, keep clean
          }
        }).addTo(map);

        buildFootpathGraph(gj);
      })
      .catch(err=>{ console.error(err); });
  }

  // ADDED: plan route to memorial (enhanced path snapping)
   const DEFAULT_START_POINT = [52.727859987183336, -1.7313294102227985]; // [lat,lng]
   const WALK_SPEED_MPS = 1.4; // ~5.0 km/h average walking

   function getActiveStartPoint(){
     if (userMarker){
       const ll = userMarker.getLatLng();
       return [ll.lat, ll.lng];
     }
     return DEFAULT_START_POINT;
   }

   function computeLineDistance(coords){
     let d=0;
     for (let i=1;i<coords.length;i++){
       d += haversineMeters(coords[i-1], coords[i]);
     }
     return d;
   }
   function formatDistance(m){
     if (m < 1000) return m.toFixed(0)+' m';
     return (m/1000).toFixed(m<5000?2:1)+' km';
   }
   function formatDuration(seconds){
     if (seconds < 90) return Math.round(seconds)+' s';
     const m = Math.round(seconds/60);
     if (m < 60) return m+' min';
     const h = Math.floor(m/60);
     const rm = m%60;
     return h+'h '+(rm?rm+'m':'');
   }
   function updateRouteInfo(distanceMeters, startPointUsed, targetName){
     if (!routeInfoEl) return;
     lastRouteDistance = distanceMeters;
     const timeSec = distanceMeters / WALK_SPEED_MPS;
     routeInfoEl.hidden = false;
     routeInfoEl.innerHTML =
       `<strong>Route to:</strong> ${escapeHtml(targetName)}<br>`+
       `<strong>Distance:</strong> ${formatDistance(distanceMeters)} &nbsp; `+
       `<strong>Walk time:</strong> ${formatDuration(timeSec)}<br>`+
       `<small>From ${userMarker?'your location':'default start'} (speed ${ (WALK_SPEED_MPS*3.6).toFixed(1)} km/h)</small>`;
   }

  function planRouteTo(memorial){
    if (!map) return;
    dbg('---- PLAN ROUTE (usable path heuristic) ----');
    if (routeLayer){ map.removeLayer(routeLayer); routeLayer=null; }
    // Do NOT clear base debug node markers (we keep them); remove only prior temp hop visuals:
    debugLayers = debugLayers.filter(l=>{
      if (l && l.options && l.options.className === 'hop-edge') { try{ map.removeLayer(l);}catch(_){ } return false; }
      return true;
    });

    if (!memorial || !memorial.location){
      dbg('No memorial location'); return;
    }
    const targetLatLng = [memorial.location.lat, memorial.location.lng];
    const START_POINT = getActiveStartPoint(); // dynamic start
    dbg('Memorial:', memorial.name, 'Target:', targetLatLng);

    if (footpathGraph.nodes.length < 2){
      dbg('Fallback: graph has <2 nodes');
      drawDirectFallback(START_POINT, targetLatLng,'graph-too-small');
      return;
    }

    // Clone graph for routing session
    const routeNodes = footpathGraph.nodes.map(n=>({...n}));
    const routeAdj = new Map();
    footpathGraph.adj.forEach((arr,k)=> routeAdj.set(k, arr.map(e=>({...e}))));

    function addVirtualNode(lat,lng,label){
      const id=routeNodes.length;
      routeNodes.push({id,lat,lng,virtual:true,label});
      routeAdj.set(id,[]);
      return id;
    }

    // Unique edges (for snapping projection)
    const edges=[];
    footpathGraph.adj.forEach((arr,a)=>{
      arr.forEach(e=>{
        const b=e.to;
        if (a<b) edges.push({a,b});
      });
    });

    function snapPoint(lat,lng,label){
      let bestNode=-1, bestNodeD=Infinity;
      for (const n of routeNodes){
        const d=haversineMeters([lat,lng],[n.lat,n.lng]);
        if (d<bestNodeD){ bestNodeD=d; bestNode=n.id; }
      }
      let bestSeg=null;
      for (const ed of edges){
        const A=routeNodes[ed.a], B=routeNodes[ed.b];
        const proj=projectLatLngToSegment([lat,lng],[A.lat,A.lng],[B.lat,B.lng]);
        if (!proj.onSegment) continue;
        if (!bestSeg || proj.distMeters<bestSeg.distMeters){
          bestSeg={
            a:A.id, b:B.id,
            projLat:proj.lat, projLng:proj.lng,
            distMeters:proj.distMeters,
            aDist:proj.aDistMeters, bDist:proj.bDistMeters
          };
        }
      }
      if (bestSeg){
        dbg(label,'snapped segment', bestSeg.a,'-',bestSeg.b,'offset',bestSeg.distMeters.toFixed(1),'m');
        return {type:'segment',...bestSeg};
      }
      dbg(label,'snapped node',bestNode,'dist',bestNodeD.toFixed(1),'m');
      return {type:'node',nodeId:bestNode,distMeters:bestNodeD};
    }

    function integrateSnap(snap,label){
      if (snap.type==='node') return snap.nodeId;
      const vId=addVirtualNode(snap.projLat,snap.projLng,label);
      const a=snap.a, b=snap.b;
      routeAdj.get(a).push({to:vId,w:snap.aDist});
      routeAdj.get(vId).push({to:a,w:snap.aDist});
      routeAdj.get(b).push({to:vId,w:snap.bDist});
      routeAdj.get(vId).push({to:b,w:snap.bDist});
      if (DEBUG_ROUTING){
        const vMark = L.circleMarker([snap.projLat,snap.projLng],{
          radius:5,color:'#d33682',weight:2,fillColor:'#fdf6e3',fillOpacity:0.9
        }).addTo(map);
        debugLayers.push(vMark);
      }
      return vId;
    }

    const startSnap = snapPoint(START_POINT[0], START_POINT[1],'start');
    const targetSnap = snapPoint(targetLatLng[0], targetLatLng[1],'target');
    const startId = integrateSnap(startSnap,'start');
    const targetId = integrateSnap(targetSnap,'target');

    // Ensure connectivity with heuristic hops
    const hopEdges = [];
    const hops = ensureConnectedHeuristic(startId, targetId, routeNodes, routeAdj, hopEdges);
    dbg('Heuristic hops added:', hops);

    // Visualize hop edges
    if (DEBUG_ROUTING){
      hopEdges.forEach(h=>{
        const A=routeNodes[h.a], B=routeNodes[h.b];
        const pl = L.polyline([[A.lat,A.lng],[B.lat,B.lng]],{
          color:'#00ffc8',weight:4,opacity:0.9,dashArray:'2,6',
          className:'hop-edge'
        }).addTo(map);
        debugLayers.push(pl);
      });
    }

    // Dijkstra (we keep simple; hops already penalised by weight)
    dbg('Run Dijkstra with', routeNodes.length,'nodes');
    const pathIds = dijkstraWithGraph(startId,targetId,routeAdj,routeNodes.length);
    if (!pathIds.length){
      dbg('Still no path after hops – fallback');
      drawDirectFallback(START_POINT,targetLatLng,'no-path-after-hops');
      return;
    }
    dbg('Path node count', pathIds.length);

    let coords = pathIds.map(id=> [routeNodes[id].lat, routeNodes[id].lng]);

    // Start hop line if needed
    const distStartHop = haversineMeters(coords[0], START_POINT);
    if (distStartHop > 1.5){
      coords.unshift(START_POINT);
      dbg('Added start hop', distStartHop.toFixed(1),'m');
    }

    // Final hop
    const endDist = haversineMeters(coords[coords.length-1], targetLatLng);
    let addFinalHop=false;
    if (endDist > 3){
      coords.push(targetLatLng);
      addFinalHop=true;
      dbg('Added final hop', endDist.toFixed(1),'m');
    }

    routeLayer = L.polyline(coords,{
      color:'#ff7b1a', weight:5, opacity:0.9, lineCap:'round', lineJoin:'round'
    }).addTo(map);

    if (addFinalHop){
      L.polyline([coords[coords.length-2], coords[coords.length-1]],{
        color:'#ff7b1a',weight:5,opacity:0.9,dashArray:'6,6'
      }).addTo(map);
    }
    if (distStartHop > 1.5){
      L.polyline([coords[0],coords[1]],{
        color:'#ff7b1a',weight:5,opacity:0.9,dashArray:'6,6'
      }).addTo(map);
    }

    map.fitBounds(routeLayer.getBounds().pad(0.15));
    dbg('Route drawn. Total points', coords.length);

    // Compute stats & show
    const distMeters = computeLineDistance(coords);
    updateRouteInfo(distMeters, START_POINT, memorial.name);
  }

  function drawDirectFallback(a,b,reason){
    routeLayer = L.polyline([a,b],{
      color:'#ff7b1a',weight:4,dashArray:'6,6'
    }).addTo(map);
    map.fitBounds(routeLayer.getBounds().pad(0.12));
    dbg('Direct fallback line drawn. Reason:', reason);
    const dist = haversineMeters(a,b);
    updateRouteInfo(dist, a, (reason||'Target'));
  }

  // Project point P onto segment AB (lat,lng). Uses simple equirectangular approximation.
  function projectLatLngToSegment(P, A, B){
    const refLat = (A[0]+B[0]+P[0])/3 * Math.PI/180;
    const mLat = 111320;
    const mLng = 111320 * Math.cos(refLat);
    const toXY=([lat,lng])=>[lat*mLat, lng*mLng];
    const p=toXY(P), a=toXY(A), b=toXY(B);
    const vx=b[0]-a[0], vy=b[1]-a[1];
    const wx=p[0]-a[0], wy=p[1]-a[1];
    const vLen2 = vx*vx+vy*vy;
    if (!vLen2){
      return { onSegment:false, distMeters: haversineMeters(P,A) };
    }
    let t = (wx*vx+wy*vy)/vLen2;
    const onSegment = t>=0 && t<=1;
    if (t<0)t=0; if (t>1)t=1;
    const projX = a[0]+t*vx, projY=a[1]+t*vy;
    const dx=p[0]-projX, dy=p[1]-projY;
    const distMeters=Math.sqrt(dx*dx+dy*dy);
    const segLenMeters = Math.sqrt(vLen2);
    const aDistMeters = segLenMeters*t;
    const bDistMeters = segLenMeters*(1-t);
    const toLatLng=(x,y)=>[x/mLat, y/mLng];
    const projLatLng=toLatLng(projX,projY);
    return {
      onSegment, distMeters,
      lat:projLatLng[0], lng:projLatLng[1],
      aDistMeters, bDistMeters, segLenMeters
    };
  }

  // Dijkstra on supplied adjacency for N nodes
  function dijkstraWithGraph(srcId,dstId,adj,N){
    const dist=new Array(N).fill(Infinity);
    const prev=new Array(N).fill(-1);
    dist[srcId]=0;
    const pq=[{id:srcId,d:0}];
    while(pq.length){
      pq.sort((a,b)=>a.d-b.d);
      const {id,d}=pq.shift();
      if (d!==dist[id]) continue;
      if (id===dstId) break;
      for (const e of adj.get(id)||[]){
        const nd=d+e.w;
        if (nd<dist[e.to]){
          dist[e.to]=nd;
          prev[e.to]=id;
          pq.push({id:e.to,d:nd});
        }
      }
    }
    if (dist[dstId]===Infinity) return [];
    const path=[];
    for (let c=dstId;c!==-1;c=prev[c]){ path.push(c); if (c===srcId) break; }
    return path.reverse();
  }

  function haversineMeters(a,b){
    const R=6371000;
    const toRad=x=>x*Math.PI/180;
    const dLat=toRad(b[0]-a[0]);
    const dLng=toRad(b[1]-a[1]);
    const sLat1=toRad(a[0]), sLat2=toRad(b[0]);
    const h=Math.sin(dLat/2)**2 + Math.cos(sLat1)*Math.cos(sLat2)*Math.sin(dLng/2)**2;
    return 2*R*Math.asin(Math.sqrt(h));
  }

  // === ADDED HELPERS (needed by buildFootpathGraph & routing) ===
  function recomputeComponents(){
    const N = footpathGraph.nodes.length;
    const compIds = new Array(N).fill(-1);
    let comp = 0;
    for (let i=0;i<N;i++){
      if (compIds[i] !== -1) continue;
      const q=[i];
      compIds[i]=comp;
      while(q.length){
        const v=q.shift();
        for (const e of footpathGraph.adj.get(v) || []){
          if (compIds[e.to] === -1){
            compIds[e.to]=comp;
            q.push(e.to);
          }
        }
      }
      comp++;
    }
    footpathGraph.nodes.forEach(n => n.comp = compIds[n.id]);
    return { count: comp, compIds };
  }

  function secondPassBridge(){
    const thresh = BRIDGE_SECOND_PASS_MAX;
    let added = 0;
    // endpoints: degree <=1 (after first pass)
    const deg = footpathGraph.nodes.map(n => footpathGraph.adj.get(n.id).length);
    const endpoints = footpathGraph.nodes.filter(n => deg[n.id] <= 1);
    for (let i=0;i<endpoints.length;i++){
      const A = endpoints[i];
      for (let j=i+1;j<endpoints.length;j++){
        const B = endpoints[j];
        if (A.comp === B.comp) continue;
        const d = haversineMeters([A.lat,A.lng],[B.lat,B.lng]);
        if (d <= thresh){
          if (!footpathGraph.adj.get(A.id).some(e=>e.to===B.id)){
            footpathGraph.adj.get(A.id).push({ to:B.id, w:d, bridge:true, second:true });
            footpathGraph.adj.get(B.id).push({ to:A.id, w:d, bridge:true, second:true });
            added++;
          }
        }
      }
    }
    return added;
  }
// === END ADDED HELPERS ===

  // Build footpath graph from GeoJSON LineStrings
  function buildFootpathGraph(gj){
    footpathGraph = { nodes: [], adj: new Map() };
    bridgingExpanded = false;

    if (!gj || !Array.isArray(gj.features)){
      dbg('No features in footpaths');
      return;
    }

    const key=(lat,lng)=>lat.toFixed(6)+','+lng.toFixed(6);
    const idx = new Map();

    function addNode(lat,lng){
      const k=key(lat,lng);
      if (idx.has(k)) return idx.get(k);
      const id=footpathGraph.nodes.length;
      footpathGraph.nodes.push({id,lat,lng});
      footpathGraph.adj.set(id,[]);
      idx.set(k,id);
      return id;
    }
    function addEdge(a,b,w,bridge=false,second=false){
      if (a===b) return;
      if (!footpathGraph.adj.get(a).some(e=>e.to===b))
        footpathGraph.adj.get(a).push({to:b,w,bridge,second});
      if (!footpathGraph.adj.get(b).some(e=>e.to===a))
        footpathGraph.adj.get(b).push({to:a,w,bridge,second});
    }

    let rawSegments=0;
    gj.features.forEach(f=>{
      if (!f || !f.geometry) return;
      if (f.geometry.type === 'LineString'){
        const coords = f.geometry.coordinates || [];
        let prev=null;
        coords.forEach(c=>{
          if (!Array.isArray(c)||c.length<2) return;
          const lng=c[0], lat=c[1];
          if (!Number.isFinite(lat)||!Number.isFinite(lng)) return;
          const id=addNode(lat,lng);
          if (prev!=null && prev!==id){
            const a=footpathGraph.nodes[prev];
            const b=footpathGraph.nodes[id];
            const d=haversineMeters([a.lat,a.lng],[b.lat,b.lng]);
            addEdge(prev,id,d,false,false);
            rawSegments++;
          }
          prev=id;
        });
      }
    });

    const compInfo1 = recomputeComponents();
    dbg('Graph raw: nodes', footpathGraph.nodes.length,
        'segments', rawSegments,
        'components', compInfo1.count);

    const bridges1 = bridgeCloseEndpoints(BRIDGE_MAX_METERS);
    const compInfoAfter1 = recomputeComponents();
    dbg('Bridging pass1: added', bridges1, 'bridges; components', compInfo1.count,'->', compInfoAfter1.count);

    // Visual debug of nodes + first pass bridges (optional)
    if (DEBUG_ROUTING && SHOW_FOOTPATH_NODES){
      footpathGraph.nodes.forEach(n=>{
        const circ=L.circleMarker([n.lat,n.lng],{
          radius:3,color:'#268bd2',weight:1,fillColor:'#fff',fillOpacity:0.9
        }).addTo(map);
        debugLayers.push(circ);
      });
      footpathGraph.adj.forEach((arr,a)=>{
        arr.forEach(e=>{
          if (e.bridge && a < e.to){
            const A=footpathGraph.nodes[a], B=footpathGraph.nodes[e.to];
            L.polyline([[A.lat,A.lng],[B.lat,B.lng]],{
              color: e.second ? '#ff00d4' : '#00e5ff',
              weight:3,opacity:0.9,
              dashArray:'4,4'
            }).addTo(map);
          }
        });
      });
    }

    // Helpers inside build
    function bridgeCloseEndpoints(thresh){
      // Collect endpoints (deg 0 or 1)
      const endpoints=[];
      footpathGraph.nodes.forEach(n=>{
        const deg=footpathGraph.adj.get(n.id).length;
        if (deg <= 1) endpoints.push(n);
      });
      let added=0;
      for (let i=0;i<endpoints.length;i++){
        const A=endpoints[i];
        for (let j=i+1;j<endpoints.length;j++){
          const B=endpoints[j];
          if (A.comp !== undefined && B.comp !== undefined && A.comp===B.comp) continue;
          const d=haversineMeters([A.lat,A.lng],[B.lat,B.lng]);
          if (d <= thresh){
            addEdge(A.id,B.id,d,true,false);
            added++;
          }
        }
      }
      return added;
    }
  }

  // Attach popup route button listener (after map exists)
  function attachRouteButtonHandler(){
    if (!map) return;
    map.on('popupopen', e=>{
      const el = e.popup.getElement();
      if (!el) return;
      const btn = el.querySelector('.route-btn');
      if (!btn) return;
      btn.onclick = ()=>{
        const name = btn.getAttribute('data-name');
        const mem = memorials.find(m=>m.name === name);
        if (mem) planRouteTo(mem);
      };
    });
  }

  // Call load() to start everything (already present above)
  load();
  setTimeout(attachRouteButtonHandler, 500);
  if (btnReset) btnReset.addEventListener('click', resetView);

  // Remove the duplicated debug helpers that were here.
  // Complete ensureConnectedHeuristic (was previously truncated)
  function ensureConnectedHeuristic(startId, targetId, nodes, adj, hopEdges){
    function compIds(){
      const N = nodes.length;
      const comp = new Array(N).fill(-1);
      let c=0;
      for (let i=0;i<N;i++){
        if (comp[i]!==-1) continue;
        const q=[i]; comp[i]=c;
        while(q.length){
          const v=q.shift();
          for (const e of (adj.get(v)||[])){
            if (comp[e.to]===-1){
              comp[e.to]=c;
              q.push(e.to);
            }
          }
        }
        c++;
      }
      return comp;
    }
    function degree(id){ return (adj.get(id)||[]).length; }
    const distToTarget = id =>
      haversineMeters([nodes[id].lat,nodes[id].lng],[nodes[targetId].lat,nodes[targetId].lng]);

    let hops=0;
    for (let iter=0; iter < HOP_MAX_ITER; iter++){
      const comps = compIds();
      if (comps[startId] === comps[targetId]) break;

      const startComp = comps[startId];
      const frontier=[];
      for (let i=0;i<nodes.length;i++){
        if (comps[i]===startComp && degree(i)<=3) frontier.push(i);
      }
      if (!frontier.length){
        for (let i=0;i<nodes.length;i++){
          if (comps[i]===startComp) frontier.push(i);
        }
      }

      let bestPair=null;
      let bestScore=Infinity;

      for (const a of frontier){
        const aPos=[nodes[a].lat,nodes[a].lng];
        const aTarget = distToTarget(a);
        for (let b=0;b<nodes.length;b++){
          if (comps[b]===startComp) continue;
          const d = haversineMeters(aPos,[nodes[b].lat,nodes[b].lng]);
          if (d > HOP_MAX_METERS) continue;
          const bTarget = distToTarget(b);
          const score = d + 0.2 * bTarget; // slight bias toward components nearer target
          if (score < bestScore) {
            bestScore = score;
            bestPair = { a, b, d };
          }
        }
      }

      if (!bestPair) {
        dbg('Heuristic: no further candidate hop found');
        break;
      }

      // Add hop (penalised weight so real paths still preferred)
      adj.get(bestPair.a).push({ to: bestPair.b, w: bestPair.d * HOP_PENALTY, hop:true });
      adj.get(bestPair.b).push({ to: bestPair.a, w: bestPair.d * HOP_PENALTY, hop:true });
      hopEdges.push(bestPair);
      hops++;
      dbg('Heuristic hop', hops, 'added', bestPair.a, '<->', bestPair.b,
          'd=', bestPair.d.toFixed(1),'m (weighted', (bestPair.d*HOP_PENALTY).toFixed(1),')');
    }
    return hops;
  }
// === end ensureConnectedHeuristic ===

})(); // close IIFE
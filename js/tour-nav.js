(function(){
  const debug = location.search.includes('debug=');
  function d(tag,obj){ console.log('[Nav]',tag,obj||''); if(debug && dbgEl) dbgEl.textContent += tag+' '+JSON.stringify(obj||{})+'\n'; }
  const dbgEl = document.createElement('pre');
  if (debug){
    dbgEl.style.cssText='position:fixed;bottom:0;left:0;right:0;max-height:160px;overflow:auto;background:#111;color:#0f0;margin:0;font:11px/1.2 monospace;z-index:9999;padding:4px;';
    document.body.appendChild(dbgEl);
  }

  const raw = sessionStorage.getItem('plannedTour');
  if(!raw){ alert('No tour'); return; }
  let tour;
  try { tour=JSON.parse(raw); } catch(e){ alert('Bad tour JSON'); return; }
  d('tourLoaded',{stops:tour.order?.length});

  const instrEl = document.getElementById('nav-instr') || createFallback();
  const subEl = document.getElementById('nav-sub') || instrEl;
  const nextDistEl = document.getElementById('nav-next-dist');
  const remainDistEl = document.getElementById('nav-remain-dist');
  const offRouteEl = document.getElementById('nav-offroute');

  let fp=null;
  let legPoints=[];
  let routePolyline=null;
  let userMarker=null;

  const map = L.map('nav-map');
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);

  // Load graph
  footpathGraph.buildFootpathGraph('../data/footpaths.geojson')
    .then(g=>{
      fp=g; d('graphReady',{nodes:g.nodes.length,segs:g.segs.length});
      buildRoute();
      startGPS();
    })
    .catch(e=>{
      d('graphFail',e.message);
      buildStraightFallback();
      startGPS();
    });

  function buildRoute(){
    legPoints=[];
    for(let i=0;i<tour.order.length-1;i++){
      const a = tour.nodes[tour.order[i]];
      const b = tour.nodes[tour.order[i+1]];
      if(!a || !b){ d('missingNode',{i}); continue; }
      const sa=fp.snapPoint(a.lat,a.lng);
      const sb=fp.snapPoint(b.lat,b.lng);
      const sp=fp.shortestPath(sa.seg.a, sb.seg.a);
      if(sp && sp.path){
        if(!legPoints.length) legPoints.push([a.lat,a.lng]);
        for(let k=1;k<sp.path.length-1;k++){
          const n=fp.nodes[sp.path[k]];
            legPoints.push([n.lat,n.lng]);
        }
        legPoints.push([b.lat,b.lng]);
      } else {
        legPoints.push([a.lat,a.lng],[b.lat,b.lng]);
      }
    }
    drawRoute('graph');
  }

  function buildStraightFallback(){
    legPoints = tour.order.map(idx=>{
      const n = tour.nodes[idx];
      return [n.lat,n.lng];
    });
    drawRoute('straight');
  }

  function drawRoute(mode){
    if(routePolyline) routePolyline.remove();
    routePolyline = L.polyline(legPoints,{color: mode==='graph' ? '#f06':'#888', weight:5}).addTo(map);
    map.fitBounds(routePolyline.getBounds().pad(0.15));
    instrEl.textContent='Route ready ('+mode+')';
  }

  function startGPS(){
    if(!navigator.geolocation){ d('noGeo'); instrEl.textContent='Geolocation unsupported'; return; }
    navigator.geolocation.watchPosition(p=>{
      const lat=p.coords.latitude, lng=p.coords.longitude;
      if(!userMarker){
        userMarker = L.circleMarker([lat,lng],{radius:7,color:'#06f',fillColor:'#6af',fillOpacity:0.7,weight:2}).addTo(map);
      } else userMarker.setLatLng([lat,lng]);
      updateNav(lat,lng);
    }, err=>{
      d('geoError',err.code);
      subEl.textContent='Geo error '+err.code;
    }, { enableHighAccuracy:true, timeout:8000, maximumAge:2000 });
    d('geoStarted');
  }

  function updateNav(lat,lng){
    if(!legPoints.length) return;
    const snap = nearestOnRoute(lat,lng);
    d('pos',{lat:+lat.toFixed(5),lng:+lng.toFixed(5),distToRoute:+snap.d.toFixed(1)});
    if (snap.d > 30){
      if(offRouteEl) offRouteEl.hidden=false;
    } else if (offRouteEl) offRouteEl.hidden=true;
    instrEl.textContent='On route';
    nextDistEl && (nextDistEl.textContent = fmt(snap.d));
    remainDistEl && (remainDistEl.textContent = fmt(distanceRemaining(snap)));
  }

  function nearestOnRoute(lat,lng){
    let best={d:Infinity,idx:0,t:0,lat:legPoints[0][0],lng:legPoints[0][1]};
    for(let i=0;i<legPoints.length-1;i++){
      const a=legPoints[i], b=legPoints[i+1];
      const cand = project(a,b,lat,lng);
      if(cand.d < best.d) best={...cand,idx:i};
    }
    return best;
  }

  function project(a,b,lat,lng){
    // a,b = [lat,lng]
    const ax=a[1], ay=a[0], bx=b[1], by=b[0], px=lng, py=lat;
    const vx=bx-ax, vy=by-ay;
    const wx=px-ax, wy=py-ay;
    const vv=vx*vx+vy*vy;
    let t= vv===0?0:(vx*wx+vy*wy)/vv;
    if(t<0)t=0; else if(t>1)t=1;
    const projLng = ax + vx*t, projLat = ay + vy*t;
    const d = hav(lat,lng, projLat, projLng);
    return { t, lat:projLat, lng:projLng, d };
  }

  function distanceRemaining(snap){
    let dist = (1 - snap.t) * segLen(snap.idx);
    for(let i=snap.idx+1;i<legPoints.length-1;i++){
      dist += segLen(i);
    }
    return dist;
  }

  function segLen(i){
    return hav(legPoints[i][0],legPoints[i][1], legPoints[i+1][0],legPoints[i+1][1]);
  }

  function hav(aLat,aLng,bLat,bLng){
    const R=6371000, toRad=x=>x*Math.PI/180;
    const dLat=toRad(bLat-aLat), dLng=toRad(bLng-aLng);
    const sa=Math.sin(dLat/2), sb=Math.sin(dLng/2);
    const h=sa*sa+Math.cos(toRad(aLat))*Math.cos(toRad(bLat))*sb*sb;
    return 2*R*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));
  }

  function fmt(m){ return m<900? m.toFixed(0)+' m' : (m/1000).toFixed(2)+' km'; }

  function createFallback(){
    const el=document.createElement('div');
    document.body.appendChild(el);
    return el;
  }

  window.addEventListener('error', e=>d('windowError', e.message));
  window.addEventListener('unhandledrejection', e=>d('unhandledRej', e.reason && e.reason.message || String(e.reason)));
})();
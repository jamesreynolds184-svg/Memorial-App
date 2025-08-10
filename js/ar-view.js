(() => {
  const statusEl = document.getElementById('status');
  const headingEl = document.getElementById('heading');
  const video = document.getElementById('camera');
  const markersLayer = document.getElementById('markers');
  const dbgPos = document.getElementById('dbg-pos');
  const dbgAcc = document.getElementById('dbg-acc');
  const dbgHead = document.getElementById('dbg-head');
  const dbgMem = document.getElementById('dbg-mem');

  const qs = new URLSearchParams(location.search);
  const useTest = qs.has('test');
  const genRing = qs.has('ring');
  const noFade = qs.has('nofade');
  const dataPath = useTest ? '../data/test-memorials.json' : '../data/memorials.json';

  // Config
  const H_FOV_DEG = 120;
  const HALF_FOV = H_FOV_DEG / 2;
  const HIDE_DISTANCE = noFade ? Infinity : 5000;
  const FAR_CLASS_DISTANCE = 150;
  const MIN_SCALE = 0.35;

  let userLat = null, userLng = null, userHeading = 0;
  let memorials = [];
  let ringAdded = false;

  function log(msg) { if (statusEl) statusEl.textContent = msg; }

  function updateDebug() {
    if (dbgPos && userLat != null) dbgPos.textContent = `Lat: ${userLat.toFixed(6)} Lng: ${userLng.toFixed(6)}`;
    if (dbgHead) dbgHead.textContent = `Head: ${Math.round(userHeading)}°`;
    if (dbgMem) dbgMem.textContent = `Mem: ${memorials.length}`;
  }

  function loadMemorials() {
    return fetch(dataPath)
      .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(data => {
        memorials = (data || []).filter(m => m?.location && Number.isFinite(m.location.lat) && Number.isFinite(m.location.lng));
        log(`Loaded ${memorials.length} ${useTest ? 'test ' : ''}memorials`);
        updateDebug();
      })
      .catch(e => { log('Data error'); console.error(e); });
  }

  function addDynamicRing(lat, lng) {
    const R = 6378137;
    const added = [];
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const dist = 30 + (i % 4) * 30; // 30,60,90,120
      const dLat = (dist * Math.cos(angle)) / R;
      const dLng = (dist * Math.sin(angle)) / (R * Math.cos(lat * Math.PI / 180));
      added.push({
        name: `Ring ${dist}m`,
        zone: 'R',
        location: { lat: lat + dLat * 180 / Math.PI, lng: lng + dLng * 180 / Math.PI }
      });
    }
    memorials = added.concat(memorials);
    updateDebug();
  }

  function startCamera() {
    if (!navigator.mediaDevices) { log('No camera API'); return; }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then(s => { video.srcObject = s; })
      .catch(() => log('Camera denied'));
  }

  function getLocation() {
    if (!navigator.geolocation) { log('No geolocation'); return; }
    navigator.geolocation.watchPosition(p => {
      userLat = p.coords.latitude;
      userLng = p.coords.longitude;
      if (dbgAcc) dbgAcc.textContent = `Acc: ${Math.round(p.coords.accuracy)}m`;
      if (genRing && !ringAdded) {
        addDynamicRing(userLat, userLng);
        ringAdded = true;
      }
      updateDebug();
    }, e => {
      log('Geo err');
      if (dbgAcc) dbgAcc.textContent = 'Acc: err';
    }, { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 });
  }

  function startHeading() {
    if (typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function') {
      document.body.addEventListener('click', function req() {
        DeviceOrientationEvent.requestPermission()
          .then(res => { if (res === 'granted') addOrientationListeners(); else log('Heading denied'); })
          .catch(() => log('Heading err'));
        document.body.removeEventListener('click', req);
      }, { once: true });
      log('Tap to enable heading');
    } else {
      addOrientationListeners();
    }
  }
  function addOrientationListeners() {
    window.addEventListener('deviceorientationabsolute', onOrient, true);
    window.addEventListener('deviceorientation', onOrient, true);
  }
  function onOrient(e) {
    if (e.alpha == null) return;
    userHeading = e.alpha;
    if (headingEl) headingEl.textContent = Math.round(userHeading) + '°';
    updateDebug();
  }

  function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371000, toRad = d => d * Math.PI / 180;
    const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  }
  function bearing(lat1, lon1, lat2, lon2) {
    const toRad=d=>d*Math.PI/180, toDeg=r=>r*180/Math.PI;
    const dLon = toRad(lon2 - lon1);
    const y = Math.sin(dLon) * Math.cos(toRad(lat2));
    const x = Math.cos(toRad(lat1))*Math.sin(toRad(lat2)) -
              Math.sin(toRad(lat1))*Math.cos(toRad(lat2))*Math.cos(dLon);
    return (toDeg(Math.atan2(y, x)) + 360) % 360;
  }

  function ensureMarker(m) {
    if (m._el) return m._el;
    const div = document.createElement('div');
    div.className = 'mem-marker';
    const img = document.createElement('img');
    img.alt = m.name;
    if (m.zone && m.zone !== 'R') {
      const zone = String(m.zone).replace(/[^0-9]/g,'');
      if (zone) img.src = `../img/zone${zone}/${encodeURIComponent(m.name)}.jpg`;
    }
    const title = document.createElement('span');
    title.textContent = m.name;
    const dist = document.createElement('em');
    dist.style.cssText = 'margin-top:2px;font-style:normal;font-size:10px;background:rgba(0,0,0,.4);color:#fff;padding:1px 5px;border-radius:10px;';
    div.append(img, title, dist);
    m._distEl = dist;
    markersLayer.appendChild(div);
    m._el = div;
    return div;
  }

  function render() {
    if (userLat != null && userLng != null && memorials.length) {
      let visible = 0;
      memorials.forEach(m => {
        const d = haversine(userLat, userLng, m.location.lat, m.location.lng);
        const b = bearing(userLat, userLng, m.location.lat, m.location.lng);
        const rel = ((b - userHeading + 540) % 360) - 180; // -180..180
        const el = ensureMarker(m);
        if (Math.abs(rel) <= HALF_FOV) {
          const w = innerWidth;
          const x = (rel / HALF_FOV) * (w/2) + w/2;
          const clampedX = Math.min(w - 40, Math.max(40, x));
            // Vertical displacement
          const yBase = innerHeight * 0.5;
          const y = yBase + Math.min(300, d * 0.1);
          el.style.left = clampedX + 'px';
          el.style.top = y + 'px';
          const scale = Math.max(MIN_SCALE, 1 - d/800);
          el.style.transform = `translate(-50%,-50%) scale(${scale})`;
          el.style.opacity = d > HIDE_DISTANCE ? 0 : 1;
          el.classList.toggle('far', d > FAR_CLASS_DISTANCE);
          if (m._distEl) m._distEl.textContent = d < 1000 ? `${Math.round(d)}m` : (d/1000).toFixed(2)+'km';
          visible++;
        } else {
          el.style.opacity = 0;
        }
      });
      log(visible ? `${visible} marker${visible!==1?'s':''}` : 'Turn to find markers');
    }
    requestAnimationFrame(render);
  }

  async function init() {
    log('Loading…');
    await loadMemorials();
    startCamera();
    getLocation();
    startHeading();
    render();
  }

  init();
})();
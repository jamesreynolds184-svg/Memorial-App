(() => {
  const statusEl = document.getElementById('status');
  const headingEl = document.getElementById('heading');
  const video = document.getElementById('camera');
  const markersLayer = document.getElementById('markers');
  const dbgPos = document.getElementById('dbg-pos');
  const dbgAcc = document.getElementById('dbg-acc');
  const dbgHead = document.getElementById('dbg-head');
  const dbgMem = document.getElementById('dbg-mem');
  const dbgList = document.getElementById('dbg-list');
  const dbgToggle = document.getElementById('dbg-toggle');

  const qs = new URLSearchParams(location.search);
  const useTest = qs.has('test');
  const genRing = qs.has('ring');
  const noFade = qs.has('nofade');
  const dbgMode = qs.has('dbg');              // <-- ADD
  const localize = qs.has('local');           // <-- OPTIONAL: shift test markers near user
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
  let firstFix = true;
  const PRIVACY_KEY = 'nma:arPrivacyAck';
  let privacyMarker = null;
  let headingReady = false;
  let localized = false; // ensure we only shift once

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
        if (!memorials.length && dbgMode) console.warn('[AR] No memorials loaded; will generate debug markers after GPS fix.');
      })
      .catch(e => { log('Data error'); console.error(e); });
  }

  function addDynamicRing(lat, lng) {
    const R = 6378137;
    const added = [];
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const dist = 30 + (i % 4) * 30;
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

  // Shift test markers to be around the user (keep their relative offsets)
  function localizeTestMarkers() {
    if (!useTest || !localize || localized || userLat == null) return;
    if (!memorials.length) return;
    const baseLat = memorials[0].location.lat;
    const baseLng = memorials[0].location.lng;
    const dLat = userLat - baseLat;
    const dLng = userLng - baseLng;
    memorials.forEach(m => {
      m.location.lat += dLat;
      m.location.lng += dLng;
    });
    localized = true;
    console.log('[AR] Test markers localized around user.');
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
      if (useTest && localize) localizeTestMarkers();
      updateDebug();
      if (firstFix) {
        if (dbgMode) addDebugMarkersNear(userLat, userLng);
        firstFix = false;
      }
      if (!localStorage.getItem(PRIVACY_KEY)) ensurePrivacyMarker();
    }, () => {
      log('Geo err');
      if (dbgAcc) dbgAcc.textContent = 'Acc: err';
    }, { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 });
  }

  function startHeading() {
    if (typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function') {
      document.body.addEventListener('click', function req() {
        DeviceOrientationEvent.requestPermission()
          .then(res => { if (res === 'granted') addOrientationListeners(); });
        document.body.removeEventListener('click', req);
      }, { once: true });
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
    headingReady = true;
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

  function addDebugMarkersNear(lat, lng) {
    if (!dbgMode) return;
    const R = 6378137;
    function offset(distMeters, bearingDeg) {
      const br = bearingDeg * Math.PI/180;
      const dLat = (distMeters * Math.cos(br)) / R;
      const dLng = (distMeters * Math.sin(br)) / (R * Math.cos(lat * Math.PI/180));
      return { lat: lat + dLat * 180/Math.PI, lng: lng + dLng * 180/Math.PI };
    }
    const added = [
      { name: 'DEBUG 10m', zone: 'D', location: offset(10, 30) },
      { name: 'DEBUG 30m', zone: 'D', location: offset(30, 120) },
      { name: 'DEBUG 60m', zone: 'D', location: offset(60, 250) }
    ];
    memorials = added.concat(memorials);
    console.log('[AR] Injected debug markers', added);
    updateDebug();
  }

  function ensureMarker(m) {
    if (m._el) return m._el;
    const div = document.createElement('div');
    div.className = 'mem-marker';
    div.style.cssText = 'position:absolute;transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;font-family:system-ui,sans-serif;';
    const img = document.createElement('img');
    img.alt = m.name;
    img.style.cssText = 'width:60px;height:60px;object-fit:cover;border-radius:8px;box-shadow:0 4px 10px rgba(0,0,0,.5);background:#222;';
    if (m.zone && !['R','D','INFO'].includes(m.zone)) {
      const zone = String(m.zone).replace(/[^0-9]/g,'');
      if (zone) img.src = `../img/zone${zone}/${encodeURIComponent(m.name)}.jpg`;
    }
    const title = document.createElement('span');
    title.textContent = m.name;
    title.style.cssText = 'margin-top:4px;background:rgba(0,0,0,.55);color:#fff;padding:2px 6px;border-radius:12px;font-size:11px;max-width:120px;text-align:center;';
    const dist = document.createElement('em');
    dist.style.cssText = 'margin-top:2px;font-style:normal;font-size:10px;background:rgba(0,0,0,.4);color:#fff;padding:1px 5px;border-radius:10px;';
    div.append(img, title, dist);
    m._distEl = dist;
    markersLayer.appendChild(div);
    m._el = div;

    if (m._isPrivacy) {
      title.textContent = 'Navigation Notice';
      const msg = document.createElement('small');
      msg.textContent = 'Use this tool to navigate the Arboretum. No video data is logged or recorded.';
      msg.style.cssText = 'margin-top:4px;max-width:180px;text-align:center;background:rgba(0,0,0,.65);color:#fff;padding:6px 8px;border-radius:10px;font-size:11px;line-height:1.25;';
      const close = document.createElement('button');
      close.type = 'button';
      close.textContent = 'Got it';
      close.style.cssText = 'margin-top:6px;background:#2d7d2d;color:#fff;border:none;padding:4px 10px;font-size:11px;border-radius:14px;cursor:pointer;';
      close.onclick = ev => {
        ev.stopPropagation();
        localStorage.setItem(PRIVACY_KEY,'1');
        m._el.style.transition='opacity .4s';
        m._el.style.opacity='0';
        setTimeout(()=>{
          if (m._el?.parentNode) m._el.parentNode.removeChild(m._el);
          memorials = memorials.filter(x=>x!==m);
        },420);
      };
      dist.style.display='none';
      div.append(msg, close);
    }
    return div;
  }

  function ensurePrivacyMarker() {
    if (localStorage.getItem(PRIVACY_KEY)) return;
    if (!privacyMarker) {
      privacyMarker = {
        name: 'Info',
        zone: 'INFO',
        _isPrivacy: true,
        location: { lat: userLat, lng: userLng }
      };
      memorials.unshift(privacyMarker);
    }
  }
  function updatePrivacyMarkerPosition() {
    if (!privacyMarker || userLat == null) return;
    const dist = 15;
    const R = 6378137;
    const headRad = userHeading * Math.PI/180;
    const dLat = (dist * Math.cos(headRad)) / R;
    const dLng = (dist * Math.sin(headRad)) / (R * Math.cos(userLat * Math.PI/180));
    privacyMarker.location.lat = userLat + dLat * 180/Math.PI;
    privacyMarker.location.lng = userLng + dLng * 180/Math.PI;
  }

  function render() {
    if (userLat != null && userLng != null && memorials.length) {
      let visible = 0;
      let lines = [];
      if (privacyMarker) updatePrivacyMarkerPosition();
      memorials.forEach(m => {
        const d = haversine(userLat, userLng, m.location.lat, m.location.lng);
        const b = bearing(userLat, userLng, m.location.lat, m.location.lng);
        const rel = ((b - userHeading + 540) % 360) - 180;
        const el = ensureMarker(m);
        if (Math.abs(rel) <= HALF_FOV) {
          const w = innerWidth;
          const x = (rel / HALF_FOV) * (w/2) + w/2;
          const clampedX = Math.min(w - 40, Math.max(40, x));
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
        if (dbgMode) lines.push(`${m.name.padEnd(12)} d=${d.toFixed(1)}m b=${b.toFixed(1)} rel=${rel.toFixed(1)}`);
      });
      log(visible ? `${visible} marker${visible!==1?'s':''}` : 'Turn to find markers');
      if (dbgMode && dbgList) dbgList.textContent = lines.join('\n');
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

  if (dbgToggle && dbgList) {
    dbgToggle.addEventListener('click', () => {
      dbgList.style.display = dbgList.style.display === 'none' ? 'block' : 'none';
    });
  }

  // Always show a debug marker 10m in front of user for AR testing
  if (!window._arDebugMarker) {
    window._arDebugMarker = {
      name: 'AR TEST',
      zone: 'DEBUG',
      location: { lat: userLat, lng: userLng }
    };
    memorials.unshift(window._arDebugMarker);
  }
  if (userLat && userLng && window._arDebugMarker) {
    // Place 10m ahead of user heading
    const dist = 10;
    const R = 6378137;
    const headRad = userHeading * Math.PI/180;
    const dLat = (dist * Math.cos(headRad)) / R;
    const dLng = (dist * Math.sin(headRad)) / (R * Math.cos(userLat * Math.PI/180));
    window._arDebugMarker.location.lat = userLat + dLat * 180/Math.PI;
    window._arDebugMarker.location.lng = userLng + dLng * 180/Math.PI;
  }

  init();
})();
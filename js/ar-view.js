(() => {
  const statusEl = document.getElementById('status');
  const headingEl = document.getElementById('heading');
  const video = document.getElementById('camera');
  const markersLayer = document.getElementById('markers');
  const dataPath = '../data/memorials.json';

  let userLat = null, userLng = null, userHeading = 0;
  let memorials = [];

  function log(msg){ if(statusEl) statusEl.textContent = msg; }

  function loadMemorials() {
    return fetch(dataPath)
      .then(r=>{ if(!r.ok) throw new Error(r.status); return r.json(); })
      .then(data => {
        memorials = (data||[]).filter(m =>
          m && m.name && m.location &&
          Number.isFinite(m.location.lat) &&
          Number.isFinite(m.location.lng)
        );
      }).catch(e => log('Data error'));
  }

  function startCamera() {
    if (!navigator.mediaDevices) { log('No camera API'); return; }
    navigator.mediaDevices.getUserMedia({ video:{ facingMode:'environment' }, audio:false })
      .then(stream => { video.srcObject = stream; })
      .catch(()=> log('Camera denied'));
  }

  function getLocation() {
    if (!navigator.geolocation) { log('No geolocation'); return; }
    navigator.geolocation.watchPosition(p => {
      userLat = p.coords.latitude;
      userLng = p.coords.longitude;
    }, err => log('Geo err ' + err.code), { enableHighAccuracy:true, maximumAge:5000, timeout:10000 });
  }

  function startHeading() {
    // iOS requires a user gesture to request permission
    if (typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function') {
      document.body.addEventListener('click', function req() {
        DeviceOrientationEvent.requestPermission()
          .then(res => {
            if (res === 'granted') addOrientationListeners();
            else log('Heading denied');
          }).catch(()=>log('Heading err'));
        document.body.removeEventListener('click', req);
      }, { once:true });
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
    let h = e.alpha;
    if (h == null) return;
    userHeading = h;
    if (headingEl) headingEl.textContent = Math.round(h) + '°';
  }

  function haversine(lat1, lon1, lat2, lon2) {
    const R=6371000, toRad=d=>d*Math.PI/180;
    const dLat=toRad(lat2-lat1), dLon=toRad(lon2-lon1);
    const a=Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
    return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
  }
  function bearing(lat1, lon1, lat2, lon2) {
    const toRad=d=>d*Math.PI/180, toDeg=r=>r*180/Math.PI;
    const dLon = toRad(lon2-lon1);
    const y = Math.sin(dLon)*Math.cos(toRad(lat2));
    const x = Math.cos(toRad(lat1))*Math.sin(toRad(lat2)) -
              Math.sin(toRad(lat1))*Math.cos(toRad(lat2))*Math.cos(dLon);
    return (toDeg(Math.atan2(y,x)) + 360) % 360;
  }

  function ensureMarker(m) {
    if (m._el) return m._el;
    const div = document.createElement('div');
    div.className = 'mem-marker';
    const img = document.createElement('img');
    img.alt = m.name;
    const span = document.createElement('span');
    span.textContent = m.name;
    // Basic guess for image path (optional)
    if (m.zone) {
      const zone = String(m.zone).replace(/[^0-9]/g,'');
      const stem = encodeURIComponent(m.name);
      img.src = `../img/zone${zone}/${stem}.jpg`;
    }
    div.appendChild(img);
    div.appendChild(span);
    markersLayer.appendChild(div);
    m._el = div;
    return div;
  }

  function render() {
    if (userLat != null && userLng != null && memorials.length) {
      memorials.forEach(m => {
        const d = haversine(userLat, userLng, m.location.lat, m.location.lng);
        const b = bearing(userLat, userLng, m.location.lat, m.location.lng);
        const rel = ((b - userHeading + 540) % 360) - 180; // -180..180
        const el = ensureMarker(m);
        const w = innerWidth;
        // Map +/-60° to screen width
        const x = (rel / 60) * (w/2) + w/2;
        const clampedX = Math.min(w - 40, Math.max(40, x));
        const yBase = innerHeight * 0.45;
        const y = yBase + Math.min(260, d * 0.08);
        el.style.left = clampedX + 'px';
        el.style.top = y + 'px';
        const scale = Math.max(.35, 1 - d/500);
        el.style.transform = `translate(-50%,-50%) scale(${scale})`;
        el.style.opacity = d > 400 ? 0 : 1;
        el.classList.toggle('far', d > 80);
      });
    }
    requestAnimationFrame(render);
  }

  async function init() {
    log('Loading data…');
    await loadMemorials();
    startCamera();
    getLocation();
    startHeading();
    log('Point device to view markers (tap to allow sensors)');
    render();
  }

  init();
})();
(() => {
  // Expected elements in ar-view.html
  const video     = document.getElementById('cam');
  const anchorEl  = document.getElementById('anchor');
  const backBtn   = document.getElementById('back');
  const relockBtn = document.getElementById('relock');
  const hintEl    = document.getElementById('hint');
  const dbgBtn    = document.getElementById('toggleDebug');
  const dbgBox    = document.getElementById('debug');

  // Optional custom text via ?text=
  const qs = new URLSearchParams(location.search);
  const customText = qs.get('text');
  if (customText && anchorEl) anchorEl.textContent = customText;

  // Back
  if (backBtn) {
    backBtn.onclick = () => {
      if (history.length > 1) history.back(); else location.href = '../home.html';
    };
  }

  // Camera
  if (navigator.mediaDevices?.getUserMedia) {
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then(stream => { if (video) video.srcObject = stream; })
      .catch(() => setHint('Camera denied'));
  } else {
    setHint('No camera API');
  }

  function setHint(t){ if (hintEl) hintEl.textContent = t; }

  // CONFIG
  const HALF_FOV   = 35;  // degrees to map fully across screen (wider = slower movement)
  const DEAD_ZONE  = 2;   // degrees: keep perfectly centered (prevents drift)
  const SMOOTH     = 0.25;// 0..1 smoothing for heading
  const HIDE_MARGIN= 3;   // extra margin before hide (if you later choose to hide)

  let anchorHeading = null;   // fixed world heading for anchor
  let smoothHeading = null;   // smoothed current heading
  let motionRequested = false;

  // Permission (iOS)
  document.body.addEventListener('click', () => {
    if (motionRequested) return;
    motionRequested = true;
    if (window.DeviceOrientationEvent?.requestPermission){
      DeviceOrientationEvent.requestPermission()
        .then(r => r==='granted' ? startOrientation() : setHint('Motion denied'))
        .catch(()=> setHint('Motion error'));
    } else startOrientation();
  }, { once:true });

  function startOrientation(){
    window.addEventListener('deviceorientation', onOrient, true);
    setHint('Tap relock to re-center');
  }

  function norm(h){ return (h + 360) % 360; }

  function shortestDiff(a,b){
    let d = (b - a + 540) % 360 - 180;
    return d;
  }

  function onOrient(e){
    let raw;
    if (typeof e.webkitCompassHeading === 'number') raw = e.webkitCompassHeading;
    else if (typeof e.alpha === 'number') raw = e.alpha;
    else return;
    raw = norm(raw);

    if (smoothHeading == null){
      smoothHeading = raw;
      anchorHeading = raw; // initial lock directly ahead
      if (!customText && anchorEl) anchorEl.textContent = 'Test Anchor';
      return;
    }

    // Smooth (handle wrap properly via shortest diff)
    const diff = shortestDiff(smoothHeading, raw);
    smoothHeading = norm(smoothHeading + diff * SMOOTH);
  }

  // Relock button
  if (relockBtn){
    relockBtn.onclick = () => {
      if (smoothHeading != null){
        anchorHeading = smoothHeading;
        if (anchorEl) anchorEl.textContent = (customText || 'Test Anchor');
      }
    };
  }

  // Debug toggle
  if (dbgBtn && dbgBox){
    dbgBtn.onclick = () => {
      dbgBox.style.display = dbgBox.style.display === 'block' ? 'none' : 'block';
    };
  }

  function update(){
    if (anchorHeading != null && smoothHeading != null && anchorEl){
      // Relative angle: user heading vs anchor
      const rel = shortestDiff(anchorHeading, smoothHeading); // left = negative, right = positive

      // Dead zone: keep perfectly centered & stop drift
      if (Math.abs(rel) <= DEAD_ZONE){
        anchorEl.style.left = '50%';
      } else {
        // Map rel to screen: -HALF_FOV => 0%, +HALF_FOV => 100%
        const clamped = Math.max(-HALF_FOV, Math.min(HALF_FOV, rel));
        const pct = (clamped / (HALF_FOV * 2)) + 0.5; // 0..1
        anchorEl.style.left = (pct * 100) + '%';
      }

      // Always visible (remove fade logic); comment out below if you want hide when far behind
      anchorEl.style.opacity = '1';

      anchorEl.style.top = '50%';
      anchorEl.style.transform = 'translate(-50%,-50%)'; // fixed size, no scaling

      if (dbgBox && dbgBox.style.display === 'block'){
        dbgBox.textContent =
          `Anchor: ${anchorHeading.toFixed(1)}°\n` +
          `Head:   ${smoothHeading.toFixed(1)}°\n` +
          `Rel:    ${rel.toFixed(2)}°\n` +
          `Centered: ${Math.abs(rel)<=DEAD_ZONE}`;
      }
    }
    requestAnimationFrame(update);
  }
  update();
})();
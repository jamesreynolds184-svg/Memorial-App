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

  // World-lock settings
  const HALF_FOV = 25;        // Narrow field => moves off screen sooner
  const HIDE_MARGIN = 2;      // Extra before hiding
  const SMOOTH_ALPHA = 0.15;  // 0..1 higher = faster but more jitter
  const MIN_DELTA = 0.3;      // Ignore micro jitter (< degrees)
  let headingSmoothed = null;
  let currentRawHeading = 0;
  let anchorHeading = null;

  let motionRequested = false;

  function setHint(msg){ if (hintEl) hintEl.textContent = msg; }

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
    setHint('Rotate to move, relock to reset');
  }

  function normalize(h){
    // Normalize to 0..360
    return (h + 360) % 360;
  }

  function onOrient(e){
    let h;
    if (typeof e.webkitCompassHeading === 'number'){
      h = e.webkitCompassHeading; // iOS true north
    } else if (typeof e.alpha === 'number'){
      h = e.alpha; // May be device coords
    } else return;

    h = normalize(h);

    if (headingSmoothed == null){
      headingSmoothed = h;
      currentRawHeading = h;
    } else {
      // Reject micro changes
      const delta = Math.abs(h - currentRawHeading);
      currentRawHeading = h;
      if (delta < MIN_DELTA) {
        h = headingSmoothed; // treat as noise
      }
      headingSmoothed = normalize(headingSmoothed + SMOOTH_ALPHA * angleShortestDiff(headingSmoothed, h));
    }

    if (anchorHeading == null){
      anchorHeading = headingSmoothed;
      if (!customText && anchorEl) anchorEl.textContent = 'Test Anchor';
    }
  }

  function angleShortestDiff(a, b){
    // Smallest signed diff a->b
    let d = (b - a + 540) % 360 - 180;
    return d;
  }

  // Relock button
  if (relockBtn){
    relockBtn.onclick = () => {
      if (headingSmoothed != null){
        anchorHeading = headingSmoothed;
        if (anchorEl) anchorEl.textContent = (customText || 'Test Anchor');
      }
    };
  }

  // Debug toggle
  if (dbgBtn && dbgBox){
    dbgBtn.onclick = () => dbgBox.style.display = dbgBox.style.display==='block' ? 'none' : 'block';
  }

  function update(){
    if (anchorHeading != null && headingSmoothed != null && anchorEl){
      const rel = angleShortestDiff(headingSmoothed, anchorHeading); // -180..180 (0 = looking directly at anchor)

      // Map rel angle horizontally (world-locked)
      const absRel = Math.abs(rel);
      if (absRel <= HALF_FOV + HIDE_MARGIN){
        // Position across screen: -HALF_FOV => left edge, +HALF_FOV => right edge
        const w = window.innerWidth;
        const x = ((rel / HALF_FOV) * 0.5 + 0.5) * w;
        anchorEl.style.left = x + 'px';
        anchorEl.style.opacity = '1';
      } else {
        anchorEl.style.opacity = '0';
      }

      // Keep strictly centered vertically (no scale / no vertical jitter)
      anchorEl.style.top = '50%';
      anchorEl.style.transform = 'translate(-50%,-50%)';

      if (dbgBox && dbgBox.style.display==='block'){
        dbgBox.textContent =
          `Raw:    ${currentRawHeading.toFixed(1)}°\n` +
          `Smooth: ${headingSmoothed.toFixed(1)}°\n` +
          `Anchor: ${anchorHeading.toFixed(1)}°\n` +
          `Rel:    ${rel.toFixed(2)}°\n` +
          `Vis:    ${Math.abs(rel)<=HALF_FOV}`;
      }
    }
    requestAnimationFrame(update);
  }
  update();
})();
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

  // Orientation state
  let currentHeading = 0;     // live (deg)
  let anchorHeading  = null;  // locked heading
  let motionRequested = false;

  const HALF_FOV = 80;        // horizontal half field-of-view used for mapping
  const HIDE_MARGIN = 5;      // extra before hiding

  function setHint(msg){
    if (hintEl) hintEl.textContent = msg;
  }

  // iOS permission
  function requestOrientation(){
    if (motionRequested) return;
    motionRequested = true;
    if (window.DeviceOrientationEvent?.requestPermission) {
      DeviceOrientationEvent.requestPermission()
        .then(res => {
          if (res === 'granted') startOrientation();
          else setHint('Motion denied');
        })
        .catch(() => setHint('Motion error'));
    } else {
      startOrientation();
    }
  }
  document.body.addEventListener('click', requestOrientation, { once:true });

  function startOrientation(){
    window.addEventListener('deviceorientation', onOrientation, true);
    setHint('Rotate device to move anchor');
  }

  function onOrientation(e){
    // Prefer webkitCompassHeading (iOS true north)
    if (typeof e.webkitCompassHeading === 'number') {
      currentHeading = e.webkitCompassHeading;
    } else if (typeof e.alpha === 'number') {
      currentHeading = e.alpha;
    } else {
      return;
    }
    if (anchorHeading == null) {
      anchorHeading = currentHeading;
      if (!customText && anchorEl) anchorEl.textContent = 'Test Anchor (locked)';
    }
  }

  // Relock button
  if (relockBtn) {
    relockBtn.onclick = () => {
      if (anchorHeading != null) {
        anchorHeading = currentHeading;
        if (anchorEl) anchorEl.textContent = (customText || 'Test Anchor') + ' (re-locked)';
      }
    };
  }

  // Debug toggle
  if (dbgBtn && dbgBox) {
    dbgBtn.onclick = () => {
      dbgBox.style.display = (dbgBox.style.display === 'none' || !dbgBox.style.display) ? 'block' : 'none';
    };
  }

  function animate(){
    if (anchorHeading != null && anchorEl){
      // Relative angle -180..180 (positive = anchor to left or right depending mapping)
      const rel = ((anchorHeading - currentHeading + 540) % 360) - 180;

      // Visibility & horizontal position
      if (Math.abs(rel) <= (HALF_FOV + HIDE_MARGIN)) {
        const w = window.innerWidth;
        const x = (rel / HALF_FOV) * (w / 2) + w / 2;
        anchorEl.style.left = x + 'px';
        anchorEl.style.opacity = '1';
      } else {
        anchorEl.style.opacity = '0';
      }

      // Edge scaling
      const edgeFactor = Math.min(1, Math.abs(rel) / HALF_FOV);
      const scale = 1 - 0.25 * edgeFactor;
      anchorEl.style.transform = `translate(-50%,-50%) scale(${scale.toFixed(3)})`;

      // Debug
      if (dbgBox && dbgBox.style.display === 'block') {
        dbgBox.textContent =
          `Heading: ${currentHeading.toFixed(1)}°\n` +
          `Anchor : ${anchorHeading.toFixed(1)}°\n` +
          `Rel    : ${rel.toFixed(1)}°\n` +
          `Visible: ${Math.abs(rel) <= HALF_FOV}`;
      }
    }
    requestAnimationFrame(animate);
  }
  animate();
})();
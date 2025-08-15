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

  // CONFIG (tweak)
  const HALF_FOV        = 35;   // degrees mapped across screen
  const DEAD_ZONE       = 2;    // keep center if within this after stabilization
  const BUFFER_LEN      = 15;   // heading samples (larger = steadier, slower)
  const THRESH_MOVE_DEG = 1.5;  // required delta to update screen position
  const MAX_JUMP_DEG    = 25;   // ignore crazy spikes > this (mag glitches)
  const RELAX_MEANINGFUL = 0.4; // if user turning steadily, reduce threshold factor

  // State
  let motionRequested = false;
  let anchorHeading = null;        // fixed world direction
  let displayHeading = null;       // heading actually driving UI (stable)
  let lastRaw = null;              // last raw (wrapped 0..360)
  let unwrapped = null;            // continuous heading (degrees can grow)
  const buf = [];                  // recent unwrapped samples
  let lastUpdateTime = 0;

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
    setHint('Rotate. Relock to reset.');
  }

  function norm360(h){ return (h + 360) % 360; }
  function shortestDiff(a,b){
    return (b - a + 540) % 360 - 180;
  }

  function unwrap(newVal){
    if (lastRaw == null){
      lastRaw = newVal;
      unwrapped = newVal;
      return unwrapped;
    }
    let diff = newVal - lastRaw;
    if (diff > 180) diff -= 360;
    else if (diff < -180) diff += 360;
    // Spike rejection
    if (Math.abs(diff) > MAX_JUMP_DEG) {
      // ignore spike: pretend no movement
      diff = 0;
    }
    unwrapped += diff;
    lastRaw = newVal;
    return unwrapped;
  }

  function median(arr){
    const a = arr.slice().sort((x,y)=>x-y);
    const m = Math.floor(a.length/2);
    return a.length % 2 ? a[m] : (a[m-1]+a[m])/2;
  }

  function onOrient(e){
    let raw;
    if (typeof e.webkitCompassHeading === 'number') raw = e.webkitCompassHeading;
    else if (typeof e.alpha === 'number') raw = e.alpha;
    else return;
    raw = norm360(raw);
    const uw = unwrap(raw);

    buf.push(uw);
    if (buf.length > BUFFER_LEN) buf.shift();

    if (buf.length < BUFFER_LEN) return; // wait until buffer fills

    const medUnwrapped = median(buf);
    // Convert median unwrapped back to 0..360 ref by comparing to current unwrapped
    const estHeading = norm360(medUnwrapped % 360);

    if (displayHeading == null){
      displayHeading = estHeading;
      anchorHeading = estHeading;
      if (!customText && anchorEl) anchorEl.textContent = 'Test Anchor';
      return;
    }

    // Determine if user is making a meaningful turn
    const deltaSinceLast = Math.abs(shortestDiff(displayHeading, estHeading));
    // If sustained motion (delta > threshold * factor over time), reduce threshold dynamically
    let thresh = THRESH_MOVE_DEG;
    const now = performance.now();
    if (deltaSinceLast > THRESH_MOVE_DEG * 2 && (now - lastUpdateTime) < 220){
      thresh = THRESH_MOVE_DEG * RELAX_MEANINGFUL;
    }

    if (deltaSinceLast >= thresh){
      displayHeading = norm360(displayHeading + shortestDiff(displayHeading, estHeading));
      lastUpdateTime = now;
    }
  }

  // Relock button
  if (relockBtn){
    relockBtn.onclick = () => {
      if (displayHeading != null){
        anchorHeading = displayHeading;
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
    if (anchorHeading != null && displayHeading != null && anchorEl){
      const rel = shortestDiff(anchorHeading, displayHeading); // -180..180

      if (Math.abs(rel) <= DEAD_ZONE){
        anchorEl.style.left = '50%';
      } else {
        const clamped = Math.max(-HALF_FOV, Math.min(HALF_FOV, rel));
        const pct = (clamped / (HALF_FOV * 2)) + 0.5;
        anchorEl.style.left = (pct * 100) + '%';
      }

      anchorEl.style.opacity = '1';
      anchorEl.style.top = '50%';
      anchorEl.style.transform = 'translate(-50%,-50%)';

      if (dbgBox && dbgBox.style.display === 'block'){
        dbgBox.textContent =
          `Disp:   ${displayHeading.toFixed(1)}°\n` +
          `Anchor: ${anchorHeading.toFixed(1)}°\n` +
          `Rel:    ${rel.toFixed(2)}°\n` +
          `BufLen: ${buf.length}\n` +
          `Stable: ${Math.abs(rel)<=DEAD_ZONE}`;
      }
    }
    requestAnimationFrame(update);
  }
  update();
})();
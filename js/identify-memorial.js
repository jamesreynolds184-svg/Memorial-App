(() => {
  const video = document.getElementById('camera');
  const snapshot = document.getElementById('snapshot');
  const startBtn = document.getElementById('start-camera');
  const stopBtn = document.getElementById('stop-camera');
  const captureBtn = document.getElementById('capture-photo');
  const uploadBtn = document.getElementById('upload-photo');
  const photoInput = document.getElementById('photo-input');
  const statusEl = document.getElementById('status');
  const progressEl = document.getElementById('progress');
  const matchList = document.getElementById('match-list');

  if (!video || !snapshot || !startBtn || !stopBtn || !captureBtn || !uploadBtn || !photoInput || !statusEl || !progressEl || !matchList) {
    console.error('Identify memorial: required elements missing.');
    return;
  }

  const dataPath = location.pathname.includes('/pages/')
    ? '../data/memorials.json'
    : 'data/memorials.json';

  let stream = null;
  let memorials = null;
  let isSearching = false;
  let cancelSearch = false;

  function setStatus(message, type) {
    statusEl.textContent = message;
    statusEl.classList.toggle('error', type === 'error');
    statusEl.classList.toggle('success', type === 'success');
  }

  function setProgress(message) {
    progressEl.textContent = message || '';
  }

  async function startCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setStatus('Camera not supported. Upload a photo instead.', 'error');
      return;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      video.srcObject = stream;
      await video.play();
      setStatus('Camera ready. Capture a frame to match.', 'success');
    } catch (err) {
      console.error('Camera error', err);
      setStatus('Unable to access camera. Check permissions or upload a photo.', 'error');
    }
  }

  function stopCamera() {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      stream = null;
    }
    video.srcObject = null;
    setStatus('Camera stopped.', 'success');
  }

  function drawToSnapshot(source, maxSize) {
    const ctx = snapshot.getContext('2d', { willReadFrequently: true });
    const width = source.videoWidth || source.naturalWidth || source.width;
    const height = source.videoHeight || source.naturalHeight || source.height;
    if (!width || !height) return;

    let targetW = width;
    let targetH = height;
    if (maxSize && Math.max(width, height) > maxSize) {
      const scale = maxSize / Math.max(width, height);
      targetW = Math.round(width * scale);
      targetH = Math.round(height * scale);
    }

    snapshot.width = targetW;
    snapshot.height = targetH;
    ctx.drawImage(source, 0, 0, targetW, targetH);
  }

  function captureFrame() {
    if (!stream || !video.videoWidth) {
      setStatus('Start the camera first, then capture.', 'error');
      return;
    }
    drawToSnapshot(video, 1280);
    setStatus('Snapshot captured. Matching now...', 'success');
    identifyFromSnapshot();
  }

  function handleUpload(file) {
    if (!file) return;
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      drawToSnapshot(img, 1280);
      setStatus('Photo loaded. Matching now...', 'success');
      identifyFromSnapshot();
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      setStatus('Unable to read that image file.', 'error');
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }

  async function loadMemorials() {
    if (memorials) return memorials;
    const res = await fetch(dataPath);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    memorials = (Array.isArray(data) ? data : [])
      .filter(m => m && m.name && m.zone)
      .map(m => ({ name: m.name, zone: m.zone }));
    return memorials;
  }

  function candidatePaths(memorial) {
    const base = `../img/zone${memorial.zone}/${memorial.name}`;
    return [
      base + '.jpeg',
      base + '.JPEG',
      base + '.jpg',
      base + '.png'
    ];
  }

  function loadImage(path) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('load failed'));
      img.src = path;
    });
  }

  async function loadMemorialImage(memorial) {
    const paths = candidatePaths(memorial);
    for (const path of paths) {
      try {
        const img = await loadImage(path);
        return { img, path };
      } catch {
        // Try next extension.
      }
    }
    return null;
  }

  function computeAHashFromCanvas(canvas) {
    const size = 8;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const temp = document.createElement('canvas');
    temp.width = size;
    temp.height = size;
    const tctx = temp.getContext('2d', { willReadFrequently: true });
    tctx.drawImage(canvas, 0, 0, size, size);
    const data = tctx.getImageData(0, 0, size, size).data;
    const gray = new Array(size * size);
    let sum = 0;
    for (let i = 0; i < data.length; i += 4) {
      const v = Math.round(data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
      gray[i / 4] = v;
      sum += v;
    }
    const avg = sum / gray.length;
    let bits = '';
    for (let i = 0; i < gray.length; i++) {
      bits += gray[i] >= avg ? '1' : '0';
    }
    return bits;
  }

  function computeAHashFromImage(img) {
    const temp = document.createElement('canvas');
    const ctx = temp.getContext('2d', { willReadFrequently: true });
    const size = 8;
    temp.width = size;
    temp.height = size;
    ctx.drawImage(img, 0, 0, size, size);
    return computeAHashFromCanvas(temp);
  }

  function hammingDistance(a, b) {
    if (!a || !b || a.length !== b.length) return Number.POSITIVE_INFINITY;
    let dist = 0;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) dist++;
    }
    return dist;
  }

  function updateMatches(results) {
    matchList.innerHTML = '';
    if (!results.length) {
      matchList.innerHTML = '<li>No matches found. Try a clearer photo.</li>';
      return;
    }
    for (const r of results) {
      const li = document.createElement('li');
      li.className = 'match-row';

      const titleWrap = document.createElement('div');
      const title = document.createElement('div');
      title.className = 'match-title';
      title.textContent = r.name;
      const score = document.createElement('div');
      score.className = 'match-score';
      score.textContent = `Match: ${r.score}%`;
      titleWrap.appendChild(title);
      titleWrap.appendChild(score);

      const btn = document.createElement('button');
      btn.className = 'btn btn-primary';
      btn.type = 'button';
      btn.textContent = 'Open memorial';
      btn.addEventListener('click', () => {
        location.href = `memorial.html?name=${encodeURIComponent(r.name)}&from=identify`;
      });

      li.appendChild(titleWrap);
      li.appendChild(btn);
      matchList.appendChild(li);
    }
  }

  async function identifyFromSnapshot() {
    if (isSearching) {
      cancelSearch = true;
      setStatus('Stopping current scan. Tap capture again to restart.', 'error');
      return;
    }

    if (!snapshot.width || !snapshot.height) {
      setStatus('No snapshot to analyze yet.', 'error');
      return;
    }

    isSearching = true;
    cancelSearch = false;
    matchList.innerHTML = '';
    setProgress('Loading memorial list...');

    try {
      const targetHash = computeAHashFromCanvas(snapshot);
      const items = await loadMemorials();
      const total = items.length;
      const best = [];
      let checked = 0;

      for (const memorial of items) {
        if (cancelSearch) break;
        const loaded = await loadMemorialImage(memorial);
        if (!loaded) {
          checked++;
          continue;
        }
        const hash = computeAHashFromImage(loaded.img);
        const dist = hammingDistance(targetHash, hash);
        const score = Math.max(0, Math.min(100, Math.round((1 - dist / 64) * 100)));

        best.push({ name: memorial.name, score, dist });
        best.sort((a, b) => a.dist - b.dist);
        if (best.length > 3) best.length = 3;

        checked++;
        if (checked % 10 === 0 || checked === total) {
          setProgress(`Scanned ${checked} of ${total} images...`);
        }
      }

      if (cancelSearch) {
        setStatus('Scan cancelled.', 'error');
        setProgress('');
        isSearching = false;
        return;
      }

      setProgress('');
      setStatus('Scan complete. Review the suggestions below.', 'success');
      updateMatches(best.map(({ name, score }) => ({ name, score })));
    } catch (err) {
      console.error('Match error', err);
      setStatus('Matching failed. Please try again.', 'error');
      setProgress('');
    } finally {
      isSearching = false;
    }
  }

  startBtn.addEventListener('click', startCamera);
  stopBtn.addEventListener('click', stopCamera);
  captureBtn.addEventListener('click', captureFrame);
  uploadBtn.addEventListener('click', () => photoInput.click());
  photoInput.addEventListener('change', (e) => handleUpload(e.target.files[0]));

  window.addEventListener('beforeunload', stopCamera);
})();

// ==========================================================================
// Shared Audio Download System
// --------------------------------------------------------------------------
// Used by memorial.js (memorial_audio/) and asf-plaque.js (asf_audio/).
// This file must be loaded BEFORE those scripts.
//
// The ZIP at AUDIO_ZIP_URL contains:
//   memorial_audio/[memorial_id].mp3   (e.g. 000.mp3)
//   asf_audio/[plaque_id].mp3          (e.g. 001.mp3)
//
// NOTE: asf_audio/ may be missing from the ZIP until the plaque audio is
// published. Extraction simply skips whatever isn't there, and the ASF
// plaque page re-runs the download when a plaque's audio file is not found
// locally, so newly published audio is picked up automatically.
// ==========================================================================
(function () {
  'use strict';

  const AUDIO_DOWNLOAD_KEY = 'audioFilesDownloaded';
  const ASF_AUDIO_DOWNLOAD_KEY = 'asfAudioFilesDownloaded';
  const AUDIO_ZIP_URL = 'https://nma-app-dlc.s3.eu-north-1.amazonaws.com/memorial_audio.zip';
  const USE_CORS_PROXY = false; // Set to true if S3 CORS is not configured yet
  const CORS_PROXY = 'https://corsproxy.io/?';
  const AUDIO_SIZE_LABEL = '426MB'; // Shown in the download prompt. Update if the ZIP grows.

  const DB_NAME = 'MemorialAudioDB';
  const DB_VERSION = 2; // v2 adds the asfAudioFiles object store
  const MEMORIAL_STORE = 'audioFiles';
  const ASF_STORE = 'asfAudioFiles';

  function hasCapacitorFilesystem() {
    return !!(window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem);
  }

  function getAudioURL() {
    return USE_CORS_PROXY ? CORS_PROXY + encodeURIComponent(AUDIO_ZIP_URL) : AUDIO_ZIP_URL;
  }

  // ---------- IndexedDB ----------

  function openAudioDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(MEMORIAL_STORE)) {
          db.createObjectStore(MEMORIAL_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(ASF_STORE)) {
          db.createObjectStore(ASF_STORE, { keyPath: 'id' });
        }
      };
    });
  }

  function saveAudioToStore(db, storeName, id, blob) {
    return new Promise((resolve, reject) => {
      console.log('Saving to IndexedDB - Store:', storeName, 'ID:', id, 'Blob size:', blob.size);
      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put({ id: id, audio: blob });

      request.onsuccess = () => resolve();
      request.onerror = () => {
        console.error('❌ IndexedDB save error for ID:', id, request.error);
        reject(request.error);
      };
    });
  }

  function getAudioFromStore(id, storeName) {
    return new Promise(async (resolve, reject) => {
      try {
        const db = await openAudioDB();
        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.get(id);

        request.onsuccess = () => {
          db.close();
          if (request.result && request.result.audio) {
            resolve(request.result.audio);
          } else {
            resolve(null);
          }
        };
        request.onerror = () => {
          db.close();
          reject(request.error);
        };
      } catch (err) {
        reject(err);
      }
    });
  }

  // Memorial-store wrappers (original API used by memorial.js)
  function saveAudioToIndexedDB(db, memorialId, blob) {
    return saveAudioToStore(db, MEMORIAL_STORE, memorialId, blob);
  }
  function getAudioFromIndexedDB(memorialId) {
    return getAudioFromStore(memorialId, MEMORIAL_STORE);
  }

  // ---------- Availability checks ----------

  async function checkAudioAvailable() {
    // Check localStorage flag
    const downloaded = localStorage.getItem(AUDIO_DOWNLOAD_KEY);
    if (downloaded === 'true') {
      return true;
    }

    // Check if Capacitor is available (native app)
    if (hasCapacitorFilesystem()) {
      try {
        const { Filesystem } = window.Capacitor.Plugins;
        // Check if memorial_audio directory exists
        const result = await Filesystem.readdir({
          path: 'memorial_audio',
          directory: Filesystem.Directory.Data
        });
        if (result.files && result.files.length > 0) {
          localStorage.setItem(AUDIO_DOWNLOAD_KEY, 'true');
          return true;
        }
      } catch (err) {
        console.log('Audio directory not found in native app');
        return false;
      }
    }

    // For web, check IndexedDB
    try {
      const db = await openAudioDB();
      const transaction = db.transaction([MEMORIAL_STORE], 'readonly');
      const store = transaction.objectStore(MEMORIAL_STORE);
      const countRequest = store.count();

      const count = await new Promise((resolve, reject) => {
        countRequest.onsuccess = () => resolve(countRequest.result);
        countRequest.onerror = () => reject(countRequest.error);
      });

      db.close();

      if (count > 0) {
        console.log(`Found ${count} audio files in IndexedDB`);
        localStorage.setItem(AUDIO_DOWNLOAD_KEY, 'true');
        return true;
      }
    } catch (err) {
      console.log('IndexedDB check failed:', err);
    }

    // Fallback: try to check if a sample audio file exists in file system
    try {
      const testPath = location.pathname.includes('/pages/')
        ? '../memorial_audio/1.mp3'
        : 'memorial_audio/1.mp3';
      const response = await fetch(testPath, { method: 'HEAD' });
      if (response.ok) {
        localStorage.setItem(AUDIO_DOWNLOAD_KEY, 'true');
        return true;
      }
    } catch (err) {
      console.log('Audio files not found in file system');
    }

    return false;
  }

  // Per-plaque check for ASF audio. Deliberately does NOT use a global
  // "already downloaded" flag: plaque audio is published separately, so an
  // individual file may appear in the ZIP at any time.
  async function checkAsfAudioAvailable(plaqueId) {
    if (!plaqueId) return false;

    if (hasCapacitorFilesystem()) {
      try {
        const { Filesystem } = window.Capacitor.Plugins;
        await Filesystem.stat({
          path: `asf_audio/${plaqueId}.mp3`,
          directory: Filesystem.Directory.Data
        });
        return true;
      } catch (err) {
        return false;
      }
    }

    try {
      const blob = await getAudioFromStore(plaqueId, ASF_STORE);
      return !!blob;
    } catch (err) {
      console.log('ASF audio check failed:', err);
      return false;
    }
  }

  // Returns a playable URL for a plaque's audio (blob: URL on web,
  // Capacitor file URL on native), or null if not available.
  async function getAsfAudioPath(plaqueId) {
    if (hasCapacitorFilesystem()) {
      try {
        const { Filesystem } = window.Capacitor.Plugins;
        const fileUri = await Filesystem.getUri({
          path: `asf_audio/${plaqueId}.mp3`,
          directory: Filesystem.Directory.Data
        });
        return window.Capacitor.convertFileSrc(fileUri.uri);
      } catch (err) {
        return null;
      }
    }

    try {
      const audioBlob = await getAudioFromStore(plaqueId, ASF_STORE);
      if (!audioBlob) return null;
      const mp3Blob = new Blob([audioBlob], { type: 'audio/mpeg' });
      return URL.createObjectURL(mp3Blob);
    } catch (err) {
      console.error('Could not get ASF audio path:', err);
      return null;
    }
  }

  // ---------- Download prompt ----------

  function showAudioDownloadPrompt(customMessage) {
    return new Promise((resolve) => {
      // Create overlay
      const overlay = document.createElement('div');
      overlay.className = 'audio-download-overlay';
      overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: rgba(0, 0, 0, 0.7);
        z-index: 10000;
        display: flex;
        justify-content: center;
        align-items: center;
        touch-action: none;
      `;

      // Create dialog
      const dialog = document.createElement('div');
      dialog.className = 'audio-download-dialog';
      dialog.style.cssText = `
        background: white;
        border-radius: 12px;
        padding: 24px;
        max-width: 90%;
        width: 340px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        text-align: center;
      `;

      // Title
      const title = document.createElement('h3');
      title.textContent = 'Download Audio Files';
      title.style.cssText = 'margin: 0 0 16px 0; font-size: 20px; color: #333;';
      dialog.appendChild(title);

      // Message
      const message = document.createElement('p');
      message.textContent = customMessage ||
        `You need to download the audio files (${AUDIO_SIZE_LABEL}) to use Read Aloud. Continue?`;
      message.style.cssText = 'margin: 0 0 24px 0; font-size: 16px; color: #666; line-height: 1.5;';
      dialog.appendChild(message);

      // Buttons container
      const buttons = document.createElement('div');
      buttons.style.cssText = 'display: flex; gap: 12px; justify-content: center;';

      // Cancel button
      const cancelBtn = document.createElement('button');
      cancelBtn.textContent = 'Cancel';
      cancelBtn.style.cssText = `
        padding: 12px 24px;
        border: 1px solid #ccc;
        background: white;
        color: #333;
        border-radius: 8px;
        font-size: 16px;
        cursor: pointer;
        min-width: 100px;
      `;
      cancelBtn.onclick = () => {
        document.body.removeChild(overlay);
        resolve(false);
      };

      // Download button
      const downloadBtn = document.createElement('button');
      downloadBtn.textContent = 'Download';
      downloadBtn.style.cssText = `
        padding: 12px 24px;
        border: none;
        background: #007AFF;
        color: white;
        border-radius: 8px;
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
        min-width: 100px;
      `;
      downloadBtn.onclick = () => {
        document.body.removeChild(overlay);
        resolve(true);
      };

      buttons.appendChild(cancelBtn);
      buttons.appendChild(downloadBtn);
      dialog.appendChild(buttons);

      overlay.appendChild(dialog);
      document.body.appendChild(overlay);
    });
  }

  // ---------- Download + extract ----------

  async function downloadAndExtractAudio() {
    // Create progress overlay
    const overlay = document.createElement('div');
    overlay.className = 'audio-progress-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(0, 0, 0, 0.7);
      z-index: 10000;
      display: flex;
      justify-content: center;
      align-items: center;
      touch-action: none;
    `;

    // Create dialog
    const dialog = document.createElement('div');
    dialog.className = 'audio-progress-dialog';
    dialog.style.cssText = `
      background: white;
      border-radius: 12px;
      padding: 24px;
      max-width: 90%;
      width: 340px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      text-align: center;
    `;

    // Title
    const title = document.createElement('h3');
    title.textContent = 'Downloading Audio Files';
    title.style.cssText = 'margin: 0 0 16px 0; font-size: 20px; color: #333;';
    dialog.appendChild(title);

    // Status text
    const status = document.createElement('p');
    status.textContent = 'Preparing download...';
    status.style.cssText = 'margin: 0 0 16px 0; font-size: 14px; color: #666;';
    dialog.appendChild(status);

    // Progress bar container
    const progressContainer = document.createElement('div');
    progressContainer.style.cssText = `
      width: 100%;
      height: 8px;
      background: #e0e0e0;
      border-radius: 4px;
      overflow: hidden;
      margin-bottom: 8px;
    `;

    // Progress bar fill
    const progressBar = document.createElement('div');
    progressBar.style.cssText = `
      width: 0%;
      height: 100%;
      background: #007AFF;
      transition: width 0.3s ease;
    `;
    progressContainer.appendChild(progressBar);
    dialog.appendChild(progressContainer);

    // Progress percentage
    const percentage = document.createElement('p');
    percentage.textContent = '0%';
    percentage.style.cssText = 'margin: 0 0 16px 0; font-size: 14px; color: #999; font-weight: 600;';
    dialog.appendChild(percentage);

    // Close button (initially hidden)
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close';
    closeBtn.style.cssText = `
      padding: 12px 24px;
      border: none;
      background: #007AFF;
      color: white;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      min-width: 100px;
      display: none;
    `;
    closeBtn.onclick = () => {
      document.body.removeChild(overlay);
    };
    dialog.appendChild(closeBtn);

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    try {
      // Download the ZIP file
      status.textContent = 'Downloading audio files...';
      const audioURL = getAudioURL();
      console.log('Fetching audio ZIP from:', audioURL);

      const response = await fetch(audioURL);

      if (!response.ok) {
        console.error('Download failed with status:', response.status, response.statusText);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      console.log('Download started successfully');
      const contentLength = response.headers.get('Content-Length');
      const total = parseInt(contentLength, 10);
      console.log('Total file size:', total, 'bytes (~' + Math.round(total / 1024 / 1024) + 'MB)');

      let loaded = 0;

      const reader = response.body.getReader();
      const chunks = [];

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        chunks.push(value);
        loaded += value.length;

        const progress = Math.round((loaded / total) * 50); // Download is 50% of total progress
        progressBar.style.width = progress + '%';
        percentage.textContent = progress + '%';
      }

      console.log('Download complete. Downloaded:', loaded, 'bytes');

      // Combine chunks into single Uint8Array
      const zipData = new Uint8Array(loaded);
      let position = 0;
      for (const chunk of chunks) {
        zipData.set(chunk, position);
        position += chunk.length;
      }

      // Extract ZIP file
      title.textContent = 'Extracting Audio Files';
      status.textContent = 'Unzipping files...';
      progressBar.style.width = '50%';
      percentage.textContent = '50%';

      // Load JSZip library if not already loaded
      if (!window.JSZip) {
        console.log('Loading JSZip library...');
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
        await new Promise((resolve, reject) => {
          script.onload = () => {
            console.log('JSZip loaded successfully');
            resolve();
          };
          script.onerror = (e) => {
            console.error('Failed to load JSZip:', e);
            reject(new Error('Failed to load JSZip library'));
          };
          document.head.appendChild(script);
        });
      } else {
        console.log('JSZip already loaded');
      }

      console.log('Starting ZIP extraction...');
      const zip = await JSZip.loadAsync(zipData);
      console.log('ZIP loaded successfully');
      const files = Object.keys(zip.files);
      const totalFiles = files.length;
      let processedFiles = 0;
      let memorialCount = 0;
      let asfCount = 0;

      // Check if Capacitor is available (native app)
      if (hasCapacitorFilesystem()) {
        const { Filesystem } = window.Capacitor.Plugins;

        // Create directories
        for (const dir of ['memorial_audio', 'asf_audio']) {
          try {
            await Filesystem.mkdir({
              path: dir,
              directory: Filesystem.Directory.Data,
              recursive: true
            });
          } catch (err) {
            console.log('Directory might already exist:', dir, err);
          }
        }

        // Extract files
        for (const filename of files) {
          const file = zip.files[filename];
          const isAsf = filename.includes('asf_audio/');
          const isMemorial = !isAsf && filename.includes('memorial_audio/');

          if (!file.dir && (isAsf || isMemorial) && filename.endsWith('.mp3')) {
            const content = await file.async('base64');
            const justFilename = filename.split('/').pop();
            const targetDir = isAsf ? 'asf_audio' : 'memorial_audio';

            try {
              await Filesystem.writeFile({
                path: `${targetDir}/${justFilename}`,
                data: content,
                directory: Filesystem.Directory.Data
              });
              if (isAsf) asfCount++; else memorialCount++;
            } catch (writeErr) {
              console.error('Error writing file:', justFilename, writeErr);
            }
          }

          processedFiles++;
          const progress = 50 + Math.round((processedFiles / totalFiles) * 50);
          progressBar.style.width = progress + '%';
          percentage.textContent = progress + '%';
        }
      } else {
        // For web browsers: Use IndexedDB to store audio files
        console.log('Web browser detected, using IndexedDB for storage');
        const db = await openAudioDB();

        // Extract and store files
        for (const filename of files) {
          const file = zip.files[filename];
          const isAsf = filename.includes('asf_audio/');
          const isMemorial = !isAsf && filename.includes('memorial_audio/');

          if (!file.dir && (isAsf || isMemorial) && filename.endsWith('.mp3')) {
            const blob = await file.async('blob');
            // Ensure blob has correct MIME type
            const mp3Blob = new Blob([blob], { type: 'audio/mpeg' });
            const justFilename = filename.split('/').pop();
            const id = justFilename.replace('.mp3', '');

            try {
              await saveAudioToStore(db, isAsf ? ASF_STORE : MEMORIAL_STORE, id, mp3Blob);
              if (isAsf) asfCount++; else memorialCount++;
            } catch (writeErr) {
              console.error('❌ Error storing audio in IndexedDB:', justFilename, writeErr);
            }
          }

          processedFiles++;
          const progress = 50 + Math.round((processedFiles / totalFiles) * 50);
          progressBar.style.width = progress + '%';
          percentage.textContent = progress + '%';
        }

        db.close();
      }

      console.log(`✅ Extraction complete: ${memorialCount} memorial + ${asfCount} ASF plaque audio files`);

      // Success
      title.textContent = 'Success!';
      status.textContent = 'Audio files are ready to use.';
      progressBar.style.width = '100%';
      percentage.textContent = '100%';
      closeBtn.style.display = 'block';

      // Mark what was actually extracted
      if (memorialCount > 0) localStorage.setItem(AUDIO_DOWNLOAD_KEY, 'true');
      if (asfCount > 0) localStorage.setItem(ASF_AUDIO_DOWNLOAD_KEY, 'true');

      return true;

    } catch (err) {
      console.error('Download/extract error:', err);

      // Show error
      title.textContent = 'Failed';

      // Provide more specific error message
      let errorMsg = 'Could not download audio files. ';
      if (err.message.includes('Failed to fetch') || err.name === 'TypeError') {
        errorMsg += 'Network error - check your internet connection or CORS settings.';
      } else if (err.message.includes('HTTP')) {
        errorMsg += err.message;
      } else {
        errorMsg += 'Please try again later. Error: ' + err.message;
      }

      status.textContent = errorMsg;
      status.style.fontSize = '13px';
      status.style.lineHeight = '1.4';
      progressBar.style.background = '#FF3B30';
      closeBtn.style.display = 'block';

      return false;
    }
  }

  // ---------- Debug helpers ----------

  // Call in browser console: window.resetAudioDownload()
  window.resetAudioDownload = function () {
    localStorage.removeItem(AUDIO_DOWNLOAD_KEY);
    localStorage.removeItem(ASF_AUDIO_DOWNLOAD_KEY);
    sessionStorage.removeItem('asfAudioPrompted');
    // Also clear IndexedDB
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => console.log('IndexedDB cleared');
    request.onerror = () => console.error('Failed to clear IndexedDB');
    console.log('Audio download state reset. Refresh the page and try Read Aloud again.');
  };

  // Call in browser console: window.checkAudioStorage()
  window.checkAudioStorage = async function () {
    try {
      const db = await openAudioDB();

      for (const storeName of [MEMORIAL_STORE, ASF_STORE]) {
        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);

        const countRequest = store.count();
        const count = await new Promise((resolve, reject) => {
          countRequest.onsuccess = () => resolve(countRequest.result);
          countRequest.onerror = () => reject(countRequest.error);
        });

        const keysRequest = store.getAllKeys();
        const keys = await new Promise((resolve, reject) => {
          keysRequest.onsuccess = () => resolve(keysRequest.result);
          keysRequest.onerror = () => reject(keysRequest.error);
        });

        console.log(`📊 ${storeName}: ${count} audio files`);
        if (count > 0) {
          console.log('📝 IDs stored:', keys.slice(0, 20).join(', '), keys.length > 20 ? '...' : '');
        }
      }

      db.close();
    } catch (err) {
      console.error('❌ Error checking storage:', err);
    }
  };

  // Call in browser console: window.testAudio('000') - plays a memorial audio
  window.testAudio = async function (memorialId) {
    try {
      console.log('🔍 Testing audio for memorial ID:', memorialId);
      const audioBlob = await getAudioFromIndexedDB(memorialId);

      if (!audioBlob) {
        console.error('❌ No audio found in IndexedDB for ID:', memorialId);
        return false;
      }

      console.log('✅ Found audio - Size:', audioBlob.size, 'Type:', audioBlob.type);

      const mp3Blob = new Blob([audioBlob], { type: 'audio/mpeg' });
      const audioURL = URL.createObjectURL(mp3Blob);
      const audio = new Audio(audioURL);

      audio.addEventListener('canplaythrough', () => {
        console.log('✅ Audio ready to play, duration:', audio.duration, 'seconds');
        audio.play();
      });

      audio.addEventListener('error', (e) => {
        console.error('❌ Audio error:', e, audio.error);
      });

      audio.addEventListener('ended', () => {
        console.log('✅ Audio finished playing');
        URL.revokeObjectURL(audioURL);
      });

      return true;
    } catch (err) {
      console.error('❌ Error testing audio:', err);
      return false;
    }
  };

  // Call in browser console: window.testAsfAudio('001') - plays a plaque audio
  window.testAsfAudio = async function (plaqueId) {
    try {
      console.log('🔍 Testing ASF audio for plaque ID:', plaqueId);
      const audioPath = await getAsfAudioPath(plaqueId);

      if (!audioPath) {
        console.error('❌ No ASF audio found for ID:', plaqueId);
        return false;
      }

      const audio = new Audio(audioPath);

      audio.addEventListener('canplaythrough', () => {
        console.log('✅ ASF audio ready to play, duration:', audio.duration, 'seconds');
        audio.play();
      });

      audio.addEventListener('error', (e) => {
        console.error('❌ ASF audio error:', e, audio.error);
      });

      audio.addEventListener('ended', () => {
        console.log('✅ ASF audio finished playing');
        if (audioPath.startsWith('blob:')) URL.revokeObjectURL(audioPath);
      });

      return true;
    } catch (err) {
      console.error('❌ Error testing ASF audio:', err);
      return false;
    }
  };

  // ---------- Exports (globals used by memorial.js and asf-plaque.js) ----------
  window.openAudioDB = openAudioDB;
  window.saveAudioToIndexedDB = saveAudioToIndexedDB;
  window.getAudioFromIndexedDB = getAudioFromIndexedDB;
  window.checkAudioAvailable = checkAudioAvailable;
  window.checkAsfAudioAvailable = checkAsfAudioAvailable;
  window.getAsfAudioPath = getAsfAudioPath;
  window.showAudioDownloadPrompt = showAudioDownloadPrompt;
  window.downloadAndExtractAudio = downloadAndExtractAudio;
})();

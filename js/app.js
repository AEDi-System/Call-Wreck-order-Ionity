/**
 * app.js
 *
 * Wires the UI, CwoRecorder, and IonityStorage together.
 */

(() => {
  /* ── Element refs ─────────────────────────────────────────── */
  const btnRecord       = document.getElementById('btn-record');
  const btnStop         = document.getElementById('btn-stop');
  const btnPickDir      = document.getElementById('btn-pick-dir');
  const storageBanner   = document.getElementById('storage-banner');
  const storageMsg      = document.getElementById('storage-msg');
  const recIndicator    = document.getElementById('rec-indicator');
  const savePathDisplay = document.getElementById('save-path-display');
  const recordingsList  = document.getElementById('recordings-list');
  const recordingsEmpty = document.getElementById('recordings-empty');
  const toast           = document.getElementById('toast');

  /* ── App state ────────────────────────────────────────────── */
  const recorder = new CwoRecorder();
  let _elapsedTimer = null;

  /* ── Init ─────────────────────────────────────────────────── */
  function init() {
    if (!IonityStorage.isFsaSupported()) {
      showBanner(
        '⚠ File System Access not available — recordings will be downloaded to your Downloads folder.',
        'warning',
      );
    } else {
      showBanner(
        'Grant access to your device storage so recordings are saved to /.Ionity/CWO/.',
        'warning',
        true, // show pick-dir button
      );
    }

    btnRecord.disabled = false;
    updateSavePathDisplay();
  }

  /* ── Storage access ───────────────────────────────────────── */
  btnPickDir.addEventListener('click', async () => {
    btnPickDir.disabled = true;
    btnPickDir.textContent = 'Requesting…';

    const result = await IonityStorage.requestStorageAccess();

    if (result.ok) {
      hideBanner();
      showToast(`✓ Storage access granted: ${result.path}`);
      updateSavePathDisplay();
    } else {
      showBanner(`⚠ ${result.error}`, 'warning', true);
      btnPickDir.disabled = false;
      btnPickDir.textContent = 'Grant storage access';
    }
  });

  /* ── Recording ────────────────────────────────────────────── */
  btnRecord.addEventListener('click', async () => {
    btnRecord.disabled = true;

    try {
      await recorder.start();
    } catch (err) {
      showToast(`✗ Microphone access denied: ${err.message}`);
      btnRecord.disabled = false;
      return;
    }

    // Transition UI to "recording" state.
    btnRecord.classList.add('hidden');
    btnStop.classList.remove('hidden');
    recIndicator.classList.remove('hidden');

    _elapsedTimer = setInterval(() => {
      recIndicator.querySelector('span:last-child').textContent =
        `Recording… ${_formatDuration(recorder.elapsed())}`;
    }, 1000);
  });

  btnStop.addEventListener('click', async () => {
    btnStop.disabled = true;
    clearInterval(_elapsedTimer);

    let result;
    try {
      result = await recorder.stop();
    } catch (err) {
      showToast(`✗ Failed to stop recording: ${err.message}`);
      _resetRecordingUI();
      return;
    }

    let entry;
    try {
      entry = await IonityStorage.saveRecording(result.blob, {
        mimeType: result.mimeType,
        duration: result.duration,
      });
    } catch (err) {
      showToast(`✗ Failed to save recording: ${err.message}`);
      _resetRecordingUI();
      return;
    }

    showToast(`✓ Saved to ${entry.path}`);
    addRecordingToList(entry);
    updateSavePathDisplay();
    _resetRecordingUI();
  });

  /* ── UI helpers ───────────────────────────────────────────── */

  function _resetRecordingUI() {
    clearInterval(_elapsedTimer);
    btnStop.classList.add('hidden');
    btnStop.disabled = false;
    btnRecord.classList.remove('hidden');
    btnRecord.disabled = false;
    recIndicator.classList.add('hidden');
    recIndicator.querySelector('span:last-child').textContent = 'Recording…';
  }

  function updateSavePathDisplay() {
    if (IonityStorage.hasStorageAccess()) {
      savePathDisplay.textContent = '/.Ionity/CWO/YYYYMMDD_HHMMSS_XXXXXXXX.webm';
    } else if (!IonityStorage.isFsaSupported()) {
      savePathDisplay.textContent = 'Downloads/YYYYMMDD_HHMMSS_XXXXXXXX.webm';
    } else {
      savePathDisplay.textContent = '/.Ionity/CWO/ (grant access above)';
    }
  }

  function showBanner(msg, type = 'warning', showBtn = false) {
    storageMsg.textContent = msg;
    storageBanner.className = `banner banner--${type}`;
    btnPickDir.classList.toggle('hidden', !showBtn);
    storageBanner.classList.remove('hidden');
  }

  function hideBanner() {
    storageBanner.classList.add('hidden');
  }

  /** @param {object} entry — from IonityStorage.saveRecording */
  function addRecordingToList(entry) {
    recordingsEmpty.classList.add('hidden');

    const li = document.createElement('li');
    li.className = 'recording-item';

    const sizeKb = (entry.size / 1024).toFixed(1);
    const dur = _formatDuration(entry.duration);

    li.innerHTML = `
      <div class="recording-item__info">
        <div class="recording-item__name">${_escHtml(entry.filename)}</div>
        <div class="recording-item__meta">${dur} &middot; ${sizeKb} KB</div>
        <div class="recording-item__path">${_escHtml(entry.path)}</div>
        <audio controls src="${_escHtml(entry.blobUrl)}"></audio>
      </div>
      <div class="recording-item__actions">
        <button class="btn btn--ghost btn--sm js-download" data-url="${_escHtml(entry.blobUrl)}" data-name="${_escHtml(entry.filename)}">↓</button>
      </div>
    `;

    li.querySelector('.js-download').addEventListener('click', (e) => {
      const btn = e.currentTarget;
      const a = document.createElement('a');
      a.href = btn.dataset.url;
      a.download = btn.dataset.name;
      a.click();
    });

    recordingsList.prepend(li);
  }

  let _toastTimer = null;
  function showToast(msg, duration = 3500) {
    clearTimeout(_toastTimer);
    toast.textContent = msg;
    toast.classList.remove('hidden');
    _toastTimer = setTimeout(() => toast.classList.add('hidden'), duration);
  }

  function _formatDuration(secs) {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  function _escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ── Bootstrap ────────────────────────────────────────────── */
  init();
})();

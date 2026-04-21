/**
 * storage.js
 *
 * Manages the /.Ionity/CWO/ folder structure on the user's device
 * using the File System Access API (OPFS / showDirectoryPicker).
 *
 * Folder hierarchy created on device:
 *   <user-chosen root>
 *     └── .Ionity/
 *           └── CWO/
 *                 └── <YYYYMMDD_HHMMSS_XXXXXXXX>.webm   ← recordings
 *
 * Falls back to a plain file download when the API is unavailable.
 */

const IonityStorage = (() => {
  /** Root FileSystemDirectoryHandle for .Ionity/CWO/ (set after grant) */
  let _cwoDir = null;

  /** Whether the File System Access API is available in this browser */
  const _fsaSupported = typeof window !== 'undefined' &&
    'showDirectoryPicker' in window;

  /** In-memory list of saved recordings (for the session) */
  const _recordings = [];

  /* ── Helpers ──────────────────────────────────────────────── */

  /**
   * Generate a short 8-character alphanumeric ID.
   * @returns {string}
   */
  function _shortId() {
    return Math.random().toString(36).slice(2, 10).toUpperCase();
  }

  /**
   * Build a timestamp string: YYYYMMDD_HHMMSS
   * @returns {string}
   */
  function _timestamp() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return (
      `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
      `_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
    );
  }

  /**
   * Build the canonical filename: YYYYMMDD_HHMMSS_XXXXXXXX.webm
   * The 8-char ID corresponds to the ******** placeholder in /.Ionity/CWO/********.
   * @returns {string}
   */
  function _buildFilename() {
    return `${_timestamp()}_${_shortId()}.webm`;
  }

  /**
   * Recursively obtain (or create) a nested directory handle.
   * @param {FileSystemDirectoryHandle} root
   * @param {string[]} parts  e.g. ['.Ionity', 'CWO']
   * @returns {Promise<FileSystemDirectoryHandle>}
   */
  async function _getOrCreateDir(root, parts) {
    let dir = root;
    for (const part of parts) {
      dir = await dir.getDirectoryHandle(part, { create: true });
    }
    return dir;
  }

  /* ── Public API ───────────────────────────────────────────── */

  /**
   * Ask the user to grant access to a storage root, then create
   * the .Ionity/CWO/ directory tree inside it.
   *
   * @returns {Promise<{ok: boolean, path: string, error?: string}>}
   */
  async function requestStorageAccess() {
    if (!_fsaSupported) {
      return {
        ok: false,
        path: '/.Ionity/CWO/',
        error: 'File System Access API not supported — recordings will be downloaded instead.',
      };
    }

    try {
      // Let the user pick the root (e.g. the device's internal storage root).
      const root = await window.showDirectoryPicker({ mode: 'readwrite' });

      // Create .Ionity/CWO/ inside the chosen root.
      _cwoDir = await _getOrCreateDir(root, ['.Ionity', 'CWO']);

      const path = `${root.name}/.Ionity/CWO/`;
      return { ok: true, path };
    } catch (err) {
      if (err.name === 'AbortError') {
        return { ok: false, path: '', error: 'Storage access cancelled.' };
      }
      return { ok: false, path: '', error: err.message };
    }
  }

  /**
   * Save a recording Blob to /.Ionity/CWO/<filename>.
   *
   * If the CWO directory handle is available the file is written directly
   * to the device folder. Otherwise the browser is asked to download the file
   * so the user can place it manually.
   *
   * @param {Blob}   blob       The recorded audio blob.
   * @param {object} [meta={}]  Optional metadata (duration, mimeType …).
   * @returns {Promise<{filename: string, path: string, size: number}>}
   */
  async function saveRecording(blob, meta = {}) {
    const filename = _buildFilename();
    const size = blob.size;
    let path;

    if (_cwoDir) {
      // Write directly into the .Ionity/CWO/ directory on the device.
      const fileHandle = await _cwoDir.getFileHandle(filename, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();
      path = `/.Ionity/CWO/${filename}`;
    } else {
      // Fallback: trigger a browser download.
      _downloadBlob(blob, filename);
      path = `Downloads/${filename}`;
    }

    const entry = {
      filename,
      path,
      size,
      mimeType: meta.mimeType || blob.type || 'audio/webm',
      duration: meta.duration || 0,
      savedAt: new Date().toISOString(),
      blobUrl: URL.createObjectURL(blob),
    };

    _recordings.unshift(entry);
    return entry;
  }

  /**
   * Trigger a download of a Blob as a named file.
   * @param {Blob}   blob
   * @param {string} filename
   */
  function _downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      a.remove();
    }, 10_000);
  }

  /**
   * Return the in-session recordings list (newest first).
   * @returns {object[]}
   */
  function getRecordings() {
    return _recordings;
  }

  /**
   * Whether a CWO directory handle is active (storage access granted).
   * @returns {boolean}
   */
  function hasStorageAccess() {
    return _cwoDir !== null;
  }

  /**
   * Whether the File System Access API is available.
   * @returns {boolean}
   */
  function isFsaSupported() {
    return _fsaSupported;
  }

  return {
    requestStorageAccess,
    saveRecording,
    getRecordings,
    hasStorageAccess,
    isFsaSupported,
  };
})();

/**
 * recorder.js
 *
 * Wraps the MediaRecorder + getUserMedia APIs to capture microphone audio
 * (and, where available, system audio / second microphone for the far end).
 *
 * Usage:
 *   const rec = new CwoRecorder();
 *   await rec.start();
 *   // …
 *   const blob = await rec.stop();  // resolves with the recorded audio Blob
 */

class CwoRecorder {
  constructor() {
    this._mediaRecorder = null;
    this._chunks = [];
    this._startTime = null;
    this._stream = null;
    this._stopResolve = null;
    this._stopReject = null;
  }

  /**
   * Preferred MIME types, ordered by quality / compatibility.
   * @returns {string}
   */
  static _preferredMimeType() {
    const candidates = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/ogg',
      'audio/mp4',
    ];
    for (const type of candidates) {
      if (MediaRecorder.isTypeSupported(type)) return type;
    }
    return '';
  }

  /**
   * Request microphone access and start recording.
   * @returns {Promise<void>}
   * @throws  if the user denies the microphone permission
   */
  async start() {
    if (this._mediaRecorder) {
      throw new Error('Already recording.');
    }

    // Request microphone.  On some platforms a second call with
    // { audio: { echoCancellation: false } } can capture system audio;
    // fall back gracefully if it fails.
    this._stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: 48000,
      },
      video: false,
    });

    const mimeType = CwoRecorder._preferredMimeType();
    const options = mimeType ? { mimeType } : {};

    this._chunks = [];
    this._startTime = Date.now();

    this._mediaRecorder = new MediaRecorder(this._stream, options);

    this._mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        this._chunks.push(e.data);
      }
    };

    this._mediaRecorder.onstop = () => {
      const blob = new Blob(this._chunks, {
        type: this._mediaRecorder.mimeType || 'audio/webm',
      });
      this._cleanup();
      if (this._stopResolve) {
        this._stopResolve({
          blob,
          mimeType: blob.type,
          duration: Math.round((Date.now() - this._startTime) / 1000),
        });
      }
    };

    this._mediaRecorder.onerror = (e) => {
      this._cleanup();
      if (this._stopReject) this._stopReject(e.error || new Error('MediaRecorder error'));
    };

    // Collect data every second so we don't lose everything on a crash.
    this._mediaRecorder.start(1000);
  }

  /**
   * Stop recording and return a Promise that resolves with the audio blob.
   * @returns {Promise<{blob: Blob, mimeType: string, duration: number}>}
   */
  stop() {
    return new Promise((resolve, reject) => {
      if (!this._mediaRecorder) {
        return reject(new Error('Not recording.'));
      }
      this._stopResolve = resolve;
      this._stopReject = reject;
      this._mediaRecorder.stop();
    });
  }

  /**
   * Whether recording is currently in progress.
   * @returns {boolean}
   */
  isRecording() {
    return this._mediaRecorder !== null &&
      this._mediaRecorder.state === 'recording';
  }

  /**
   * Elapsed time in seconds since recording started.
   * @returns {number}
   */
  elapsed() {
    if (!this._startTime) return 0;
    return Math.round((Date.now() - this._startTime) / 1000);
  }

  /** Release microphone tracks and reset internal state. */
  _cleanup() {
    if (this._stream) {
      this._stream.getTracks().forEach((t) => t.stop());
      this._stream = null;
    }
    this._mediaRecorder = null;
    this._chunks = [];
    this._stopResolve = null;
    this._stopReject = null;
  }
}

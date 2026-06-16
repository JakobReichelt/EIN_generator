// Offline canvas video export (30 fps) via mediabunny / WebCodecs.

const RECORD_FPS = 30;
const RECORD_BITRATE = 12_000_000;

let recordingState = 'idle'; // 'idle' | 'recording' | 'finalizing'
let recordVirtualMs = 0;
let recordFrameIndex = 0;
let recordFileExt = 'mp4';
let recordWallStartMs = 0;
let videoOutput = null;
let videoSource = null;
let recordIndicatorEl = null;
let recordIndicatorTextEl = null;
let recordNoticeTimeout = null;

function sketchClockMs() {
  if (recordingState === 'recording') return recordVirtualMs;
  return typeof millis === 'function' ? millis() : performance.now();
}

function isVideoRecording() {
  return recordingState !== 'idle';
}

function formatRecordTimestamp() {
  const now = new Date();
  const dateStr = now.getFullYear() + '-'
    + String(now.getMonth() + 1).padStart(2, '0') + '-'
    + String(now.getDate()).padStart(2, '0');
  const timeStr = String(now.getHours()).padStart(2, '0') + '-'
    + String(now.getMinutes()).padStart(2, '0') + '-'
    + String(now.getSeconds()).padStart(2, '0');
  return { dateStr, timeStr };
}

function downloadVideoBlob(blob, ext) {
  const { dateStr, timeStr } = formatRecordTimestamp();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'europe-flowfield_' + dateStr + '_' + timeStr + '.' + ext;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function ensureRecordIndicator() {
  if (!recordIndicatorEl) {
    recordIndicatorEl = document.getElementById('record-indicator');
    recordIndicatorTextEl = document.getElementById('record-indicator-text');
  }
}

function showRecordNotice(message, durationMs = 4000) {
  ensureRecordIndicator();
  if (!recordIndicatorEl || !recordIndicatorTextEl) return;
  if (recordNoticeTimeout) {
    clearTimeout(recordNoticeTimeout);
    recordNoticeTimeout = null;
  }
  recordIndicatorEl.classList.add('is-visible', 'is-encoding');
  recordIndicatorEl.setAttribute('aria-hidden', 'false');
  recordIndicatorTextEl.textContent = message;
  recordNoticeTimeout = setTimeout(() => {
    recordNoticeTimeout = null;
    if (recordingState === 'idle') hideRecordIndicator();
  }, durationMs);
}

function showRecordIndicator() {
  ensureRecordIndicator();
  if (!recordIndicatorEl || !recordIndicatorTextEl) return;
  if (recordNoticeTimeout) {
    clearTimeout(recordNoticeTimeout);
    recordNoticeTimeout = null;
  }
  recordIndicatorEl.classList.add('is-visible');
  recordIndicatorEl.classList.remove('is-encoding');
  recordIndicatorEl.setAttribute('aria-hidden', 'false');
  updateRecordIndicator();
}

function updateRecordIndicator() {
  if (!recordIndicatorTextEl || recordingState !== 'recording') return;
  const wallSec = ((performance.now() - recordWallStartMs) / 1000).toFixed(1);
  const videoSec = (recordFrameIndex / RECORD_FPS).toFixed(1);
  recordIndicatorTextEl.textContent = 'REC ' + wallSec + 's · ' + recordFrameIndex + 'f · ' + videoSec + 's video';
}

function setRecordIndicatorEncoding() {
  ensureRecordIndicator();
  if (!recordIndicatorEl || !recordIndicatorTextEl) return;
  recordIndicatorEl.classList.add('is-visible', 'is-encoding');
  recordIndicatorEl.setAttribute('aria-hidden', 'false');
  recordIndicatorTextEl.textContent = 'Encoding… (' + recordFrameIndex + ' frames)';
}

function hideRecordIndicator() {
  ensureRecordIndicator();
  if (!recordIndicatorEl) return;
  recordIndicatorEl.classList.remove('is-visible', 'is-encoding');
  recordIndicatorEl.setAttribute('aria-hidden', 'true');
}

async function waitForMediabunny(maxMs = 8000) {
  const deadline = performance.now() + maxMs;
  while (typeof Mediabunny === 'undefined' && performance.now() < deadline) {
    await new Promise((r) => setTimeout(r, 50));
  }
  return typeof Mediabunny !== 'undefined';
}

async function toggleVideoRecording() {
  if (recordingState === 'idle') await startVideoRecording();
  else if (recordingState === 'recording') recordingState = 'finalizing';
}

// H.264 level (hex byte for the codec string) that covers the given size at 30 fps.
function avcLevelHex(w, h) {
  const mbs = Math.ceil(w / 16) * Math.ceil(h / 16);
  if (mbs <= 3600) return '1f';  // <= 1280x720  -> level 3.1
  if (mbs <= 8192) return '28';  // <= 1920x1080 -> level 4.0
  if (mbs <= 22080) return '33'; // <= 3840x2160 -> level 5.1
  return '34';                   // level 5.2
}

// Constrained Baseline profile string -> widest H.264 player support.
function constrainedBaselineCodecString(w, h) {
  return 'avc1.42E0' + avcLevelHex(w, h);
}

async function startVideoRecording() {
  if (typeof Mediabunny === 'undefined' && !(await waitForMediabunny())) {
    showRecordNotice('Video export unavailable (mediabunny not loaded)');
    return;
  }
  if (!mainCanvas?.elt) {
    showRecordNotice('Canvas not ready');
    return;
  }

  const {
    Output,
    Mp4OutputFormat,
    WebMOutputFormat,
    BufferTarget,
    CanvasSource,
    getFirstEncodableVideoCodec,
    canEncodeVideo,
  } = Mediabunny;

  const el = mainCanvas.elt;
  const w = el.width;
  const h = el.height;

  let codec;
  try {
    codec = await getFirstEncodableVideoCodec(
      ['avc', 'vp9', 'vp8'],
      { width: w, height: h, bitrate: RECORD_BITRATE },
    );
  } catch (err) {
    console.error('Codec probe failed:', err);
    showRecordNotice('Video encoder check failed');
    return;
  }

  if (!codec) {
    showRecordNotice('No supported video encoder in this browser');
    return;
  }

  recordFileExt = codec === 'avc' ? 'mp4' : 'webm';
  const format = codec === 'avc'
    ? new Mp4OutputFormat({ fastStart: 'in-memory' })
    : new WebMOutputFormat();

  // For MP4, pin H.264 to Constrained Baseline for maximum player compatibility,
  // but only if the browser's encoder actually supports that exact profile.
  const sourceOpts = { codec, bitrate: RECORD_BITRATE };
  if (codec === 'avc') {
    const baselineString = constrainedBaselineCodecString(w, h);
    try {
      if (typeof canEncodeVideo === 'function'
        && await canEncodeVideo('avc', { width: w, height: h, bitrate: RECORD_BITRATE, fullCodecString: baselineString })) {
        sourceOpts.fullCodecString = baselineString;
      }
    } catch (err) {
      console.warn('Baseline profile check failed, using default H.264 profile:', err);
    }
  }

  try {
    videoOutput = new Output({ format, target: new BufferTarget() });
    videoSource = new CanvasSource(el, sourceOpts);
    videoOutput.addVideoTrack(videoSource, { frameRate: RECORD_FPS });
    await videoOutput.start();
  } catch (err) {
    console.error('Failed to start video output:', err);
    videoOutput = null;
    videoSource = null;
    showRecordNotice('Could not start video recording');
    return;
  }

  recordFrameIndex = 0;
  recordVirtualMs = typeof millis === 'function' ? millis() : 0;
  recordWallStartMs = performance.now();
  recordingState = 'recording';
  showRecordIndicator();

  if (typeof noLoop === 'function') noLoop();
  captureLoop();
}

async function captureLoop() {
  const dt = 1000 / RECORD_FPS;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  while (recordingState === 'recording') {
    const t0 = performance.now();
    try {
      redraw();
      await videoSource.add(recordFrameIndex / RECORD_FPS, 1 / RECORD_FPS);
    } catch (err) {
      console.error('Frame capture failed:', err);
      recordingState = 'finalizing';
      showRecordNotice('Recording stopped due to an error');
      break;
    }
    recordFrameIndex++;
    recordVirtualMs += dt;
    updateRecordIndicator();
    await sleep(Math.max(0, dt - (performance.now() - t0)));
  }

  await finalizeVideoRecording();
}

async function finalizeVideoRecording() {
  if (!videoOutput) {
    recordingState = 'idle';
    hideRecordIndicator();
    if (typeof loop === 'function') loop();
    return;
  }

  setRecordIndicatorEncoding();

  try {
    if (recordFrameIndex === 0) {
      showRecordNotice('No frames recorded');
      await videoOutput.cancel();
      return;
    }
    await videoOutput.finalize();
    const buffer = videoOutput.target.buffer;
    if (!buffer || buffer.byteLength === 0) {
      showRecordNotice('Video export produced an empty file');
      return;
    }
    const mimeType = videoOutput.format.mimeType || (recordFileExt === 'mp4' ? 'video/mp4' : 'video/webm');
    downloadVideoBlob(new Blob([buffer], { type: mimeType }), recordFileExt);
  } catch (err) {
    console.error('Video finalize failed:', err);
    showRecordNotice('Video export failed');
    try {
      if (videoOutput?.state !== 'canceled' && videoOutput?.state !== 'finalized') {
        await videoOutput.cancel();
      }
    } catch { /* ignore */ }
  } finally {
    recordingState = 'idle';
    videoOutput = null;
    videoSource = null;
    if (typeof loop === 'function') loop();
    if (!recordNoticeTimeout) hideRecordIndicator();
  }
}

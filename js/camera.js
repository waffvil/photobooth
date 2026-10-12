// Camera, uploads and the little sounds a booth makes.

let stream = null;

export const hasCamera = () => !!navigator.mediaDevices?.getUserMedia;

export async function openCamera(video, facing = 'user') {
  closeCamera();
  stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1440 } },
  });
  video.srcObject = stream;
  video.muted = true;
  video.setAttribute('playsinline', '');
  await video.play().catch(() => {});
  if (!video.videoWidth) await new Promise((r) => video.addEventListener('loadedmetadata', r, { once: true }));
  return stream;
}

export function closeCamera() {
  if (stream) stream.getTracks().forEach((t) => t.stop());
  stream = null;
}

const MAX_SIDE = 1600;

// Full-res still from the live feed. Mirrored for the selfie camera, so the photo
// matches what you saw while posing (the way real booths print).
export function grabFrame(video, mirror) {
  const vw = video.videoWidth, vh = video.videoHeight;
  const k = Math.min(1, MAX_SIDE / Math.max(vw, vh));
  const c = document.createElement('canvas');
  c.width = Math.round(vw * k); c.height = Math.round(vh * k);
  const g = c.getContext('2d');
  if (mirror) { g.translate(c.width, 0); g.scale(-1, 1); }
  g.drawImage(video, 0, 0, c.width, c.height);
  return c;
}

export async function fileToCanvas(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const k = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// --- sound -------------------------------------------------------------------
let ac = null;
export function unlockAudio() {
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === 'suspended') ac.resume();
  } catch { ac = null; }
}

export function beep(freq = 880, dur = 0.08, vol = 0.15) {
  if (!ac) return;
  const o = ac.createOscillator(), g = ac.createGain();
  o.frequency.value = freq;
  o.type = 'sine';
  g.gain.setValueAtTime(vol, ac.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
  o.connect(g).connect(ac.destination);
  o.start();
  o.stop(ac.currentTime + dur);
}

export function shutter() {
  if (!ac) return;
  const len = Math.floor(ac.sampleRate * 0.12);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  const src = ac.createBufferSource(), g = ac.createGain(), f = ac.createBiquadFilter();
  f.type = 'highpass'; f.frequency.value = 1200;
  g.gain.value = 0.35;
  src.buffer = buf;
  src.connect(f).connect(g).connect(ac.destination);
  src.start();
}

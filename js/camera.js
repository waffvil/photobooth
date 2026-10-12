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
// Everything is synthesised with Web Audio: no sound files to load or license.
let ac = null;
let master = null;
let noiseBuf = null;

export function unlockAudio() {
  try {
    if (!ac) {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain();
      master.gain.value = 0.9;
      // a touch of compression keeps the clicks crisp without clipping
      const comp = ac.createDynamicsCompressor();
      comp.threshold.value = -18; comp.ratio.value = 4;
      master.connect(comp).connect(ac.destination);
    }
    if (ac.state === 'suspended') ac.resume();
  } catch { ac = null; }
}
const ready = () => ac && ac.state === 'running';

function noise() {
  if (!noiseBuf) {
    const len = Math.floor(ac.sampleRate * 0.5);
    noiseBuf = ac.createBuffer(1, len, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  const src = ac.createBufferSource();
  src.buffer = noiseBuf;
  return src;
}

// One short filtered burst of noise: the building block of every click.
function tick(t, freq, vol, dur, q = 1.2, type = 'bandpass') {
  const src = noise(), f = ac.createBiquadFilter(), g = ac.createGain();
  f.type = type; f.frequency.value = freq; f.Q.value = q;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.0015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t, Math.random() * 0.4);
  src.stop(t + dur + 0.02);
}

function thump(t, from, to, vol, dur) {
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(from, t);
  o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.003);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t); o.stop(t + dur + 0.02);
}

// The old-browser "navigation" click, a two-part "tick-um": a bright tick, then a
// softer, lower "um" that rounds off just after it.
export function click() {
  if (!ready()) return;
  const t = ac.currentTime + 0.001;
  // tick
  tick(t, 5500, 1.5, 0.008, 1.2);
  tick(t, 2400, 1.9, 0.012, 3);
  // um
  const u = t + 0.022;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = 'triangle';
  o.frequency.setValueAtTime(560, u);
  o.frequency.exponentialRampToValueAtTime(360, u + 0.09);
  g.gain.setValueAtTime(0.0001, u);
  g.gain.exponentialRampToValueAtTime(0.27, u + 0.007);
  g.gain.exponentialRampToValueAtTime(0.0001, u + 0.1);
  o.connect(g).connect(master);
  o.start(u); o.stop(u + 0.12);
  tick(u, 700, 1.5, 0.06, 5);
}

// A round digicam beep: soft attack, a quiet octave on top, gentle tail.
export function beep(freq = 1318, dur = 0.12, vol = 0.22) {
  if (!ready()) return;
  const t = ac.currentTime + 0.001;
  for (const [mult, v, type] of [[1, vol, 'sine'], [2, vol * 0.18, 'sine'], [1, vol * 0.12, 'triangle']]) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.value = freq * mult;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v, t + 0.008);
    g.gain.setValueAtTime(v, t + dur * 0.55);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  }
}

// The two quick high beeps a camera makes when focus locks.
export function focusBeep() {
  if (!ready()) return;
  beep(2093, 0.06, 0.16);
  setTimeout(() => beep(2093, 0.07, 0.16), 95);
}

// A mechanical shutter: "ka-chick", two clicks with a small body thump.
export function shutter() {
  if (!ready()) return;
  const t = ac.currentTime + 0.001;
  tick(t, 2600, 1.1, 0.035, 0.9);
  tick(t, 6500, 0.35, 0.012, 0.7, 'highpass');
  thump(t, 170, 60, 0.4, 0.07);
  tick(t + 0.075, 1700, 1.2, 0.05, 0.8);
  tick(t + 0.075, 5200, 0.4, 0.016, 0.7, 'highpass');
  thump(t + 0.075, 140, 50, 0.35, 0.08);
}

// Real digital cameras and phones (photos, cut out). Each device is a "layout" with one slot
// (its screen): the shoot screen shows the live camera there, the export puts the
// photo there, with the device's own screen overlay on top.
import { frameById, paintFrame } from './frames.js';

const LCD = '"VT323", ui-monospace, monospace';

// Body finishes. Patterned ones reuse the frame painters; the rest are gradients.
export const SKINS = {
  lace: { bg: ['#9A6AC4', '#2A1240'], frame: 'lace', btn: '#EDE3FF' },
  chrome: { bg: ['#C3C9D6', '#4A5263'], frame: 'chrome', btn: '#FFFFFF' },
  candy: { bg: ['#FF9ACB', '#8E2459'], frame: 'candy', btn: '#FFE3F1' },
  midnight: { bg: ['#3A3A4C', '#07070B'], stops: ['#45454F', '#1B1B22', '#0C0C11'], btn: '#C6FF4D', dark: true },
  mint: { bg: ['#7FDDBC', '#14523F'], stops: ['#E2FFF4', '#A2EBD1', '#6ED3B0'], btn: '#FFFFFF' },
  dream: { bg: ['#86BAFF', '#F07AB6'], frame: 'dream', btn: '#FFFFFF' },
};

// --- drawing helpers ----------------------------------------------------------------

function rr(ctx, x, y, w, h, r) {
  const [tl, tr, br, bl] = Array.isArray(r) ? r : [r, r, r, r];
  ctx.beginPath();
  ctx.moveTo(x + tl, y);
  ctx.lineTo(x + w - tr, y); ctx.quadraticCurveTo(x + w, y, x + w, y + tr);
  ctx.lineTo(x + w, y + h - br); ctx.quadraticCurveTo(x + w, y + h, x + w - br, y + h);
  ctx.lineTo(x + bl, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - bl);
  ctx.lineTo(x, y + tl); ctx.quadraticCurveTo(x, y, x + tl, y);
  ctx.closePath();
}

export const DEVICES = {};

// --- real devices (photos from Wikimedia Commons, cut out, screen straightened) ----------
const REAL = [
  { id: 'ixus', charm: { a: [1.0, 0.3], d: [0.06, 0.55], size: 0.16 }, name: 'Canon IXUS', kind: 'camera', src: 'assets/devices/canon-ixus-70.webp', W: 1400, H: 949, screen: { x: 167, y: 284, w: 800, h: 556 },
    credit: { what: 'Canon IXUS 70', author: 'David Gerard', license: 'Public domain', url: 'https://commons.wikimedia.org/wiki/File:Canon_Ixus_70_back.jpg' } },
  { id: 'cybershot', charm: { a: [1.0, 0.42], d: [0.06, 0.5], size: 0.16 }, name: 'Cyber-shot', kind: 'camera', src: 'assets/devices/sony-cyber-shot-t33.webp', W: 1400, H: 895, screen: { x: 105, y: 180, w: 757, h: 553 },
    credit: { what: 'Sony Cyber-shot DSC-T33', author: 'DavidIvar', license: 'CC BY-SA 4.0', url: 'https://commons.wikimedia.org/wiki/File:SONY-Cyber-shot-dsc-T33-back.jpg' } },
  { id: 'razr', charm: { a: [0.1, 0.02], d: [-0.2, 0.7], size: 0.24 }, name: 'RAZR', kind: 'phone', src: 'assets/devices/motorola-razr-v3-silver.webp', W: 379, H: 942, screen: { x: 58, y: 86, w: 245, h: 276 },
    credit: { what: 'Motorola RAZR V3', author: 'Steve Jurvetson', license: 'CC BY 2.0', url: 'https://commons.wikimedia.org/wiki/File:RAZR_silver_plainbg.jpg' } },
  { id: 'razrwhite', charm: { a: [0.12, 0.02], d: [-0.2, 0.7], size: 0.24 }, name: 'RAZR white', kind: 'phone', src: 'assets/devices/motorola-razr-v3-white.webp', W: 332, H: 953, screen: { x: 58, y: 104, w: 218, h: 275 },
    credit: { what: 'Motorola RAZR V3 (white)', author: 'Raimond Spekking', license: 'CC BY-SA 4.0', url: 'https://commons.wikimedia.org/wiki/File:Motorola_Razr_V3_montage_closed_open.png' } },
  { id: 'nokia', charm: { a: [0.1, 0.01], d: [-0.2, 0.72], size: 0.22 }, name: 'Nokia flip', kind: 'phone', src: 'assets/devices/nokia-2760.webp', W: 685, H: 2400, screen: { x: 118, y: 227, w: 453, h: 576 },
    credit: { what: 'Nokia 2760', author: 'AnVuong1222004', license: 'CC BY-SA 4.0', url: 'https://commons.wikimedia.org/wiki/File:Nokia_2760_open.png' } },
];

const images = {};
let loading = null;
// Fetch the real-device photos once (only when digicam mode is used).
export function loadDeviceImages() {
  if (!loading) {
    loading = Promise.all(REAL.map((d) => new Promise((resolve) => {
      const img = new Image();
      img.onload = () => { images[d.id] = img; resolve(); };
      img.onerror = () => resolve();
      img.src = d.src;
    })));
  }
  return loading;
}

for (const d of REAL) {
  DEVICES[d.id] = {
    ...d, real: true,
    pad: Math.round(Math.max(d.W, d.H) * 0.12),
    exportScale: 1700 / (Math.max(d.W, d.H) * 1.24),
    draw(ctx, s, skin, tint) {
      const img = tinted(this.id, tint);
      ctx.save();
      if (img) {
        ctx.shadowColor = 'rgba(0,0,0,.45)';
        ctx.shadowBlur = Math.max(this.W, this.H) * 0.03 * s;
        ctx.shadowOffsetY = Math.max(this.W, this.H) * 0.015 * s;
        ctx.drawImage(img, 0, 0, this.W * s, this.H * s);
      } else {
        rr(ctx, 0, 0, this.W * s, this.H * s, Math.min(this.W, this.H) * 0.08 * s);
        ctx.fillStyle = 'rgba(255,255,255,.25)';
        ctx.fill();
      }
      ctx.restore();
    },
  };
}

// --- recolouring real devices -------------------------------------------------------------
export const TINTS = [
  { id: 'original', name: 'Original' },
  { id: 'pink', name: 'Pink', c: '#FF9CC8' },
  { id: 'hotpink', name: 'Hot pink', c: '#FF3D9A' },
  { id: 'lilac', name: 'Lilac', c: '#B79BFF' },
  { id: 'baby', name: 'Baby blue', c: '#8EC8FF' },
  { id: 'mint', name: 'Mint', c: '#7FE3C0' },
  { id: 'butter', name: 'Butter', c: '#FFD86B' },
  { id: 'black', name: 'Black', c: '#2A2A33', dark: true },
];
const tintCache = new Map();
// The photo recoloured: hue/saturation from the tint, shading from the photo, alpha kept.
function tinted(id, tintId) {
  const img = images[id];
  const t = TINTS.find((x) => x.id === tintId);
  if (!img || !t || !t.c) return img;
  const key = `${id}|${tintId}`;
  if (tintCache.has(key)) return tintCache.get(key);
  const c = document.createElement('canvas');
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  if (t.dark) {
    g.globalCompositeOperation = 'multiply';
    g.fillStyle = '#5A5A66';
    g.fillRect(0, 0, c.width, c.height);
  }
  g.globalCompositeOperation = 'color';
  g.fillStyle = t.c;
  g.fillRect(0, 0, c.width, c.height);
  if (!t.dark) {
    g.globalCompositeOperation = 'soft-light';
    g.fillStyle = 'rgba(255,255,255,.35)';
    g.fillRect(0, 0, c.width, c.height);
  }
  g.globalCompositeOperation = 'destination-in';
  g.drawImage(img, 0, 0);
  tintCache.set(key, c);
  return c;
}

// --- phone charms on a beaded strap -----------------------------------------------------
export const CHARMS = ['none', '🍓', '🐰', '💖', '🧸', '🍒', '⭐', '🎀', '🌸', '🐱', '🦋', '🍰'];
const BEADS = ['#FF8FC0', '#FFFFFF', '#B79BFF', '#FFE07A', '#8EC8FF', '#FFFFFF', '#7FE3C0'];
const EMOJI = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';

function drawCharm(ctx, d, s, charm) {
  if (!charm || charm === 'none' || !d.charm) return;
  const u = Math.min(d.W, d.H);
  const ax = d.charm.a[0] * d.W, ay = d.charm.a[1] * d.H;
  const ex = ax + d.charm.d[0] * u, ey = ay + d.charm.d[1] * u;
  const cx = ax + (ex - ax) * 0.15, cy = ey - u * 0.05;
  const at = (t) => [(1 - t) * (1 - t) * ax + 2 * (1 - t) * t * cx + t * t * ex, (1 - t) * (1 - t) * ay + 2 * (1 - t) * t * cy + t * t * ey];
  ctx.save();
  // the cord
  ctx.strokeStyle = 'rgba(255,255,255,.9)';
  ctx.lineWidth = u * 0.006 * s;
  ctx.beginPath(); ctx.moveTo(ax * s, ay * s); ctx.quadraticCurveTo(cx * s, cy * s, ex * s, ey * s); ctx.stroke();
  // the loop at the device
  ctx.strokeStyle = '#C9CDD6'; ctx.lineWidth = u * 0.008 * s;
  ctx.beginPath(); ctx.arc(ax * s, ay * s, u * 0.018 * s, 0, Math.PI * 2); ctx.stroke();
  // beads
  const n = 9;
  for (let i = 1; i < n; i++) {
    const [x, y] = at(i / n);
    const r = u * (i % 3 === 0 ? 0.034 : 0.026) * s;
    const g = ctx.createRadialGradient(x * s - r * 0.35, y * s - r * 0.35, r * 0.1, x * s, y * s, r);
    g.addColorStop(0, '#FFFFFF'); g.addColorStop(0.35, BEADS[i % BEADS.length]); g.addColorStop(1, 'rgba(0,0,0,.25)');
    ctx.fillStyle = g;
    ctx.shadowColor = 'rgba(0,0,0,.25)'; ctx.shadowBlur = r * 0.6; ctx.shadowOffsetY = r * 0.3;
    ctx.beginPath(); ctx.arc(x * s, y * s, r, 0, Math.PI * 2); ctx.fill();
  }
  // the charm itself
  const px = u * d.charm.size * s;
  ctx.shadowColor = 'rgba(0,0,0,.3)'; ctx.shadowBlur = px * 0.12; ctx.shadowOffsetY = px * 0.06;
  ctx.font = `${px}px ${EMOJI}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.translate(ex * s, ey * s - px * 0.08);
  ctx.rotate(d.charm.d[0] < 0 ? 0.12 : -0.12);
  ctx.fillText(charm, 0, 0);
  ctx.restore();
}

// --- backgrounds behind the device ------------------------------------------------------
export const BACKDROPS = ['soft', 'picnic', 'hearts', 'checker', 'candy', 'polka', 'bows', 'cherry', 'dream', 'lace', 'stars', 'cyber'];

export const DEVICE_ORDER = ['ixus', 'cybershot', 'razr', 'razrwhite', 'nokia'];

// One slot per device: the screen.
export const DEVICE_PAD = 70;
const padOf = (d) => d.pad ?? DEVICE_PAD;
export function deviceLayouts() {
  const out = {};
  for (const [id, d] of Object.entries(DEVICES)) {
    const P = padOf(d);
    const sc = d.screen;
    out[`dev-${id}`] = {
      id: `dev-${id}`, name: d.name, hint: d.kind, device: id,
      W: d.W + P * 2, H: d.H + P * 2, slots: [{ x: sc.x + P, y: sc.y + P, w: sc.w, h: sc.h }], footer: { y: d.H + P * 2, h: 0 },
      shots: 1, exportScale: d.exportScale ?? 1.4, caption: 0, date: 0,
    };
  }
  return out;
}

// The bit of on-screen UI that makes it read as "on the camera / phone".
// info: { index, total, date }
export function drawScreenHud(ctx, deviceId, x, y, w, h, info = {}) {
  const d = DEVICES[deviceId];
  const u = h / 100;
  const date = info.date || new Date();
  ctx.save();
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,.8)';
  ctx.shadowBlur = u * 0.8;
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `${u * 7.5}px ${LCD}`;
  if (d.kind === 'camera') {
    ctx.textAlign = 'left';
    ctx.fillText(`▶ 100-${String(1 + (info.index || 0)).padStart(4, '0')}`, x + w * 0.035, y + u * 7);
    battery(ctx, x + w - u * 13, y + u * 3.5, u * 9, u * 5);
    ctx.textAlign = 'left';
    ctx.font = `${u * 6}px ${LCD}`;
    ctx.fillText(`${(info.index || 0) + 1}/${info.total || 1}`, x + w * 0.035, y + h - u * 6);
  } else {
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(10,20,40,.55)';
    ctx.fillRect(x, y, w, u * 8);
    ctx.fillRect(x, y + h - u * 8, w, u * 8);
    ctx.fillStyle = '#FFFFFF';
    for (let i = 0; i < 4; i++) ctx.fillRect(x + u * (2.5 + i * 2), y + u * (6 - i * 1.2), u * 1.3, u * (1 + i * 1.2));
    ctx.textAlign = 'center';
    const p = (n) => String(n).padStart(2, '0');
    ctx.fillText(`${p(date.getHours())}:${p(date.getMinutes())}`, x + w / 2, y + u * 4.2);
    battery(ctx, x + w - u * 12, y + u * 1.6, u * 9, u * 4.8);
    ctx.font = `${u * 6}px ${LCD}`;
    ctx.textAlign = 'left'; ctx.fillText('Options', x + u * 3, y + h - u * 4);
    ctx.textAlign = 'right'; ctx.fillText('Back', x + w - u * 3, y + h - u * 4);
  }
  ctx.restore();
}

function battery(ctx, x, y, w, h) {
  ctx.save();
  ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = h * 0.14;
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(x + w, y + h * 0.3, h * 0.2, h * 0.4);
  ctx.fillStyle = '#8CFF6A';
  const bw = (w - h * 0.5) / 3;
  for (let i = 0; i < 3; i++) ctx.fillRect(x + h * 0.2 + i * (bw + h * 0.05), y + h * 0.2, bw - h * 0.05, h * 0.6);
  ctx.restore();
}

// LCD glass: a soft diagonal glare.
export function drawGlare(ctx, x, y, w, h) {
  ctx.save();
  const g = ctx.createLinearGradient(x, y, x + w * 0.6, y + h);
  g.addColorStop(0, 'rgba(255,255,255,.18)');
  g.addColorStop(0.4, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

// Backdrop + device body, for a canvas sized to the device layout at scale s.
// opts: { backdrop: false | 'soft' | <frame id>, tint, charm }
export function drawDevice(ctx, deviceId, skinId, s, { backdrop = 'soft', tint = 'original', charm = 'none' } = {}) {
  const d = DEVICES[deviceId];
  const skin = SKINS[skinId] || SKINS.chrome;
  const P = padOf(d);
  const W = (d.W + P * 2) * s, H = (d.H + P * 2) * s;
  if (backdrop && backdrop !== 'soft') {
    paintFrame(ctx, frameById(backdrop), W, H, Math.min(W, H) / 600, 1.4);
  } else if (backdrop) {
    const g = ctx.createRadialGradient(W / 2, H * 0.3, 0, W / 2, H * 0.3, Math.max(W, H) * 0.8);
    g.addColorStop(0, skin.bg[0]); g.addColorStop(1, skin.bg[1]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.save();
  ctx.translate(P * s, P * s);
  d.draw.call(d, ctx, s, skin, tint);
  drawCharm(ctx, d, s, charm);
  ctx.restore();
}

// Digital cameras and phones, drawn in code. Each device is a "layout" with one slot
// (its screen): the shoot screen shows the live camera there, the export puts the
// photo there, with the device's own screen overlay on top.
import { frameById, paintFrame } from './frames.js';

const LCD = '"VT323", ui-monospace, monospace';
const PIXEL = '"Silkscreen", "VT323", monospace';

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

// The device shell: skin, then a top light / bottom shade so it reads as plastic.
function shell(ctx, s, skin, W, H, x, y, w, h, r) {
  ctx.save();
  rr(ctx, x * s, y * s, w * s, h * s, Array.isArray(r) ? r.map((v) => v * s) : r * s);
  ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 30 * s; ctx.shadowOffsetY = 14 * s;
  ctx.fillStyle = '#000';
  ctx.fill();
  ctx.restore();

  ctx.save();
  rr(ctx, x * s, y * s, w * s, h * s, Array.isArray(r) ? r.map((v) => v * s) : r * s);
  ctx.clip();
  if (skin.frame) paintFrame(ctx, frameById(skin.frame), W * s, H * s, s * 0.8, 1);
  else {
    const g = ctx.createLinearGradient(0, y * s, 0, (y + h) * s);
    skin.stops.forEach((c, i) => g.addColorStop(i / (skin.stops.length - 1), c));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W * s, H * s);
  }
  const sh = ctx.createLinearGradient(0, y * s, 0, (y + h) * s);
  sh.addColorStop(0, 'rgba(255,255,255,.45)');
  sh.addColorStop(0.12, 'rgba(255,255,255,.08)');
  sh.addColorStop(0.75, 'rgba(0,0,0,0)');
  sh.addColorStop(1, 'rgba(0,0,0,.28)');
  ctx.fillStyle = sh;
  ctx.fillRect(0, 0, W * s, H * s);
  ctx.restore();

  ctx.save();
  rr(ctx, x * s, y * s, w * s, h * s, Array.isArray(r) ? r.map((v) => v * s) : r * s);
  ctx.lineWidth = 3 * s;
  ctx.strokeStyle = 'rgba(0,0,0,.28)';
  ctx.stroke();
  rr(ctx, (x + 4) * s, (y + 4) * s, (w - 8) * s, (h - 8) * s, (Array.isArray(r) ? Math.max(...r) : r) * s * 0.92);
  ctx.lineWidth = 2 * s;
  ctx.strokeStyle = 'rgba(255,255,255,.35)';
  ctx.stroke();
  ctx.restore();
}

function metal(ctx, s, x, y, w, h, r, tint = '#FFFFFF') {
  ctx.save();
  rr(ctx, x * s, y * s, w * s, h * s, r * s);
  const g = ctx.createLinearGradient(0, y * s, 0, (y + h) * s);
  g.addColorStop(0, '#FFFFFF'); g.addColorStop(0.45, tint); g.addColorStop(1, '#9298A4');
  ctx.fillStyle = g;
  ctx.shadowColor = 'rgba(0,0,0,.3)'; ctx.shadowBlur = 5 * s; ctx.shadowOffsetY = 2 * s;
  ctx.fill();
  ctx.restore();
}

function knob(ctx, s, cx, cy, r, tint = '#E6E9EF') {
  ctx.save();
  ctx.beginPath(); ctx.arc(cx * s, cy * s, r * s, 0, Math.PI * 2);
  const g = ctx.createRadialGradient(cx * s, (cy - r * 0.4) * s, r * 0.1 * s, cx * s, cy * s, r * s);
  g.addColorStop(0, '#FFFFFF'); g.addColorStop(0.6, tint); g.addColorStop(1, '#8D93A0');
  ctx.fillStyle = g;
  ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 8 * s; ctx.shadowOffsetY = 3 * s;
  ctx.fill();
  ctx.restore();
}

function glyph(ctx, s, text, x, y, px, color = '#444', font = PIXEL, align = 'center') {
  ctx.save();
  ctx.font = `${px * s}px ${font}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x * s, y * s);
  ctx.restore();
}

function bezel(ctx, s, x, y, w, h, r) {
  ctx.save();
  rr(ctx, x * s, y * s, w * s, h * s, r * s);
  ctx.fillStyle = '#0A0A0D';
  ctx.fill();
  ctx.lineWidth = 3 * s;
  ctx.strokeStyle = 'rgba(255,255,255,.35)';
  ctx.stroke();
  ctx.restore();
}

function speaker(ctx, s, x, y, cols, rows, gap, r, dark) {
  ctx.save();
  ctx.fillStyle = dark ? 'rgba(255,255,255,.35)' : 'rgba(0,0,0,.45)';
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    ctx.beginPath(); ctx.arc((x + i * gap) * s, (y + j * gap) * s, r * s, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function key(ctx, s, x, y, w, h, label, sub, skin) {
  metal(ctx, s, x, y, w, h, h / 2, skin.btn);
  glyph(ctx, s, label, x + w * 0.36, y + h / 2, h * 0.46, '#2B2B33', LCD);
  if (sub) glyph(ctx, s, sub, x + w * 0.68, y + h / 2 + 1, h * 0.26, '#6B6F7A', LCD);
}

function keypad(ctx, s, x0, y0, kw, kh, gx, gy, skin) {
  const keys = [['1', ''], ['2', 'abc'], ['3', 'def'], ['4', 'ghi'], ['5', 'jkl'], ['6', 'mno'], ['7', 'pqrs'], ['8', 'tuv'], ['9', 'wxyz'], ['*', ''], ['0', '+'], ['#', '']];
  keys.forEach(([k, sub], i) => key(ctx, s, x0 + (i % 3) * (kw + gx), y0 + Math.floor(i / 3) * (kh + gy), kw, kh, k, sub, skin));
}

// --- the devices ------------------------------------------------------------------------

export const DEVICES = {
  compact: {
    name: 'Digicam', kind: 'camera',
    W: 1000, H: 660, screen: { x: 75, y: 112, w: 610, h: 458 },
    draw(ctx, s, skin) {
      metal(ctx, s, 690, 12, 120, 44, 14);
      metal(ctx, s, 545, 22, 92, 32, 10);
      shell(ctx, s, skin, this.W, this.H, 20, 40, 960, 600, 80);
      bezel(ctx, s, 58, 95, 644, 492, 28);
      metal(ctx, s, 745, 118, 74, 40, 20, skin.btn); glyph(ctx, s, '▶', 782, 138, 20, '#333', 'sans-serif');
      metal(ctx, s, 840, 118, 74, 40, 20, skin.btn); glyph(ctx, s, '●', 877, 138, 18, '#C0392B', 'sans-serif');
      speaker(ctx, s, 770, 210, 6, 3, 22, 5, skin.dark);
      knob(ctx, s, 830, 410, 108, skin.btn);
      ctx.save(); ctx.fillStyle = 'rgba(0,0,0,.35)';
      for (const [dx, dy, rot] of [[0, -76, 0], [76, 0, 1], [0, 76, 2], [-76, 0, 3]]) {
        ctx.save(); ctx.translate((830 + dx) * s, (410 + dy) * s); ctx.rotate((rot * Math.PI) / 2);
        ctx.beginPath(); ctx.moveTo(0, -10 * s); ctx.lineTo(10 * s, 6 * s); ctx.lineTo(-10 * s, 6 * s); ctx.closePath(); ctx.fill(); ctx.restore();
      }
      ctx.restore();
      knob(ctx, s, 830, 410, 42, skin.btn);
      knob(ctx, s, 830, 572, 26, skin.btn);
      glyph(ctx, s, 'MENU', 762, 572, 15, skin.dark ? '#ddd' : '#555');
    },
  },
  slim: {
    name: 'Slim cam', kind: 'camera',
    W: 1000, H: 600, screen: { x: 66, y: 82, w: 660, h: 440 },
    draw(ctx, s, skin) {
      metal(ctx, s, 760, 8, 150, 34, 14);
      glyph(ctx, s, 'W   T', 835, 25, 16, '#555');
      shell(ctx, s, skin, this.W, this.H, 20, 30, 960, 540, 46);
      bezel(ctx, s, 52, 68, 688, 468, 16);
      // mode slider
      ctx.save(); rr(ctx, 790 * s, 96 * s, 130 * s, 46 * s, 23 * s); ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fill(); ctx.restore();
      knob(ctx, s, 818, 119, 19, skin.btn);
      glyph(ctx, s, '◘  ▶', 875, 119, 15, skin.dark ? '#ddd' : '#444', 'sans-serif');
      for (const [cx, cy] of [[805, 220], [895, 220], [805, 300], [895, 300]]) knob(ctx, s, cx, cy, 24, skin.btn);
      knob(ctx, s, 850, 440, 76, skin.btn);
      knob(ctx, s, 850, 440, 32, skin.btn);
      glyph(ctx, s, 'slim 2000', 850, 548, 15, skin.dark ? '#bbb' : 'rgba(0,0,0,.45)');
    },
  },
  flip: {
    name: 'Flip phone', kind: 'phone',
    W: 600, H: 1360, screen: { x: 80, y: 132, w: 440, h: 587 },
    draw(ctx, s, skin) {
      shell(ctx, s, skin, this.W, this.H, 30, 830, 540, 510, [30, 30, 120, 120]);
      shell(ctx, s, skin, this.W, this.H, 30, 20, 540, 780, [110, 110, 34, 34]);
      ctx.save(); rr(ctx, 240 * s, 62 * s, 120 * s, 16 * s, 8 * s); ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fill(); ctx.restore();
      bezel(ctx, s, 64, 114, 472, 623, 26);
      glyph(ctx, s, 'flip', 300, 768, 18, skin.dark ? '#ccc' : 'rgba(0,0,0,.4)');
      // hinge
      ctx.save(); rr(ctx, 50 * s, 790 * s, 500 * s, 56 * s, 28 * s);
      const hg = ctx.createLinearGradient(0, 790 * s, 0, 846 * s);
      hg.addColorStop(0, '#F4F5F7'); hg.addColorStop(0.5, '#9AA0AB'); hg.addColorStop(1, '#E3E5EA');
      ctx.fillStyle = hg; ctx.fill(); ctx.restore();
      // nav + soft keys
      metal(ctx, s, 70, 880, 130, 46, 23, skin.btn);
      metal(ctx, s, 400, 880, 130, 46, 23, skin.btn);
      knob(ctx, s, 300, 935, 72, skin.btn);
      knob(ctx, s, 300, 935, 30, skin.btn);
      metal(ctx, s, 70, 950, 130, 42, 21, '#9BE59B'); glyph(ctx, s, '✆', 135, 971, 22, '#1E6B1E', 'sans-serif');
      metal(ctx, s, 400, 950, 130, 42, 21, '#F2A0A0'); glyph(ctx, s, '✆', 465, 971, 22, '#8B1E1E', 'sans-serif');
      keypad(ctx, s, 70, 1030, 140, 56, 25, 12, skin);
    },
  },
  bar: {
    name: 'Phone', kind: 'phone',
    W: 540, H: 1200, screen: { x: 85, y: 128, w: 370, h: 493 },
    draw(ctx, s, skin) {
      shell(ctx, s, skin, this.W, this.H, 30, 20, 480, 1160, 110);
      ctx.save(); rr(ctx, 210 * s, 62 * s, 120 * s, 14 * s, 7 * s); ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fill(); ctx.restore();
      bezel(ctx, s, 68, 110, 404, 529, 24);
      glyph(ctx, s, 'mobile', 270, 672, 18, skin.dark ? '#ccc' : 'rgba(0,0,0,.4)');
      metal(ctx, s, 80, 720, 110, 44, 22, skin.btn);
      metal(ctx, s, 350, 720, 110, 44, 22, skin.btn);
      knob(ctx, s, 270, 770, 70, skin.btn);
      knob(ctx, s, 270, 770, 28, skin.btn);
      metal(ctx, s, 80, 790, 110, 40, 20, '#9BE59B');
      metal(ctx, s, 350, 790, 110, 40, 20, '#F2A0A0');
      keypad(ctx, s, 80, 868, 116, 58, 16, 12, skin);
    },
  },
};

// --- real devices (photos from Wikimedia Commons, cut out, screen straightened) ----------
const REAL = [
  { id: 'ixus', name: 'Canon IXUS', kind: 'camera', src: 'assets/devices/canon-ixus-70.webp', W: 1400, H: 949, screen: { x: 167, y: 284, w: 800, h: 556 },
    credit: { what: 'Canon IXUS 70', author: 'David Gerard', license: 'Public domain', url: 'https://commons.wikimedia.org/wiki/File:Canon_Ixus_70_back.jpg' } },
  { id: 'cybershot', name: 'Cyber-shot', kind: 'camera', src: 'assets/devices/sony-cyber-shot-t33.webp', W: 1400, H: 895, screen: { x: 105, y: 180, w: 757, h: 553 },
    credit: { what: 'Sony Cyber-shot DSC-T33', author: 'DavidIvar', license: 'CC BY-SA 4.0', url: 'https://commons.wikimedia.org/wiki/File:SONY-Cyber-shot-dsc-T33-back.jpg' } },
  { id: 'razr', name: 'RAZR', kind: 'phone', src: 'assets/devices/motorola-razr-v3-silver.webp', W: 379, H: 942, screen: { x: 58, y: 86, w: 245, h: 276 },
    credit: { what: 'Motorola RAZR V3', author: 'Steve Jurvetson', license: 'CC BY 2.0', url: 'https://commons.wikimedia.org/wiki/File:RAZR_silver_plainbg.jpg' } },
  { id: 'razrwhite', name: 'RAZR white', kind: 'phone', src: 'assets/devices/motorola-razr-v3-white.webp', W: 332, H: 953, screen: { x: 58, y: 104, w: 218, h: 275 },
    credit: { what: 'Motorola RAZR V3 (white)', author: 'Raimond Spekking', license: 'CC BY-SA 4.0', url: 'https://commons.wikimedia.org/wiki/File:Motorola_Razr_V3_montage_closed_open.png' } },
  { id: 'nokia', name: 'Nokia flip', kind: 'phone', src: 'assets/devices/nokia-2760.webp', W: 685, H: 2400, screen: { x: 118, y: 227, w: 453, h: 576 },
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
    pad: Math.round(Math.max(d.W, d.H) * 0.07),
    exportScale: 1700 / (Math.max(d.W, d.H) * 1.14),
    draw(ctx, s) {
      const img = images[this.id];
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

export const DEVICE_ORDER = ['ixus', 'cybershot', 'razr', 'razrwhite', 'nokia', 'compact', 'slim', 'flip', 'bar'];
export const isReal = (id) => !!DEVICES[id]?.real;

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
export function drawDevice(ctx, deviceId, skinId, s, { backdrop = true } = {}) {
  const d = DEVICES[deviceId];
  const skin = SKINS[skinId] || SKINS.chrome;
  const P = padOf(d);
  const W = (d.W + P * 2) * s, H = (d.H + P * 2) * s;
  if (backdrop) {
    const g = ctx.createRadialGradient(W / 2, H * 0.3, 0, W / 2, H * 0.3, Math.max(W, H) * 0.8);
    g.addColorStop(0, skin.bg[0]); g.addColorStop(1, skin.bg[1]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.save();
  ctx.translate(P * s, P * s);
  d.draw.call(d, ctx, s, skin);
  ctx.restore();
}

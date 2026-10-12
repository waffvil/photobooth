// Frames: a paper colour, optionally a repeating pattern drawn in code (no image
// assets, so every frame stays sharp at any export size), plus the ink used for the
// footer caption and the colour an empty slot shows while you're still picking.

// --- tiny drawing helpers -------------------------------------------------------

function heart(g, cx, cy, s) {
  g.beginPath();
  g.moveTo(cx, cy + s * 0.35);
  g.bezierCurveTo(cx - s * 0.05, cy + s * 0.3, cx - s * 0.5, cy + s * 0.02, cx - s * 0.5, cy - s * 0.2);
  g.bezierCurveTo(cx - s * 0.5, cy - s * 0.45, cx - s * 0.2, cy - s * 0.52, cx, cy - s * 0.28);
  g.bezierCurveTo(cx + s * 0.2, cy - s * 0.52, cx + s * 0.5, cy - s * 0.45, cx + s * 0.5, cy - s * 0.2);
  g.bezierCurveTo(cx + s * 0.5, cy + s * 0.02, cx + s * 0.05, cy + s * 0.3, cx, cy + s * 0.35);
  g.fill();
}

function star(g, cx, cy, r, points = 5, inner = 0.45) {
  g.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const a = (Math.PI / points) * i - Math.PI / 2;
    const rr = i % 2 ? r * inner : r;
    g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  g.closePath();
  g.fill();
}

function dot(g, x, y, r) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }

function flower(g, cx, cy, r, petal, center) {
  g.fillStyle = petal;
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i;
    g.beginPath();
    g.ellipse(cx + Math.cos(a) * r * 0.55, cy + Math.sin(a) * r * 0.55, r * 0.42, r * 0.28, a, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = center;
  dot(g, cx, cy, r * 0.3);
}

function cloud(g, cx, cy, s) {
  dot(g, cx - s * 0.35, cy, s * 0.28);
  dot(g, cx, cy - s * 0.12, s * 0.38);
  dot(g, cx + s * 0.38, cy + s * 0.02, s * 0.26);
  g.fillRect(cx - s * 0.35, cy, s * 0.73, s * 0.28);
}

function cherry(g, cx, cy, s) {
  g.strokeStyle = '#4E7A3A'; g.lineWidth = s * 0.06; g.lineCap = 'round';
  g.beginPath(); g.moveTo(cx - s * 0.22, cy + s * 0.1); g.quadraticCurveTo(cx - s * 0.1, cy - s * 0.3, cx + s * 0.08, cy - s * 0.42); g.stroke();
  g.beginPath(); g.moveTo(cx + s * 0.22, cy + s * 0.14); g.quadraticCurveTo(cx + s * 0.12, cy - s * 0.2, cx + s * 0.08, cy - s * 0.42); g.stroke();
  g.fillStyle = '#4E7A3A';
  g.beginPath(); g.ellipse(cx + s * 0.2, cy - s * 0.42, s * 0.14, s * 0.06, -0.4, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#D33A4A';
  dot(g, cx - s * 0.22, cy + s * 0.2, s * 0.17);
  dot(g, cx + s * 0.22, cy + s * 0.24, s * 0.17);
  g.fillStyle = 'rgba(255,255,255,.7)';
  dot(g, cx - s * 0.27, cy + s * 0.14, s * 0.04);
  dot(g, cx + s * 0.17, cy + s * 0.18, s * 0.04);
}

function bow(g, cx, cy, s, c) {
  g.fillStyle = c;
  g.beginPath(); g.moveTo(cx, cy); g.quadraticCurveTo(cx - s * 0.55, cy - s * 0.45, cx - s * 0.5, cy + s * 0.05); g.quadraticCurveTo(cx - s * 0.45, cy + s * 0.3, cx, cy); g.fill();
  g.beginPath(); g.moveTo(cx, cy); g.quadraticCurveTo(cx + s * 0.55, cy - s * 0.45, cx + s * 0.5, cy + s * 0.05); g.quadraticCurveTo(cx + s * 0.45, cy + s * 0.3, cx, cy); g.fill();
  g.fillRect(cx - s * 0.18, cy, s * 0.08, s * 0.45);
  g.fillRect(cx + s * 0.1, cy, s * 0.08, s * 0.45);
  dot(g, cx, cy, s * 0.1);
}

function leaf(g, cx, cy, s, a, c) {
  g.save(); g.translate(cx, cy); g.rotate(a); g.fillStyle = c;
  g.beginPath(); g.moveTo(0, -s / 2); g.quadraticCurveTo(s * 0.4, 0, 0, s / 2); g.quadraticCurveTo(-s * 0.4, 0, 0, -s / 2); g.fill();
  g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = s * 0.04;
  g.beginPath(); g.moveTo(0, -s / 2); g.lineTo(0, s / 2); g.stroke();
  g.restore();
}

function snowflake(g, cx, cy, r) {
  g.lineWidth = r * 0.16; g.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const a = (Math.PI / 3) * i;
    g.beginPath();
    g.moveTo(cx - Math.cos(a) * r, cy - Math.sin(a) * r);
    g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    g.stroke();
  }
}

// deterministic "random" so a pattern looks the same in preview and export
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

// --- the catalogue --------------------------------------------------------------
// tile = pattern repeat size in layout px (scaled with the render)

const simple = (id, name, bg, slotBg, ink) => ({ id, name, pack: 'simple', bg, slotBg, ink });

export const FRAMES = [
  simple('black', 'Black', '#17181C', '#26282F', '#FFFFFF'),
  simple('white', 'White', '#FFFFFF', '#EEF0F4', '#17181C'),
  simple('cream', 'Cream', '#F3EAD3', '#E2D6B8', '#5A4A2E'),
  simple('pink', 'Pink', '#F8D7E2', '#EDBCCD', '#9C3B5E'),
  simple('blue', 'Blue', '#D2E0F8', '#B9CDF0', '#2F4F8A'),
  simple('mint', 'Mint', '#D4ECDD', '#B9DCC6', '#2F6A49'),
  simple('slate', 'Slate', '#5B6270', '#6D7584', '#FFFFFF'),

  { id: 'hearts', name: 'Hearts', pack: 'patterns', bg: '#FFF1E4', slotBg: 'rgba(255,255,255,.62)', ink: '#B5322C', tile: 120,
    draw(g, t) { g.fillStyle = '#C8362F'; heart(g, t * 0.25, t * 0.25, t * 0.3); heart(g, t * 0.75, t * 0.75, t * 0.3); } },
  { id: 'polka', name: 'Polka', pack: 'patterns', bg: '#FFF6CF', slotBg: 'rgba(255,255,255,.62)', ink: '#B8607A', tile: 60,
    draw(g, t) { g.fillStyle = '#F2B3C4'; dot(g, t * 0.25, t * 0.25, t * 0.09); dot(g, t * 0.75, t * 0.75, t * 0.09); } },
  { id: 'gingham', name: 'Gingham', pack: 'patterns', bg: '#FFFFFF', slotBg: 'rgba(255,255,255,.62)', ink: '#3E6B2F', tile: 70,
    draw(g, t) { g.fillStyle = 'rgba(112,158,88,.42)'; g.fillRect(0, 0, t / 2, t); g.fillRect(0, 0, t, t / 2); } },
  { id: 'picnic', name: 'Picnic', pack: 'patterns', bg: '#FFFFFF', slotBg: 'rgba(255,255,255,.62)', ink: '#B93A5A', tile: 70,
    draw(g, t) { g.fillStyle = 'rgba(232,96,128,.38)'; g.fillRect(0, 0, t / 2, t); g.fillRect(0, 0, t, t / 2); } },
  { id: 'checker', name: 'Checker', pack: 'patterns', bg: '#FFF8E7', slotBg: 'rgba(255,255,255,.62)', ink: '#3B5BA0', tile: 90,
    draw(g, t) { g.fillStyle = '#AFC6F2'; g.fillRect(0, 0, t / 2, t / 2); g.fillRect(t / 2, t / 2, t / 2, t / 2); } },
  { id: 'cherry', name: 'Cherry', pack: 'patterns', bg: '#FFF0F3', slotBg: 'rgba(255,255,255,.62)', ink: '#B12E3E', tile: 150,
    draw(g, t) { cherry(g, t * 0.3, t * 0.3, t * 0.42); cherry(g, t * 0.8, t * 0.82, t * 0.42); } },
  { id: 'stripes', name: 'Stripes', pack: 'patterns', bg: '#F4F8FF', slotBg: 'rgba(255,255,255,.62)', ink: '#3D5E9E', tile: 48,
    draw(g, t) { g.fillStyle = '#BCD1F5'; g.fillRect(0, 0, t / 2, t); } },
  { id: 'stars', name: 'Starry', pack: 'patterns', bg: '#1F2A4D', slotBg: 'rgba(255,255,255,.2)', ink: '#FFE27A', tile: 140,
    draw(g, t) {
      g.fillStyle = '#FFE27A'; star(g, t * 0.27, t * 0.3, t * 0.12); star(g, t * 0.76, t * 0.74, t * 0.09);
      g.fillStyle = 'rgba(255,255,255,.75)'; dot(g, t * 0.7, t * 0.2, t * 0.018); dot(g, t * 0.2, t * 0.78, t * 0.022); dot(g, t * 0.5, t * 0.52, t * 0.014);
    } },
  { id: 'clouds', name: 'Clouds', pack: 'patterns', bg: '#BFE0FF', slotBg: 'rgba(255,255,255,.62)', ink: '#FFFFFF', tile: 170,
    draw(g, t) { g.fillStyle = '#FFFFFF'; cloud(g, t * 0.3, t * 0.3, t * 0.36); cloud(g, t * 0.78, t * 0.8, t * 0.3); } },
  { id: 'daisy', name: 'Daisy', pack: 'patterns', bg: '#CFE6C6', slotBg: 'rgba(255,255,255,.62)', ink: '#3F6A35', tile: 130,
    draw(g, t) { flower(g, t * 0.28, t * 0.28, t * 0.2, '#FFFFFF', '#F5C842'); flower(g, t * 0.78, t * 0.78, t * 0.16, '#FFFFFF', '#F5C842'); } },
  { id: 'bows', name: 'Bows', pack: 'patterns', bg: '#FFE8EF', slotBg: 'rgba(255,255,255,.62)', ink: '#C44F77', tile: 140,
    draw(g, t) { bow(g, t * 0.28, t * 0.28, t * 0.3, '#F28AAE'); bow(g, t * 0.78, t * 0.78, t * 0.3, '#F28AAE'); } },
  { id: 'confetti', name: 'Confetti', pack: 'patterns', bg: '#FFFFFF', slotBg: 'rgba(255,255,255,.62)', ink: '#17181C', tile: 220,
    draw(g, t) {
      const r = rng(7), cols = ['#FF7BA3', '#5FA0FF', '#FFC94D', '#7ED6A5', '#B48CF2'];
      for (let i = 0; i < 16; i++) {
        g.save(); g.translate(r() * t, r() * t); g.rotate(r() * Math.PI);
        g.fillStyle = cols[i % cols.length]; g.fillRect(-t * 0.03, -t * 0.012, t * 0.06, t * 0.024); g.restore();
      }
    } },

  { id: 'autumn', name: 'Autumn', pack: 'seasons', bg: '#F6E7D2', slotBg: 'rgba(255,255,255,.62)', ink: '#9A4A1C', tile: 150,
    draw(g, t) {
      leaf(g, t * 0.28, t * 0.3, t * 0.3, 0.6, '#D9773A'); leaf(g, t * 0.78, t * 0.76, t * 0.26, -0.8, '#B5532A');
      leaf(g, t * 0.75, t * 0.24, t * 0.16, 2.2, '#E3A23C');
    } },
  { id: 'plaid', name: 'Plaid', pack: 'seasons', bg: '#B3262E', slotBg: 'rgba(255,255,255,.2)', ink: '#FFFFFF', tile: 120,
    draw(g, t) {
      g.fillStyle = 'rgba(20,40,30,.45)'; g.fillRect(t * 0.1, 0, t * 0.3, t); g.fillRect(0, t * 0.1, t, t * 0.3);
      g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(t * 0.68, 0, t * 0.04, t); g.fillRect(0, t * 0.68, t, t * 0.04);
    } },
  { id: 'snow', name: 'Snow', pack: 'seasons', bg: '#2E5C9A', slotBg: 'rgba(255,255,255,.2)', ink: '#FFFFFF', tile: 130,
    draw(g, t) { g.strokeStyle = '#FFFFFF'; snowflake(g, t * 0.28, t * 0.3, t * 0.1); snowflake(g, t * 0.76, t * 0.74, t * 0.07); g.fillStyle = 'rgba(255,255,255,.7)'; dot(g, t * 0.7, t * 0.2, t * 0.02); dot(g, t * 0.24, t * 0.8, t * 0.025); } },
  { id: 'spring', name: 'Blossom', pack: 'seasons', bg: '#FFF4F6', slotBg: 'rgba(255,255,255,.62)', ink: '#C25478', tile: 120,
    draw(g, t) { flower(g, t * 0.28, t * 0.28, t * 0.16, '#F7B6C8', '#FFE08A'); flower(g, t * 0.78, t * 0.76, t * 0.12, '#F7B6C8', '#FFE08A'); } },
  { id: 'summer', name: 'Summer', pack: 'seasons', bg: '#FFE9A8', slotBg: 'rgba(255,255,255,.62)', ink: '#C0582A', tile: 160,
    draw(g, t) {
      g.fillStyle = '#FF9B4A'; dot(g, t * 0.3, t * 0.3, t * 0.12);
      g.strokeStyle = '#FF9B4A'; g.lineWidth = t * 0.025; g.lineCap = 'round';
      for (let i = 0; i < 8; i++) { const a = (Math.PI / 4) * i; g.beginPath(); g.moveTo(t * 0.3 + Math.cos(a) * t * 0.17, t * 0.3 + Math.sin(a) * t * 0.17); g.lineTo(t * 0.3 + Math.cos(a) * t * 0.23, t * 0.3 + Math.sin(a) * t * 0.23); g.stroke(); }
      g.strokeStyle = '#6FB7E8'; g.lineWidth = t * 0.03;
      g.beginPath(); g.moveTo(t * 0.55, t * 0.8); g.quadraticCurveTo(t * 0.65, t * 0.72, t * 0.75, t * 0.8); g.quadraticCurveTo(t * 0.85, t * 0.88, t * 0.95, t * 0.8); g.stroke();
    } },
];

export const PACKS = [
  { id: 'simple', name: 'Simple' },
  { id: 'patterns', name: 'Patterns' },
  { id: 'seasons', name: 'Seasons' },
];

export const frameById = (id) => FRAMES.find((f) => f.id === id) || FRAMES[0];

// --- painting -------------------------------------------------------------------

const tileCache = new Map();

function tileFor(f, px) {
  const key = `${f.id}|${px}`;
  let c = tileCache.get(key);
  if (!c) {
    c = document.createElement('canvas');
    c.width = c.height = px;
    const g = c.getContext('2d');
    g.fillStyle = f.bg;
    g.fillRect(0, 0, px, px);
    f.draw(g, px);
    tileCache.set(key, c);
  }
  return c;
}

// Fill a W×H canvas (already at render scale) with the frame's paper. `unit` grows
// the pattern with the paper's short side, so a 2×2 card doesn't get tiny hearts.
export function paintFrame(ctx, f, W, H, scale, unit = 1) {
  ctx.fillStyle = f.bg;
  ctx.fillRect(0, 0, W, H);
  if (!f.draw) return;
  const px = Math.max(8, Math.round(f.tile * scale * unit));
  const pat = ctx.createPattern(tileFor(f, px), 'repeat');
  ctx.fillStyle = pat;
  ctx.fillRect(0, 0, W, H);
}

// One renderer for everything: frame thumbnails, the live previews and the final
// download all go through renderStrip, so the preview is the export at a smaller scale.
import { LAYOUTS } from './layouts.js';
import { frameById, paintFrame } from './frames.js';
import { applyFilter } from './filters.js';

export const CAPTION_FONT = '"Gowun Batang", Georgia, serif';
export const MONO_FONT = '"Space Mono", ui-monospace, monospace';
export const PIXEL_FONT = '"Silkscreen", "VT323", monospace';
export const LCD_FONT = '"VT323", ui-monospace, monospace';
export const EMOJI_FONT = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';

const cropCache = new Map();
const CACHE_MAX = 80;

function coverCrop(src, w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  const r = Math.max(w / src.width, h / src.height);
  const dw = src.width * r, dh = src.height * r;
  g.imageSmoothingQuality = 'high';
  g.drawImage(src, (w - dw) / 2, (h - dh) / 2, dw, dh);
  return c;
}

// A shot cropped to one slot size with the filter baked in, cached because the same
// crop is redrawn on every preview update.
export function photoFor(shot, w, h, filter) {
  const key = `${shot.id}|${w}x${h}|${filter}`;
  let c = cropCache.get(key);
  if (c) return c;
  c = coverCrop(shot.canvas, w, h);
  applyFilter(c, filter, shot.id + 1);
  cropCache.set(key, c);
  if (cropCache.size > CACHE_MAX) cropCache.delete(cropCache.keys().next().value);
  return c;
}

export function forgetShots() { cropCache.clear(); }

export function formatDate(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}`;
}

// Draw the decorations (stickers + doodles) onto ctx, sized for a W×H canvas.
export function drawDeco(ctx, deco, W, H) {
  if (!deco) return;
  for (const s of deco.strokes || []) drawStroke(ctx, s, W, H);
  for (const st of deco.stickers || []) {
    ctx.save();
    ctx.translate(st.x * W, st.y * H);
    ctx.rotate(st.rot || 0);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (st.word) {
      const px = Math.round(st.size * W * 0.62);
      ctx.font = `${px}px ${PIXEL_FONT}`;
      ctx.lineJoin = 'round';
      ctx.lineWidth = px * 0.3;
      ctx.strokeStyle = '#FFFFFF';
      ctx.strokeText(st.emoji, 0, 0);
      ctx.fillStyle = st.color || '#FF3EA5';
      ctx.fillText(st.emoji, 0, 0);
    } else {
      ctx.font = `${Math.round(st.size * W)}px ${EMOJI_FONT}`;
      ctx.fillText(st.emoji, 0, 0);
    }
    ctx.restore();
  }
}

export function drawStroke(ctx, s, W, H) {
  const pts = s.points;
  if (!pts.length) return;
  ctx.save();
  ctx.strokeStyle = s.color;
  ctx.fillStyle = s.color;
  ctx.lineWidth = s.width * W;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (pts.length === 1) {
    ctx.beginPath();
    ctx.arc(pts[0][0] * W, pts[0][1] * H, (s.width * W) / 2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(pts[0][0] * W, pts[0][1] * H);
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = ((pts[i][0] + pts[i + 1][0]) / 2) * W;
      const my = ((pts[i][1] + pts[i + 1][1]) / 2) * H;
      ctx.quadraticCurveTo(pts[i][0] * W, pts[i][1] * H, mx, my);
    }
    const last = pts[pts.length - 1];
    ctx.lineTo(last[0] * W, last[1] * H);
    ctx.stroke();
  }
  ctx.restore();
}

// opts: { layout, frame, photos: [shot|null per slot], filter, caption, showDate, deco }
export function renderStrip(opts, scale = 1, canvas = document.createElement('canvas')) {
  const L = LAYOUTS[opts.layout];
  const f = frameById(opts.frame);
  const W = Math.round(L.W * scale), H = Math.round(L.H * scale);
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');

  paintFrame(ctx, f, W, H, scale, Math.min(L.W, L.H) / 600);

  L.slots.forEach((sl, i) => {
    const x = Math.round(sl.x * scale), y = Math.round(sl.y * scale);
    const w = Math.round((sl.x + sl.w) * scale) - x, h = Math.round((sl.y + sl.h) * scale) - y;
    const shot = opts.photos?.[i];
    if (shot) {
      ctx.drawImage(photoFor(shot, w, h, opts.filter || 'original'), x, y);
      if (opts.stamp) drawStamp(ctx, x, y, w, h, opts.date);
    } else { ctx.fillStyle = f.slotBg; ctx.fillRect(x, y, w, h); }
  });

  // footer: the caption, and the date under it
  const caption = (opts.caption ?? '').trim();
  const fy = L.footer.y * scale, fh = L.footer.h * scale;
  const hasDate = opts.showDate;
  ctx.fillStyle = f.ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const capPx = L.caption * scale, datePx = L.date * scale;
  const gap = capPx * 0.35;
  const block = (caption ? capPx : 0) + (hasDate ? datePx : 0) + (caption && hasDate ? gap : 0);
  let cy = fy + fh / 2 - block / 2;
  // On a patterned paper the text gets a halo of the paper colour so it never
  // sits on top of a heart or a check.
  const halo = (text, x, y, px) => {
    if (!f.draw && !f.paint) return;
    ctx.save();
    ctx.strokeStyle = f.bg;
    ctx.lineJoin = 'round';
    ctx.lineWidth = px * 0.5;
    ctx.strokeText(text, x, y);
    ctx.restore();
  };
  const capFont = f.font || CAPTION_FONT;
  const capWeight = f.font ? 400 : 700;
  if (caption) {
    ctx.font = `${capWeight} ${capPx}px ${capFont}`;
    fitText(ctx, caption, W * 0.86, capPx, `${capWeight} {px}px ${capFont}`);
    halo(caption, W / 2, cy + capPx / 2, capPx);
    ctx.fillText(caption, W / 2, cy + capPx / 2);
    cy += capPx + gap;
  }
  if (hasDate) {
    ctx.font = `400 ${datePx}px ${MONO_FONT}`;
    const date = formatDate(opts.date);
    halo(date, W / 2, cy + datePx / 2, datePx * 1.6);
    ctx.globalAlpha = 0.75;
    ctx.fillText(date, W / 2, cy + datePx / 2);
    ctx.globalAlpha = 1;
  }

  if (opts.deco) drawDeco(ctx, opts.deco, W, H);
  return canvas;
}

// The orange date imprint of an early-2000s digital camera, bottom-right of a photo.
export function stampText(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `'${p(d.getFullYear() % 100)} ${p(d.getMonth() + 1)} ${p(d.getDate())}`;
}

export function drawStamp(ctx, x, y, w, h, date) {
  const px = Math.max(8, h * 0.1);
  ctx.save();
  ctx.font = `${px}px ${LCD_FONT}`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#FF9A2E';
  ctx.shadowColor = 'rgba(255,110,20,.9)';
  ctx.shadowBlur = px * 0.35;
  ctx.fillText(stampText(date), x + w - w * 0.045, y + h - h * 0.06);
  ctx.restore();
}

// shrink the font until `text` fits `maxW`
function fitText(ctx, text, maxW, px, tpl) {
  let size = px;
  while (size > 8 && ctx.measureText(text).width > maxW) {
    size *= 0.92;
    ctx.font = tpl.replace('{px}', size.toFixed(1));
  }
}

// The largest scale at which layout L fits a cssW×cssH box, and the pixel scale to
// render at for that box on this screen.
export function fit(layoutId, cssW, cssH) {
  const L = LAYOUTS[layoutId];
  const k = Math.min(cssW / L.W, cssH / L.H);
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  return { cssW: L.W * k, cssH: L.H * k, scale: Math.min(L.exportScale, k * dpr) };
}

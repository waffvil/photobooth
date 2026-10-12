// Strip-wide looks, done with plain pixel math rather than ctx.filter so they render
// identically on iOS Safari (which ignores ctx.filter) and everywhere else.

export const FILTERS = [
  { id: 'original', name: 'Original', p: {} },
  { id: 'bright', name: 'Bright', p: { brightness: 14, contrast: 1.04, sat: 1.08 } },
  { id: 'soft', name: 'Soft', p: { fade: 26, contrast: 0.92, sat: 0.9, warm: 6, brightness: 10 } },
  { id: 'blush', name: 'Blush', p: { tintR: 16, tintB: 6, fade: 12, sat: 0.95, brightness: 8 } },
  { id: 'warm', name: 'Warm', p: { warm: 18, sat: 1.05, contrast: 1.04 } },
  { id: 'cool', name: 'Cool', p: { warm: -16, sat: 0.95, brightness: 4 } },
  { id: 'vivid', name: 'Vivid', p: { sat: 1.35, contrast: 1.1 } },
  { id: 'film', name: 'Film', p: { fade: 18, warm: 8, sat: 0.9, contrast: 1.06, grain: 16, vignette: 0.25 } },
  { id: 'vintage', name: 'Vintage', p: { sepia: 0.55, fade: 22, contrast: 0.95, grain: 12, vignette: 0.35 } },
  { id: 'bw', name: 'B&W', p: { sat: 0, contrast: 1.12, brightness: 4 } },
  { id: 'noir', name: 'Noir', p: { sat: 0, contrast: 1.45, brightness: -6, grain: 14, vignette: 0.3 } },
];

export const filterById = (id) => FILTERS.find((f) => f.id === id) || FILTERS[0];

const clamp = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);

// Apply in place to a canvas. `seed` keeps grain stable between renders of one shot.
export function applyFilter(canvas, id, seed = 1) {
  const p = filterById(id).p;
  if (!Object.keys(p).length) return;
  const { brightness = 0, contrast = 1, sat = 1, warm = 0, tintR = 0, tintB = 0,
    fade = 0, sepia = 0, grain = 0, vignette = 0 } = p;

  const w = canvas.width, h = canvas.height;
  const g = canvas.getContext('2d', { willReadFrequently: true });
  const img = g.getImageData(0, 0, w, h);
  const d = img.data;

  // contrast + brightness + fade folded into one lookup table
  const lut = new Uint8ClampedArray(256);
  for (let i = 0; i < 256; i++) {
    let v = (i - 128) * contrast + 128 + brightness;
    v = fade + v * (1 - fade / 255);
    lut[i] = clamp(v);
  }

  let s = (seed * 2654435761) >>> 0;
  const cx = w / 2, cy = h / 2, maxD = cx * cx + cy * cy;

  for (let y = 0, i = 0; y < h; y++) {
    const dy = (y - cy) * (y - cy);
    for (let x = 0; x < w; x++, i += 4) {
      let r = d[i], gg = d[i + 1], b = d[i + 2];

      if (sat !== 1) {
        const l = 0.299 * r + 0.587 * gg + 0.114 * b;
        r = l + (r - l) * sat; gg = l + (gg - l) * sat; b = l + (b - l) * sat;
      }
      if (sepia) {
        const sr = 0.393 * r + 0.769 * gg + 0.189 * b;
        const sg = 0.349 * r + 0.686 * gg + 0.168 * b;
        const sb = 0.272 * r + 0.534 * gg + 0.131 * b;
        r += (sr - r) * sepia; gg += (sg - gg) * sepia; b += (sb - b) * sepia;
      }
      r += warm + tintR; b -= warm - tintB;

      r = lut[clamp(r) | 0]; gg = lut[clamp(gg) | 0]; b = lut[clamp(b) | 0];

      if (vignette) {
        const k = 1 - vignette * (((x - cx) * (x - cx) + dy) / maxD);
        r *= k; gg *= k; b *= k;
      }
      if (grain) {
        s = (s * 1664525 + 1013904223) >>> 0;
        const n = ((s / 4294967296) - 0.5) * grain * 2;
        r += n; gg += n; b += n;
      }
      d[i] = r; d[i + 1] = gg; d[i + 2] = b;
    }
  }
  g.putImageData(img, 0, 0);
}

// Strip sizes. Every number is in "layout px" — the export canvas is W×H times
// `exportScale`, and on-screen previews are the same geometry at a smaller scale,
// so what you see while picking is exactly what you download.

function column({ W, H, m, gap, n, slotH, footerPad = 0 }) {
  const slotW = W - m * 2;
  const slots = [];
  for (let i = 0; i < n; i++) slots.push({ x: m, y: m + i * (slotH + gap), w: slotW, h: slotH });
  const footerY = m + n * slotH + (n - 1) * gap + footerPad;
  return { slots, footer: { y: footerY, h: H - footerY } };
}

const vertical = (() => {
  const W = 600, H = 1800;
  const g = column({ W, H, m: 36, gap: 24, n: 4, slotH: 396 });
  return {
    id: 'vertical', name: '4 cut', hint: 'the classic strip',
    W, H, ...g, shots: 6, exportScale: 1.5,
    caption: 34, date: 15,
  };
})();

const grid = (() => {
  const W = 1600, H = 1200, m = 56, gap = 32;
  const w = (W - m * 2 - gap) / 2, h = 480;
  const slots = [
    { x: m, y: m, w, h }, { x: m + w + gap, y: m, w, h },
    { x: m, y: m + h + gap, w, h }, { x: m + w + gap, y: m + h + gap, w, h },
  ];
  const fy = m + h * 2 + gap;
  return {
    id: 'grid', name: '2 × 2', hint: 'four, on a card',
    W, H, slots, footer: { y: fy, h: H - fy }, shots: 6, exportScale: 1,
    caption: 56, date: 22,
  };
})();

const duo = (() => {
  const W = 1200, H = 1800;
  const g = column({ W, H, m: 56, gap: 36, n: 2, slotH: 760 });
  return {
    id: 'duo', name: '2 cut', hint: 'two big photos',
    W, H, ...g, shots: 4, exportScale: 1,
    caption: 60, date: 24,
  };
})();

const polaroid = (() => {
  const W = 1080, H = 1320, m = 60;
  const slots = [{ x: m, y: m, w: W - m * 2, h: W - m * 2 }];
  const fy = m + (W - m * 2);
  return {
    id: 'polaroid', name: 'Polaroid', hint: 'one shot',
    W, H, slots, footer: { y: fy, h: H - fy }, shots: 3, exportScale: 1,
    caption: 64, date: 24, polaroid: true,
  };
})();

export const LAYOUTS = { vertical, grid, duo, polaroid };
export const LAYOUT_ORDER = ['vertical', 'grid', 'duo', 'polaroid'];

// Every slot in a layout shares one shape, so the camera preview can be cropped to it.
export const slotAspect = (L) => L.slots[0].w / L.slots[0].h;

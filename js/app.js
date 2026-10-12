import { LAYOUTS, LAYOUT_ORDER, slotAspect } from './layouts.js';
import { FRAMES, PACKS, frameById, paintFrame } from './frames.js';
import { FILTERS, Y2K_FILTERS } from './filters.js';
import { renderStrip, drawStroke, drawStamp, fit, forgetShots, photoFor, CAPTION_FONT, MONO_FONT, EMOJI_FONT, PIXEL_FONT, LCD_FONT } from './render.js';
import { digicamScene, EDITIONS, editionById, deviceCanvas } from './digicam.js';
import { DEVICES, DEVICE_ORDER, TINTS, CHARMS, BACKDROPS, loadDeviceImages } from './devices.js';
import { hasCamera, openCamera, closeCamera, grabFrame, fileToCanvas, unlockAudio, beep, shutter } from './camera.js';

// ---------------------------------------------------------------------------
// tiny DOM helper: h('button.btn.primary', { onclick, text }, [children])
function h(spec, props = {}, kids = []) {
  const [tag, ...cls] = spec.split('.');
  const n = document.createElement(tag || 'div');
  if (cls.length) n.className = cls.join(' ');
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'text') n.textContent = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k === 'style') for (const [p, val] of Object.entries(v)) {
      if (p.startsWith('--')) n.style.setProperty(p, val); else n.style[p] = val;
    }
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (k in n && typeof v !== 'string') n[k] = v;
    else n.setAttribute(k, v === true ? '' : v);
  }
  for (const c of [].concat(kids)) if (c != null && c !== false) n.append(c);
  return n;
}

const ICON = {
  back: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
  check: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  flip: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><path d="M9.5 13.5a3 3 0 0 0 5.3 1.4M14.5 12.5a3 3 0 0 0-5.3-1.4"/><path d="M15 15.2l-.2-1.6 1.6-.1M9 10.8l.2 1.6-1.6.1"/></svg>',
  image: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-8 9"/></svg>',
  timer: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9 2h6"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  undo: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/></svg>',
  trash: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
  download: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>',
  share: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V4M8 8l4-4 4 4"/><path d="M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7"/></svg>',
  rotate: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 4v5h-5"/></svg>',
  close: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
};
const icon = (name) => h('span.ic', { html: ICON[name], 'aria-hidden': 'true' });

// ---------------------------------------------------------------------------
// state

const PREFS_KEY = 'photobooth.prefs.v1';
function loadPrefs() {
  try { return JSON.parse(localStorage.getItem(PREFS_KEY)) || {}; } catch { return {}; }
}
function savePrefs() {
  // digicam mode borrows layout/frame/caption; the booth's own choices are kept aside
  const b = S.mode === 'digicam' ? S.boothSetup : S;
  const out = { layout: b.layout, frame: b.frame, caption: b.caption, pack: S.pack, timer: S.timer, showDate: S.showDate, edition: S.edition, cuts: S.cuts, device: S.device, format: S.format, tint: S.tint, charm: S.charm, bg: S.bg };
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(out)); } catch { /* private mode */ }
}

const prefs = loadPrefs();
const S = {
  scene: 'start',
  mode: 'booth',
  layout: LAYOUT_ORDER.includes(prefs.layout) ? prefs.layout : 'vertical',
  frame: FRAMES.some((f) => f.id === prefs.frame) ? prefs.frame : 'black',
  pack: prefs.pack || 'simple',
  timer: [3, 5, 10].includes(prefs.timer) ? prefs.timer : 3,
  facing: 'user',
  filter: 'original',
  caption: typeof prefs.caption === 'string' ? prefs.caption : 'photobooth',
  showDate: prefs.showDate ?? true,
  stamp: false,
  edition: prefs.edition || 'lace',
  cuts: [1, 2, 3, 4].includes(prefs.cuts) ? prefs.cuts : 3,
  device: DEVICES[prefs.device] ? prefs.device : 'ixus',
  format: prefs.format === 'strip' ? 'strip' : 'device',   // digicam output: photo on the device, or a strip
  hud: true,
  tint: TINTS.some((t) => t.id === prefs.tint) ? prefs.tint : 'original',
  charm: CHARMS.includes(prefs.charm) ? prefs.charm : '🍓',
  bg: BACKDROPS.includes(prefs.bg) ? prefs.bg : 'soft',
  cut: 0,      // which cut a device-format screen is showing
  decos: [],   // device format: one decoration set per cut
  boothSetup: null,
  shots: [],   // { id, canvas, thumb }
  slots: [],   // shot id (or null) per slot
  deco: { stickers: [], strokes: [] },
};
let shotSeq = 0;

const L = () => LAYOUTS[S.layout];
const deviceFormat = () => S.mode === 'digicam' && S.format === 'device';
const photos = () => (deviceFormat() ? [S.shots[S.cut] || null] : S.slots.map((id) => S.shots.find((s) => s.id === id) || null));
const stripOpts = (extra = {}) => ({
  layout: S.layout, frame: S.frame, photos: photos(), filter: S.filter,
  caption: S.caption, showDate: S.showDate, stamp: S.stamp,
  skin: S.edition, hud: S.hud, index: S.cut, total: S.shots.length, tint: S.tint, charm: S.charm, bg: S.bg, ...extra,
});

// The layout follows the mode: the booth's own pick, a digicam strip, or a device.
function syncLayout() {
  if (S.mode !== 'digicam') return;
  S.layout = S.format === 'device' ? `dev-${S.device}` : `y2k${S.cuts}`;
}

// Device format keeps one sticker set per cut; S.deco is always the shown cut's.
function selectCut(i) {
  S.decos[S.cut] = S.deco;
  S.cut = i;
  S.deco = S.decos[i] || { stickers: [], strokes: [] };
}

// Switching between the classic booth and the digicam swaps which setup is live.
function setMode(mode) {
  if (mode === S.mode) return;
  if (mode === 'digicam') {
    loadDeviceImages();
    S.boothSetup = { layout: S.layout, frame: S.frame, caption: S.caption };
    const ed = editionById(S.edition);
    S.frame = ed.frame; S.filter = ed.filter; S.caption = ed.caption; S.stamp = true;
    S.mode = mode;
    syncLayout();
  } else {
    Object.assign(S, S.boothSetup || {});
    S.filter = 'original'; S.stamp = false;
  }
  S.mode = mode;
}

function resetShots() {
  S.shots = [];
  S.slots = [];
  S.deco = { stickers: [], strokes: [] };
  S.decos = [];
  S.cut = 0;
  forgetShots();
}

function addShot(canvas) {
  const t = document.createElement('canvas');
  const k = 240 / Math.max(canvas.width, canvas.height);
  t.width = Math.round(canvas.width * k); t.height = Math.round(canvas.height * k);
  t.getContext('2d').drawImage(canvas, 0, 0, t.width, t.height);
  const shot = { id: ++shotSeq, canvas, thumb: t.toDataURL('image/jpeg', 0.8) };
  S.shots.push(shot);
  return shot;
}

// Default fill: the first shots in order, one per slot.
function autoFill() {
  const n = L().slots.length;
  S.slots = Array.from({ length: n }, (_, i) => S.shots[i]?.id ?? null);
}

// ---------------------------------------------------------------------------
// navigation

const ORDER = ['start', 'layout', 'frame', 'shoot', 'pick', 'style', 'decorate', 'done'];
const STEP_OF = { layout: 'frame', frame: 'frame', shoot: 'shoot', pick: 'pick', style: 'style', decorate: 'style', done: 'done' };
const BOOTH_STEPS = [['frame', 'Frame'], ['shoot', 'Shoot'], ['pick', 'Pick'], ['style', 'Style'], ['done', 'Done']];
const DIGICAM_STEPS = [['shoot', 'Camera'], ['style', 'Style'], ['done', 'Save']];
// where Back goes in digicam mode
const DIGICAM_BACK = { digicam: 'start', style: 'digicam', decorate: 'style', done: 'decorate' };

const app = document.getElementById('app');
let cleanup = null;

function go(scene) {
  if (cleanup) { try { cleanup(); } catch (e) { console.error(e); } }
  cleanup = null;
  S.scene = scene;
  app.replaceChildren();
  app.dataset.scene = scene;
  document.body.dataset.scene = scene;
  document.body.classList.toggle('y2k', S.mode === 'digicam' && scene !== 'start');
  window.scrollTo(0, 0);
  cleanup = SCENES[scene]() || null;
  if (scene !== 'start' && !history.state?.pb) history.pushState({ pb: 1 }, '');
}

async function back() {
  if (S.mode === 'digicam') {
    const prev = DIGICAM_BACK[S.scene];
    if (!prev) return;
    if (S.scene === 'style') {
      if (!(await confirmBox('Retake your photos?', 'Going back to the camera clears the shots you just took.', 'Retake'))) return;
      resetShots();
    }
    go(prev);
    return;
  }
  const i = ORDER.indexOf(S.scene);
  if (i <= 0) return;
  let prev = ORDER[i - 1];
  if (S.scene === 'pick') {
    if (!(await confirmBox('Retake your photos?', 'Going back to the camera clears the shots you just took.', 'Retake'))) return;
    resetShots();
  }
  go(prev);
}

window.addEventListener('popstate', () => {
  if (S.scene === 'start') return;
  history.pushState({ pb: 1 }, '');
  back();
});

// ---------------------------------------------------------------------------
// shared chrome

function header({ step, title, sub, next, nextLabel = 'Next', backLabel = 'Back' }) {
  const STEPS = S.mode === 'digicam' ? DIGICAM_STEPS : BOOTH_STEPS;
  const idx = STEPS.findIndex(([id]) => id === step);
  const track = h('span.track', {}, h('span.track-fill', { style: { width: `${(idx / (STEPS.length - 1)) * 100}%` } }));
  const steps = h('div.steps', { role: 'list', 'aria-label': 'Steps' }, [track, ...STEPS.map(([id, label], i) =>
    h(`span.step${i < idx ? '.is-done' : ''}${i === idx ? '.is-current' : ''}`, { role: 'listitem', 'aria-current': i === idx ? 'step' : 'false' }, [
      h('span.step-dot', { html: i < idx ? ICON.check : '' }),
      h('span.step-label', { text: label }),
    ]))]);
  const nextBtn = next ? h('button.pill', { onclick: next }, [h('span', { text: nextLabel }), icon('arrow')]) : null;
  const titleEl = h('h1.title', { text: title });
  const subEl = h('p.sub', { text: sub });
  const root = h('header.head', {}, [
    h('div.topbar', {}, [h('button.backlink', { onclick: back }, [icon('back'), h('span', { text: backLabel })]), nextBtn]),
    steps, titleEl, subEl,
  ]);
  return { root, nextBtn, titleEl, subEl };
}

function confirmBox(title, body, okLabel = 'OK') {
  return new Promise((resolve) => {
    const done = (v) => { ov.remove(); resolve(v); };
    const ov = h('div.overlay', { onclick: (e) => { if (e.target === ov) done(false); } }, h('div.dialog', { role: 'dialog', 'aria-modal': 'true' }, [
      h('h2', { text: title }), h('p', { text: body }),
      h('div.dialog-actions', {}, [
        h('button.btn.ghost', { text: 'Cancel', onclick: () => done(false) }),
        h('button.btn.primary', { text: okLabel, onclick: () => done(true) }),
      ]),
    ]));
    document.body.append(ov);
  });
}

function toast(msg) {
  const t = h('div.toast', { text: msg, role: 'status' });
  document.body.append(t);
  setTimeout(() => t.classList.add('out'), 2200);
  setTimeout(() => t.remove(), 2700);
}

// A mini strip drawn in CSS for the size picker (the strip motif is literal).
function miniStrip(id) {
  const n = LAYOUTS[id].slots.length;
  return h(`div.mini.mini-${id}`, {}, Array.from({ length: n }, (_, i) => h('span', { style: { animationDelay: `${i * 70}ms` } })));
}

// ---------------------------------------------------------------------------
// fonts + the sample strip on the start screen

const fontsReady = (async () => {
  try {
    await Promise.all([
      document.fonts.load(`700 40px ${CAPTION_FONT}`),
      document.fonts.load(`400 20px ${MONO_FONT}`),
      document.fonts.load(`400 20px ${PIXEL_FONT}`),
      document.fonts.load(`400 20px ${LCD_FONT}`),
    ]);
  } catch { /* fall back to system fonts */ }
})();

function sampleShots() {
  const looks = [
    ['#FFD1DC', '#FFE9B8', '😊', '✌️'],
    ['#C9E4FF', '#E6D6FF', '😜', '💕'],
    ['#FFE3C2', '#FFC2D1', '🥰', '🫶'],
    ['#D5F2E3', '#C9E4FF', '😎', '✨'],
  ];
  return looks.map(([a, b, face, prop], i) => {
    const c = document.createElement('canvas');
    c.width = 800; c.height = 600;
    const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 800, 600);
    gr.addColorStop(0, a); gr.addColorStop(1, b);
    g.fillStyle = gr; g.fillRect(0, 0, 800, 600);
    g.fillStyle = 'rgba(255,255,255,.35)';
    g.beginPath(); g.arc(640, 120, 90, 0, Math.PI * 2); g.fill();
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `330px ${EMOJI_FONT}`; g.fillText(face, 400, 330);
    g.font = `140px ${EMOJI_FONT}`; g.fillText(prop, i % 2 ? 160 : 650, 470);
    return { id: -1 - i, canvas: c };
  });
}

// ---------------------------------------------------------------------------
// scenes

const SCENES = {};

SCENES.start = () => {
  const strip = h('div.hero-strip');
  const wrap = h('main.scene.start', {}, [
    h('div.hero', {}, [h('div.printer', {}, h('span.printer-slot')), h('div.hero-feed', {}, strip)]),
    h('span.chip', { text: '인생네컷 · photobooth' }),
    h('h1.hero-title', { text: 'Photobooth' }),
    h('p.hero-sub', { text: 'A real photo strip, shot on your phone. Pick a frame, strike a few poses, save it.' }),
    h('div.choices', {}, [
      h('button.choice.dark', { onclick: () => { setMode('booth'); S.source = 'camera'; go('layout'); } }, [h('strong', { text: 'Start the booth' }), h('span', { text: 'with your camera' })]),
      h('button.choice', { onclick: () => { setMode('booth'); S.source = 'upload'; go('layout'); } }, [h('strong', { text: 'Use my photos' }), h('span', { text: 'from your camera roll' })]),
      h('button.choice.y2k-choice', { onclick: () => { setMode('digicam'); resetShots(); go('digicam'); } }, [
        h('strong', {}, [h('span.y2k-word', { text: 'Y2K digicam' }), h('em.new', { text: 'NEW' })]),
        h('span', { text: 'retro camera + date stamp' }),
      ]),
    ]),
    h('div.ways-label', {}, h('span', { text: 'How it works' })),
    h('div.ways', {}, [
      way('pink', '🖼️', 'Pick a frame', '4 cut, 2×2, 2 cut or polaroid'),
      way('blue', '📸', 'Strike a pose', 'a countdown snaps each shot'),
      way('purple', '✨', 'Make it yours', 'filters, stickers, doodles'),
    ]),
    h('p.fineprint', { text: 'Free, no account. Your photos never leave your phone.' }),
  ]);
  app.append(wrap);

  fontsReady.then(() => {
    const c = renderStrip({ layout: 'vertical', frame: 'black', photos: sampleShots(), filter: 'original', caption: 'photobooth', showDate: true }, 0.5);
    c.className = 'hero-canvas';
    strip.append(c);
    void strip.offsetWidth;
    strip.classList.add('in');
  });
};

function way(tone, emoji, title, sub) {
  return h(`div.way.${tone}`, {}, [h('span.way-emoji', { text: emoji }), h('strong', { text: title }), h('span', { text: sub })]);
}

SCENES.layout = () => {
  const hd = header({ step: 'frame', title: 'Pick a size', sub: 'Tap one. You can always come back.', next: () => go('frame') });
  const cards = {};
  const grid = h('div.layout-grid', {}, LAYOUT_ORDER.map((id) => {
    const l = LAYOUTS[id];
    cards[id] = h(`button.layout-card${S.layout === id ? '.is-selected' : ''}`, {
      'aria-label': `${l.name}, ${l.hint}`, 'aria-pressed': String(S.layout === id),
      onclick: () => {
        if (S.layout !== id) { S.layout = id; savePrefs(); }
        for (const [k, c] of Object.entries(cards)) { c.classList.toggle('is-selected', k === id); c.setAttribute('aria-pressed', String(k === id)); }
      },
      ondblclick: () => go('frame'),
    }, [miniStrip(id), h('span.cap', { text: l.name }), h('span.hint', { text: l.hint })]);
    return cards[id];
  }));
  app.append(h('main.scene', {}, [hd.root, grid]));
};

SCENES.frame = () => {
  const hd = header({ step: 'frame', title: 'Pick a frame', sub: 'Your photos go in the empty boxes.', next: () => go('shoot') });
  const tabs = h('div.tabs', { role: 'tablist' });
  const gridEl = h('div.frame-grid', { 'data-layout': S.layout });
  const wide = S.layout === 'grid';
  const box = wide ? [150, 112] : S.layout === 'polaroid' ? [120, 147] : S.layout === 'duo' ? [110, 165] : [80, 240];

  function drawTabs() {
    tabs.replaceChildren(...PACKS.map((p) => h(`button.tab${S.pack === p.id ? '.is-open' : ''}`, {
      role: 'tab', 'aria-selected': String(S.pack === p.id),
      onclick: () => { S.pack = p.id; savePrefs(); drawTabs(); drawGrid(); },
    }, [h('span', { text: p.name }), h('span.tab-count', { text: String(FRAMES.filter((f) => f.pack === p.id).length) }),
      FRAMES.find((f) => f.id === S.frame)?.pack === p.id && S.pack !== p.id ? h('span.tab-dot') : null])));
  }
  function drawGrid() {
    gridEl.replaceChildren(...FRAMES.filter((f) => f.pack === S.pack).map((f) => {
      const { cssW, cssH, scale } = fit(S.layout, box[0], box[1]);
      const c = renderStrip({ layout: S.layout, frame: f.id, photos: [], caption: S.caption, showDate: S.showDate }, scale);
      c.style.width = `${cssW}px`; c.style.height = `${cssH}px`;
      return h(`button.frame-card${S.frame === f.id ? '.is-selected' : ''}`, {
        'aria-label': `${f.name} frame`, 'aria-pressed': String(S.frame === f.id),
        onclick: () => { S.frame = f.id; savePrefs(); drawGrid(); drawTabs(); },
        ondblclick: () => go('shoot'),
      }, [h('div.frame-thumb', {}, c), h('span.frame-cap', { text: f.name })]);
    }));
  }
  drawTabs();
  fontsReady.then(drawGrid);
  drawGrid();
  app.append(h('main.scene', {}, [hd.root, tabs, gridEl]));
};

const POSES = [
  'big smile, no teeth', 'peace sign ✌️', 'finger heart 🫶', 'look surprised', 'pout like a duck',
  'chin on your hand', 'wink at the camera', 'cover one eye', 'laugh like it’s funny', 'look away, candid',
  'cool sunglasses face 😎', 'puff your cheeks', 'blow a kiss 😘', 'thumbs up 👍', 'hands on cheeks',
  'the serious model stare', 'tilt your head', 'make a heart with both arms',
];

SCENES.shoot = () => {
  const layout = L();
  const total = layout.shots;
  let alive = true;
  let running = false;

  const hd = header({ step: 'shoot', title: 'Get ready', sub: S.source === 'upload' ? `Pick up to ${total + 4} photos from your phone.` : `${total} shots, a countdown before each. Your best ones go on the strip.` });
  const video = h('video', { autoplay: true, muted: true, playsinline: true });
  const count = h('div.countdown', { 'aria-live': 'assertive' });
  const flash = h('div.flash');
  const shotTag = h('span.stage-tag', { text: 'live' });
  const camMsg = h('div.cam-msg', { hidden: true });
  const stage = h('div.stage', { style: { aspectRatio: String(slotAspect(layout)) } }, [video, count, flash, shotTag, camMsg]);
  const pose = h('p.pose', {}, [h('span.try', { text: 'TRY' }), h('span.pose-text', { text: POSES[Math.floor(Math.random() * POSES.length)] })]);

  const timerBtns = [3, 5, 10].map((t) => h(`button.seg${S.timer === t ? '.on' : ''}`, {
    text: `${t}s`, 'aria-pressed': String(S.timer === t),
    onclick: () => { S.timer = t; savePrefs(); timerBtns.forEach((b, i) => { b.classList.toggle('on', [3, 5, 10][i] === t); b.setAttribute('aria-pressed', String([3, 5, 10][i] === t)); }); },
  }));
  const flipBtn = h('button.tool', { onclick: flip, 'aria-label': 'Switch camera' }, [icon('flip'), h('span', { text: 'Flip' })]);
  const fileInput = h('input', { type: 'file', accept: 'image/*', multiple: true, hidden: true, onchange: onFiles });
  const uploadBtn = h('button.tool', { onclick: () => fileInput.click() }, [icon('image'), h('span', { text: 'Upload' })]);
  const controls = h('div.controls', {}, [h('div.segs', { role: 'group', 'aria-label': 'Timer' }, [icon('timer'), ...timerBtns]), flipBtn, uploadBtn]);
  const readyBtn = h('button.btn.primary.big', { text: 'I’m ready', onclick: startShoot });
  const cells = h('div.cells', { style: { '--n': total } }, Array.from({ length: total }, (_, i) => h('span.cell', { text: String(i + 1) })));

  app.append(h('main.scene.shoot', {}, [hd.root, stage, pose, controls, readyBtn, cells, fileInput]));

  if (S.source === 'upload' || !hasCamera()) {
    showCamMsg(S.source === 'upload' ? 'Choose the photos you want on your strip.' : 'This browser can’t open a camera.');
    if (S.source === 'upload') setTimeout(() => alive && fileInput.click(), 50);
  } else {
    startCam();
  }

  function showCamMsg(text) {
    camMsg.hidden = false;
    camMsg.replaceChildren(h('p', { text }), h('button.btn.primary', { onclick: () => fileInput.click() }, [icon('image'), h('span', { text: 'Choose photos' })]),
      S.source !== 'upload' && hasCamera() ? h('button.btn.ghost', { text: 'Try the camera again', onclick: startCam }) : null);
    readyBtn.hidden = true;
    controls.querySelector('.segs').hidden = true;
    flipBtn.hidden = true;
    video.hidden = true;
    shotTag.hidden = true;
  }

  async function startCam() {
    camMsg.hidden = true; video.hidden = false; readyBtn.hidden = false; flipBtn.hidden = false; shotTag.hidden = false;
    controls.querySelector('.segs').hidden = false;
    readyBtn.disabled = true;
    readyBtn.textContent = 'Opening camera…';
    try {
      await openCamera(video, S.facing);
      if (!alive) { closeCamera(); return; }
      video.classList.toggle('mirror', S.facing === 'user');
      readyBtn.disabled = false;
      readyBtn.textContent = 'I’m ready';
    } catch (e) {
      if (!alive) return;
      const denied = e && (e.name === 'NotAllowedError' || e.name === 'SecurityError');
      showCamMsg(denied ? 'Camera access is blocked. Allow it in your browser settings, or use photos from your phone instead.' : 'Couldn’t find a camera. You can use photos from your phone instead.');
    }
  }

  async function flip() {
    if (running) return;
    S.facing = S.facing === 'user' ? 'environment' : 'user';
    await startCam();
  }

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  async function startShoot() {
    if (running || !video.videoWidth) return;
    running = true;
    unlockAudio();
    resetShots();
    cells.querySelectorAll('.cell').forEach((c, i) => { c.replaceChildren(String(i + 1)); c.classList.remove('filled'); });
    readyBtn.hidden = true;
    controls.classList.add('locked');
    hd.subEl.textContent = 'Look at the camera…';
    for (let i = 0; i < total; i++) {
      if (!alive) return;
      hd.titleEl.textContent = `Shot ${i + 1} of ${total}`;
      shotTag.textContent = `${i + 1} / ${total}`;
      pose.querySelector('.pose-text').textContent = POSES[(Math.floor(Math.random() * POSES.length) + i) % POSES.length];
      for (let s = S.timer; s > 0; s--) {
        if (!alive) return;
        count.textContent = String(s);
        count.classList.remove('tick'); void count.offsetWidth; count.classList.add('tick');
        beep(s === 1 ? 1180 : 880);
        await wait(1000);
      }
      if (!alive) return;
      count.textContent = '';
      shutter();
      flash.classList.remove('go'); void flash.offsetWidth; flash.classList.add('go');
      const shot = addShot(grabFrame(video, S.facing === 'user'));
      const cell = cells.children[i];
      cell.replaceChildren(h('img', { src: shot.thumb, alt: `Shot ${i + 1}` }));
      cell.classList.add('filled');
      await wait(900);
    }
    hd.titleEl.textContent = 'Developing…';
    hd.subEl.textContent = 'Nice. Now pick your favourites.';
    await wait(700);
    if (!alive) return;
    autoFill();
    go('pick');
  }

  async function onFiles() {
    const files = [...fileInput.files].filter((f) => f.type.startsWith('image/') || /\.(heic|jpe?g|png|webp)$/i.test(f.name)).slice(0, total + 4);
    fileInput.value = '';
    if (!files.length) return;
    hd.titleEl.textContent = 'Developing…';
    resetShots();
    let failed = 0;
    for (const f of files) {
      try { addShot(await fileToCanvas(f)); } catch { failed++; }
      if (!alive) return;
    }
    if (!S.shots.length) {
      hd.titleEl.textContent = 'Get ready';
      toast('Those photos couldn’t be opened. Try JPG or PNG.');
      return;
    }
    if (failed) toast(`${failed} photo${failed > 1 ? 's' : ''} couldn’t be opened`);
    autoFill();
    go('pick');
  }

  return () => { alive = false; closeCamera(); };
};

// A strip preview with tappable slot overlays, sized to fit its column.
function stripStage({ maxW, maxH, onSlot } = {}) {
  const { cssW, cssH, scale } = fit(S.layout, maxW, maxH);
  const canvas = h('canvas.strip-canvas');
  const stage = h('div.strip-stage', { style: { width: `${cssW}px`, height: `${cssH}px` } }, canvas);
  const Lo = L();
  const slotEls = onSlot ? Lo.slots.map((sl, i) => {
    const b = h('button.slot-hit', {
      'aria-label': `Slot ${i + 1}`,
      style: { left: `${(sl.x / Lo.W) * 100}%`, top: `${(sl.y / Lo.H) * 100}%`, width: `${(sl.w / Lo.W) * 100}%`, height: `${(sl.h / Lo.H) * 100}%` },
      onclick: () => onSlot(i),
    }, h('span.slot-num', { text: String(i + 1) }));
    stage.append(b);
    return b;
  }) : [];
  const draw = (extra) => renderStrip(stripOpts(extra), scale, canvas);
  return { stage, canvas, draw, slotEls, cssW, cssH, scale };
}

function previewBox() {
  const vw = Math.min(window.innerWidth, 1100);
  const wideScreen = window.innerWidth >= 860;
  const maxW = wideScreen ? 420 : vw - 48;
  const maxH = wideScreen ? Math.min(window.innerHeight - 270, 760) : Math.min(window.innerHeight * 0.48, 520);
  return { maxW, maxH };
}

SCENES.pick = () => {
  const n = L().slots.length;
  const hd = header({ step: 'pick', title: 'Pick your photos', sub: 'Tap a photo to place it. Tap a box to empty it.', next: () => go('style') });
  const st = stripStage({ ...previewBox(), onSlot: (i) => { if (S.slots[i] != null) { S.slots[i] = null; update(); } } });
  const pool = h('div.pool');
  const tiles = S.shots.map((shot) => {
    const badge = h('span.badge');
    const t = h('button.pool-tile', { onclick: () => toggle(shot.id), 'aria-label': 'Photo' }, [h('img', { src: shot.thumb, alt: '' }), badge]);
    t._badge = badge;
    pool.append(t);
    return t;
  });
  const retake = h('button.textlink', { text: 'Retake photos', onclick: back });

  function toggle(id) {
    const at = S.slots.indexOf(id);
    if (at >= 0) S.slots[at] = null;
    else {
      const empty = S.slots.indexOf(null);
      if (empty < 0) { toast('All boxes are full. Tap a box to empty it.'); return; }
      S.slots[empty] = id;
    }
    update();
  }
  function update() {
    st.draw();
    S.shots.forEach((shot, k) => {
      const at = S.slots.indexOf(shot.id);
      tiles[k].classList.toggle('is-placed', at >= 0);
      tiles[k]._badge.textContent = at >= 0 ? String(at + 1) : '';
    });
    st.slotEls.forEach((b, i) => b.classList.toggle('is-empty', S.slots[i] == null));
    const filled = S.slots.filter((x) => x != null).length;
    const ok = filled === n || filled === Math.min(n, S.shots.length);
    hd.nextBtn.disabled = !ok;
  }
  update();
  fontsReady.then(update);

  app.append(h('main.scene.split', {}, [hd.root, h('div.split-body', {}, [
    h('div.split-preview', {}, st.stage),
    h('div.split-side', {}, [h('p.side-label', { text: `${S.shots.length} photos · ${n} box${n > 1 ? 'es' : ''}` }), pool, retake]),
  ])]));
};

SCENES.style = () => {
  const y2k = S.mode === 'digicam';
  if (y2k) {
    syncLayout();
    if (S.format === 'strip') autoFill();
    if (S.cut >= S.shots.length) S.cut = 0;
  }
  const hd = header({ step: 'style', title: y2k ? 'Make it cute' : 'Choose a look', sub: y2k ? 'Pick how it comes out, then the look.' : 'One filter for the whole strip.', next: () => go('decorate') });
  const previewWrap = h('div.split-preview');
  const side = h('div.split-side');
  let st = null;
  let raf = 0;
  const schedule = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(update); };

  // Rebuild the whole panel: switching device/format changes the preview's shape.
  function build() {
    st = stripStage(previewBox());
    previewWrap.replaceChildren(st.stage);
    const sample = photos().find(Boolean) || S.shots[0];
    const list = y2k ? Y2K_FILTERS : FILTERS;
    const cards = list.map((f) => {
      const c = h('canvas');
      if (sample) {
        const src = photoFor(sample, 180, 180, f.id);
        c.width = 180; c.height = 180;
        c.getContext('2d').drawImage(src, 0, 0);
      }
      const b = h('button.filter-card', { onclick: () => { S.filter = f.id; update(); } }, [c, h('span', { text: f.name })]);
      b._on = () => S.filter === f.id;
      return b;
    });
    const sel = [...cards];
    const kids = [];
    const toggle = (label, get, set) => {
      const input = h('input', { type: 'checkbox', checked: get(), onchange: () => { set(input.checked); update(); } });
      return h('label.toggle', {}, [input, h('span.switch'), h('span', { text: label })]);
    };

    if (y2k) {
      const fmt = [['device', 'On the device'], ['strip', 'Photo strip']].map(([id, label]) => {
        const b = h('button.seg', { text: label, onclick: () => { if (S.format !== id) { S.format = id; S.deco = { stickers: [], strokes: [] }; S.decos = []; syncLayout(); if (id === 'strip') autoFill(); savePrefs(); build(); } } });
        b.classList.toggle('on', S.format === id);
        return b;
      });
      kids.push(h('div.segs.format-segs', { role: 'group', 'aria-label': 'Format' }, fmt));
    }

    if (y2k && S.format === 'device') {
      if (S.shots.length > 1) {
        kids.push(h('p.side-label', { text: 'Photo' }));
        const cutBtns = S.shots.map((shot, i) => {
          const b = h('button.cut-thumb', { 'aria-label': `Photo ${i + 1}`, onclick: () => { selectCut(i); update(); } }, h('img', { src: shot.thumb, alt: '' }));
          b._on = () => S.cut === i;
          return b;
        });
        sel.push(...cutBtns);
        kids.push(h('div.cut-row', {}, cutBtns));
      }
      kids.push(h('p.side-label', { text: 'Device' }));
      kids.push(h('div.filter-row.device-row', {}, DEVICE_ORDER.map((id) => {
        const { canvas } = deviceCanvas(id, S.edition, 70, 60, { tint: S.tint });
        const b = h('button.device-chip', { onclick: () => { S.device = id; syncLayout(); savePrefs(); build(); } }, [h('span.device-art', {}, canvas), h('span', { text: DEVICES[id].name })]);
        b._on = () => S.device === id;
        sel.push(b);
        return b;
      })));
      kids.push(h('p.side-label', { text: 'Colour' }));
      kids.push(h('div.filter-row', {}, TINTS.map((t) => {
        const b = h('button.colour-chip', { onclick: () => { S.tint = t.id; savePrefs(); build(); } }, [h(`span.swatch-dot.tint-${t.id}`), h('span', { text: t.name })]);
        b._on = () => S.tint === t.id;
        sel.push(b);
        return b;
      })));
      kids.push(h('p.side-label', { text: 'Phone charm' }));
      kids.push(h('div.dc-charms', {}, CHARMS.map((c) => {
        const b = h('button.charm-chip', { 'aria-label': c === 'none' ? 'No charm' : `${c} charm`, onclick: () => { S.charm = c; savePrefs(); update(); } }, c === 'none' ? h('span.none', { text: '∅' }) : c);
        b._on = () => S.charm === c;
        sel.push(b);
        return b;
      })));
      kids.push(h('p.side-label', { text: 'Background' }));
      kids.push(h('div.filter-row', {}, BACKDROPS.map((id) => {
        const c = document.createElement('canvas');
        c.width = c.height = 96;
        const g = c.getContext('2d');
        if (id === 'soft') {
          const gr = g.createLinearGradient(0, 0, 96, 96);
          gr.addColorStop(0, '#FFD1E6'); gr.addColorStop(1, '#C9B6FF');
          g.fillStyle = gr; g.fillRect(0, 0, 96, 96);
        } else renderBackdropSwatch(g, id);
        const b = h('button.bg-chip', { 'aria-label': `${id} background`, onclick: () => { S.bg = id; savePrefs(); update(); } }, [c, h('span', { text: id === 'soft' ? 'soft' : frameById(id).name })]);
        b._on = () => S.bg === id;
        sel.push(b);
        return b;
      })));
    } else if (y2k) {
      const frameIds = FRAMES.filter((f) => f.pack === 'y2k' || ['black', 'white', 'pink', 'blue'].includes(f.id)).map((f) => f.id);
      kids.push(h('p.side-label', { text: 'Frame colour' }));
      kids.push(h('div.filter-row.frame-row', {}, frameIds.map((id) => {
        const { cssW, cssH, scale } = fit(S.layout, 56, 120);
        const c = renderStrip({ layout: S.layout, frame: id, photos: [], caption: '', showDate: false }, scale);
        c.style.width = `${cssW}px`; c.style.height = `${cssH}px`;
        const b = h('button.frame-chip', { 'aria-label': `${frameById(id).name} frame`, onclick: () => { S.frame = id; update(); } }, [c, h('span', { text: frameById(id).name })]);
        b._on = () => S.frame === id;
        sel.push(b);
        return b;
      })));
    }

    kids.push(h('p.side-label', { text: 'Filter' }), h('div.filter-row', {}, cards));

    if (!(y2k && S.format === 'device')) {
      const caption = h('input.field', {
        type: 'text', maxLength: 28, value: S.caption, placeholder: 'Write something', 'aria-label': 'Caption',
        oninput: () => { S.caption = caption.value; savePrefs(); schedule(); },
      });
      kids.push(h('p.side-label', { text: 'Caption' }), caption);
    }
    kids.push(toggle('Date stamp on photos', () => S.stamp, (v) => { S.stamp = v; }));
    if (y2k && S.format === 'device') kids.push(toggle('Screen info (battery, file no.)', () => S.hud, (v) => { S.hud = v; }));
    else kids.push(toggle('Print today’s date below', () => S.showDate, (v) => { S.showDate = v; savePrefs(); }));

    if (y2k && S.format === 'device') kids.push(creditLine());
    side.replaceChildren(...kids);
    side._sel = sel;
    update();
  }

  function update() {
    st.draw();
    for (const b of side._sel || []) b.classList.toggle('is-selected', b._on());
  }
  build();
  fontsReady.then(() => st && update());
  if (y2k) loadDeviceImages().then(() => { if (S.scene === 'style') build(); });

  app.append(h('main.scene.split', {}, [hd.root, h('div.split-body', {}, [previewWrap, side])]));
  return () => cancelAnimationFrame(raf);
};

const STICKERS = ['💖', '💕', '💘', '🤍', '🖤', '✨', '⭐', '🌟', '💫', '🌸', '🌷', '🌹', '💐', '🎀', '👑', '🍒', '🍓', '🍰', '🧁', '🍭', '🧸', '🐻', '🐰', '🐱', '🐶', '🦋', '🌈', '☁️', '🌙', '☀️', '🔥', '🎉', '🎈', '🎂', '📸', '💌', '🫶', '✌️', '😘', '🥰', '😎', '🤪', '👀', '💋', '🍀', '🫧'];
const Y2K_STICKERS = ['✨', '💖', '💜', '🦋', '🍒', '🎀', '⭐', '💫', '👑', '💿', '📀', '📼', '📟', '📱', '💾', '🎧', '🪩', '🫧', '💋', '🖤', '🌸', '🍓', '🧸', '🐰', '👼', '🔮', '💅', '👾', '😜', '🥺', '😘', '🌈'];
const WORDS = [['xoxo', '#FF3EA5'], ['luv u', '#B44CFF'], ['<3', '#FF2E63'], ['BFF', '#2E7DFF'], ['y2k', '#00B894'], ['cutie', '#FF7A00'], ['4ever', '#B44CFF'], ['OMG', '#FF2E63']];
const INKS = ['#17181C', '#FFFFFF', '#FF7BA3', '#FF4D4D', '#FFB23F', '#FFE45C', '#5BD08A', '#5FA0FF', '#9B7BFF'];

SCENES.decorate = () => {
  const hd = header({ step: 'style', title: 'Decorate', sub: 'Stickers and doodles. Totally optional.', next: () => go('done'), nextLabel: 'Done' });
  const box = previewBox();
  const { cssW, cssH, scale } = fit(S.layout, box.maxW, box.maxH);
  const base = h('canvas.layer');
  const ink = h('canvas.layer');
  const stickerLayer = h('div.sticker-layer');
  const stage = h('div.strip-stage.deco-stage', { style: { width: `${cssW}px`, height: `${cssH}px` } }, [base, ink, stickerLayer]);
  const Lo = L();
  const W = Math.round(Lo.W * scale), H = Math.round(Lo.H * scale);
  ink.width = W; ink.height = H;

  let mode = 'sticker';
  let selected = null;     // sticker object
  let pen = { color: INKS[2], size: 0.012 };
  const history = [];
  const snapshot = () => { history.push(JSON.stringify(S.deco)); if (history.length > 60) history.shift(); undoBtn.disabled = false; };

  function drawBase() { renderStrip(stripOpts(), scale, base); }
  function drawInk(extra) {
    const g = ink.getContext('2d');
    g.clearRect(0, 0, W, H);
    for (const s of S.deco.strokes) drawStroke(g, s, W, H);
    if (extra) drawStroke(g, extra, W, H);
  }

  function drawStickers() {
    stickerLayer.replaceChildren(...S.deco.stickers.map((st) => {
      const isSel = st === selected;
      const n = h(`div.sticker${isSel ? '.is-sel' : ''}`, {
        style: { left: `${st.x * 100}%`, top: `${st.y * 100}%`, fontSize: `${st.size * cssW}px`, transform: `translate(-50%,-50%) rotate(${st.rot}rad)` },
      }, [h(`span.sticker-glyph${st.word ? '.word' : ''}`, { text: st.emoji, style: st.word ? { color: st.color } : {} })]);
      n.addEventListener('pointerdown', (e) => startDrag(e, st));
      if (isSel) {
        const del = h('button.handle.del', { html: ICON.close, 'aria-label': 'Remove sticker' });
        del.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); snapshot(); S.deco.stickers.splice(S.deco.stickers.indexOf(st), 1); selected = null; drawStickers(); });
        const rot = h('button.handle.rot', { html: ICON.rotate, 'aria-label': 'Resize or rotate' });
        rot.addEventListener('pointerdown', (e) => startTransform(e, st));
        n.append(del, rot);
      }
      return n;
    }));
  }

  const rect = () => stage.getBoundingClientRect();

  // drag (one finger) and pinch (two fingers) on a sticker
  const pointers = new Map();
  let gesture = null;
  function startDrag(e, st) {
    if (mode !== 'sticker') return;
    e.stopPropagation(); e.preventDefault();
    if (selected !== st) { selected = st; drawStickers(); }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) {
      snapshot();
      gesture = { kind: 'drag', st, x0: st.x, y0: st.y, px: e.clientX, py: e.clientY };
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      gesture = { kind: 'pinch', st, d0: Math.hypot(b.x - a.x, b.y - a.y), a0: Math.atan2(b.y - a.y, b.x - a.x), size0: st.size, rot0: st.rot };
    }
  }
  function startTransform(e, st) {
    e.stopPropagation(); e.preventDefault();
    snapshot();
    const r = rect();
    const cx = r.left + st.x * r.width, cy = r.top + st.y * r.height;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    gesture = { kind: 'handle', st, cx, cy, d0: Math.hypot(e.clientX - cx, e.clientY - cy), a0: Math.atan2(e.clientY - cy, e.clientX - cx), size0: st.size, rot0: st.rot };
  }
  function onMove(e) {
    if (!gesture || !pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture, st = g.st, r = rect();
    if (g.kind === 'drag') {
      st.x = Math.min(1, Math.max(0, g.x0 + (e.clientX - g.px) / r.width));
      st.y = Math.min(1, Math.max(0, g.y0 + (e.clientY - g.py) / r.height));
    } else if (g.kind === 'pinch' && pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(b.x - a.x, b.y - a.y), ang = Math.atan2(b.y - a.y, b.x - a.x);
      st.size = clampSize(g.size0 * (d / g.d0));
      st.rot = g.rot0 + (ang - g.a0);
    } else if (g.kind === 'handle') {
      const d = Math.hypot(e.clientX - g.cx, e.clientY - g.cy), ang = Math.atan2(e.clientY - g.cy, e.clientX - g.cx);
      st.size = clampSize(g.size0 * (d / Math.max(g.d0, 1)));
      st.rot = g.rot0 + (ang - g.a0);
    }
    const n = stickerLayer.querySelector('.sticker.is-sel');
    if (n) {
      n.style.left = `${st.x * 100}%`; n.style.top = `${st.y * 100}%`;
      n.style.fontSize = `${st.size * cssW}px`; n.style.transform = `translate(-50%,-50%) rotate(${st.rot}rad)`;
    }
  }
  function onUp(e) {
    pointers.delete(e.pointerId);
    if (!pointers.size) gesture = null;
    else if (gesture?.kind === 'pinch') {
      const [p] = [...pointers.values()];
      gesture = { kind: 'drag', st: gesture.st, x0: gesture.st.x, y0: gesture.st.y, px: p.x, py: p.y };
    }
  }
  const clampSize = (s) => Math.min(0.9, Math.max(0.04, s));
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);

  stickerLayer.addEventListener('pointerdown', (e) => { if (e.target === stickerLayer && selected) { selected = null; drawStickers(); } });

  // doodling
  let stroke = null;
  ink.addEventListener('pointerdown', (e) => {
    if (mode !== 'draw') return;
    e.preventDefault();
    ink.setPointerCapture(e.pointerId);
    const r = rect();
    stroke = { color: pen.color, width: pen.size * (Lo.W > Lo.H ? Lo.H / Lo.W : 1), points: [[(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]] };
    drawInk(stroke);
  });
  ink.addEventListener('pointermove', (e) => {
    if (!stroke) return;
    const r = rect();
    const p = [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height];
    const last = stroke.points[stroke.points.length - 1];
    if (Math.hypot((p[0] - last[0]) * r.width, (p[1] - last[1]) * r.height) < 1.5) return;
    stroke.points.push(p);
    drawInk(stroke);
  });
  const endStroke = () => {
    if (!stroke) return;
    snapshot();
    S.deco.strokes.push(stroke);
    stroke = null;
    drawInk();
  };
  ink.addEventListener('pointerup', endStroke);
  ink.addEventListener('pointercancel', endStroke);

  // tools
  const undoBtn = h('button.tool', { onclick: undo, disabled: true }, [icon('undo'), h('span', { text: 'Undo' })]);
  const clearBtn = h('button.tool', { onclick: clearAll }, [icon('trash'), h('span', { text: 'Clear' })]);
  function undo() {
    const prev = history.pop();
    if (prev == null) return;
    S.deco = JSON.parse(prev);
    selected = null;
    drawStickers(); drawInk();
    undoBtn.disabled = !history.length;
  }
  function clearAll() {
    if (!S.deco.stickers.length && !S.deco.strokes.length) return;
    snapshot();
    S.deco = { stickers: [], strokes: [] };
    selected = null;
    drawStickers(); drawInk();
  }

  const stickerSize = (Lo.slots[0].h * 0.34) / Lo.W;
  const addSticker = (extra) => {
    snapshot();
    const st = { x: 0.3 + Math.random() * 0.4, y: 0.2 + Math.random() * 0.6, size: stickerSize, rot: (Math.random() - 0.5) * 0.5, ...extra };
    S.deco.stickers.push(st);
    selected = st;
    drawStickers();
  };
  const y2kMode = S.mode === 'digicam';
  const stickerPanel = h('div.sticker-grid', {}, [
    ...(y2kMode ? WORDS : []).map(([w, color]) => h('button.sticker-btn.word-btn', {
      text: w, style: { color }, 'aria-label': `Add ${w}`,
      onclick: () => addSticker({ emoji: w, word: true, color, size: stickerSize * 0.8 }),
    })),
    ...(y2kMode ? Y2K_STICKERS : STICKERS).map((em) => h('button.sticker-btn', {
      text: em, 'aria-label': `Add ${em}`, onclick: () => addSticker({ emoji: em }),
    })),
  ]);
  const swatches = INKS.map((c) => h(`button.swatch${pen.color === c ? '.on' : ''}`, {
    style: { background: c }, 'aria-label': `Colour ${c}`,
    onclick: () => { pen.color = c; swatches.forEach((s, i) => s.classList.toggle('on', INKS[i] === c)); },
  }));
  const sizes = [[0.006, 'S'], [0.012, 'M'], [0.022, 'L']].map(([v, label]) => h(`button.seg${pen.size === v ? '.on' : ''}`, {
    text: label, onclick: () => { pen.size = v; sizes.forEach((s) => s.classList.toggle('on', s.textContent === label)); },
  }));
  const drawPanel = h('div.draw-panel', { hidden: true }, [h('div.swatches', {}, swatches), h('div.segs', { role: 'group', 'aria-label': 'Pen size' }, sizes)]);

  const modeTabs = [['sticker', 'Stickers'], ['draw', 'Draw']].map(([id, label]) => h(`button.tab${mode === id ? '.is-open' : ''}`, {
    text: label, role: 'tab',
    onclick: () => {
      mode = id;
      modeTabs.forEach((t, i) => t.classList.toggle('is-open', ['sticker', 'draw'][i] === id));
      stickerPanel.hidden = id !== 'sticker'; drawPanel.hidden = id !== 'draw';
      stage.classList.toggle('drawing', id === 'draw');
      if (id === 'draw' && selected) { selected = null; drawStickers(); }
    },
  }));

  // device format: each cut is its own picture with its own stickers
  const cutRow = deviceFormat() && S.shots.length > 1 ? h('div.cut-row', {}, S.shots.map((shot, i) => h(`button.cut-thumb${S.cut === i ? '.is-selected' : ''}`, {
    'aria-label': `Photo ${i + 1}`,
    onclick: () => {
      selectCut(i);
      selected = null;
      history.length = 0; undoBtn.disabled = true;
      cutRow.querySelectorAll('.cut-thumb').forEach((b, k) => b.classList.toggle('is-selected', k === i));
      drawBase(); drawInk(); drawStickers();
    },
  }, h('img', { src: shot.thumb, alt: '' })))) : null;

  drawBase(); drawInk(); drawStickers();
  fontsReady.then(drawBase);
  if (deviceFormat()) loadDeviceImages().then(() => { if (S.scene === 'decorate') drawBase(); });

  app.append(h('main.scene.split', {}, [hd.root, h('div.split-body', {}, [
    h('div.split-preview', {}, stage),
    h('div.split-side', {}, [
      cutRow,
      h('div.tabs.small', { role: 'tablist' }, [...modeTabs, h('span.spacer'), undoBtn, clearBtn]),
      stickerPanel, drawPanel,
    ]),
  ])]));

  return () => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
  };
};

SCENES.done = () => (deviceFormat() ? doneDevices() : doneStrip());

function doneStrip() {
  const hd = header({ step: 'done', title: S.layout === 'polaroid' ? 'Your photo is ready' : 'Your strip is ready', sub: 'Save it, send it, print it.' });
  const imgWrap = h('div.final', { 'data-layout': S.layout });
  const saveBtn = h('button.btn.primary.big', { disabled: true }, [icon('download'), h('span', { text: 'Save photo' })]);
  const shareBtn = h('button.btn.ghost.big', { hidden: true }, [icon('share'), h('span', { text: 'Share' })]);
  const n = photos().filter(Boolean).length;
  const eachBtn = n > 1 ? h('button.btn.ghost.big', { onclick: saveEach }, [icon('image'), h('span', { text: `Save the ${n} photos separately` })]) : null;
  const tip = h('p.fineprint', { text: '' });
  const y2k = S.mode === 'digicam';
  let url = null, file = null;

  app.append(h('main.scene.done', {}, [hd.root, h('div.done-body', {}, [
    imgWrap,
    h('div.done-side', {}, [
      saveBtn, shareBtn, eachBtn, tip,
      h('div.done-more', {}, [
        h('button.choice', { onclick: () => { resetShots(); go(y2k ? 'digicam' : 'shoot'); } }, [h('strong', { text: 'Shoot again' }), h('span', { text: y2k ? 'same camera' : 'same frame' })]),
        h('button.choice', { onclick: () => { resetShots(); go('start'); } }, [h('strong', { text: 'New strip' }), h('span', { text: 'start over' })]),
      ]),
    ]),
  ])]));

  (async () => {
    await fontsReady;
    const canvas = renderStrip(stripOpts({ deco: S.deco }), L().exportScale);
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
    const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
    const name = `photobooth-${stamp}.png`;
    url = URL.createObjectURL(blob);
    file = new File([blob], name, { type: 'image/png' });
    imgWrap.append(h('img.final-img', { src: url, alt: 'Your photo strip' }));
    confetti();

    const canShareFile = !!(navigator.canShare && navigator.canShare({ files: [file] }));
    const mobile = matchMedia('(pointer: coarse)').matches;
    saveBtn.disabled = false;
    saveBtn.onclick = async () => {
      if (canShareFile && mobile) {
        try { await navigator.share({ files: [file] }); return; } catch (e) { if (e.name === 'AbortError') return; }
      }
      const a = h('a', { href: url, download: name });
      document.body.append(a); a.click(); a.remove();
    };
    if (canShareFile && !mobile) {
      shareBtn.hidden = false;
      shareBtn.onclick = () => navigator.share({ files: [file] }).catch(() => {});
    }
    if (mobile && !canShareFile) {
      shareBtn.hidden = false;
      shareBtn.replaceChildren(icon('download'), h('span', { text: 'Download file' }));
      shareBtn.onclick = () => { const a = h('a', { href: url, download: name }); document.body.append(a); a.click(); a.remove(); };
    }
    tip.textContent = mobile ? 'Tip: you can also press and hold the strip to save it to Photos.' : `${canvas.width} × ${canvas.height} PNG, print-ready.`;
  })();

  // Each photo on its own, filter and stamp included, full resolution.
  async function saveEach() {
    eachBtn.disabled = true;
    try {
      const Lo = L(), k = Lo.exportScale;
      const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
      const files = [];
      const list = photos();
      for (let i = 0; i < list.length; i++) {
        if (!list[i]) continue;
        const w = Math.round(Lo.slots[i].w * k * 2), hh = Math.round(Lo.slots[i].h * k * 2);
        const c = document.createElement('canvas');
        c.width = w; c.height = hh;
        const g = c.getContext('2d');
        g.drawImage(photoFor(list[i], w, hh, S.filter), 0, 0);
        if (S.stamp) drawStamp(g, 0, 0, w, hh);
        const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.92));
        files.push(new File([blob], `photobooth-${stamp}-${files.length + 1}.jpg`, { type: 'image/jpeg' }));
      }
      const mobile = matchMedia('(pointer: coarse)').matches;
      if (mobile && navigator.canShare && navigator.canShare({ files })) {
        try { await navigator.share({ files }); return; } catch (e) { if (e.name === 'AbortError') return; }
      }
      for (const f of files) {
        const u = URL.createObjectURL(f);
        const a = h('a', { href: u, download: f.name });
        document.body.append(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(u), 4000);
        await new Promise((r) => setTimeout(r, 350));
      }
    } finally {
      eachBtn.disabled = false;
    }
  }

  return () => { if (url) setTimeout(() => URL.revokeObjectURL(url), 1000); };
}

function renderBackdropSwatch(g, id) {
  paintFrame(g, frameById(id), 96, 96, 0.22, 1);
}

// The photo credit a real device's licence asks for.
function creditLine() {
  const d = DEVICES[S.device];
  if (!d?.real) return null;
  const c = d.credit;
  return h('p.credit', {}, ['Device photo: ', h('a', { href: c.url, target: '_blank', rel: 'noopener', text: `${c.what}` }), ` by ${c.author}, ${c.license}`]);
}

// Device format: every cut comes out as its own picture of the device.
function doneDevices() {
  const n = S.shots.length;
  const hd = header({ step: 'done', title: n > 1 ? 'Your photos are ready' : 'Your photo is ready', sub: n > 1 ? 'Swipe through them, then save.' : 'Save it, send it, post it.' });
  const gallery = h('div.device-gallery', { 'data-device': S.device });
  const dots = h('div.gallery-dots');
  const saveBtn = h('button.btn.primary.big', { disabled: true }, [icon('download'), h('span', { text: n > 1 ? `Save all ${n} photos` : 'Save photo' })]);
  const oneBtn = n > 1 ? h('button.btn.ghost.big', { disabled: true }, [icon('image'), h('span', { text: 'Save just this one' })]) : null;
  const tip = h('p.fineprint', { text: '' });
  const files = [], urls = [];

  app.append(h('main.scene.done', {}, [hd.root, h('div.done-body', {}, [
    h('div.gallery-wrap', {}, [gallery, n > 1 ? dots : null]),
    h('div.done-side', {}, [
      saveBtn, oneBtn, tip, creditLine(),
      h('div.done-more', {}, [
        h('button.choice', { onclick: () => { resetShots(); go('digicam'); } }, [h('strong', { text: 'Shoot again' }), h('span', { text: 'same device' })]),
        h('button.choice', { onclick: () => { resetShots(); go('start'); } }, [h('strong', { text: 'New photos' }), h('span', { text: 'start over' })]),
      ]),
    ]),
  ])]));

  const current = () => Math.round(gallery.scrollLeft / Math.max(1, gallery.clientWidth));
  gallery.addEventListener('scroll', () => {
    const i = current();
    dots.querySelectorAll('i').forEach((d, k) => d.classList.toggle('on', k === i));
  }, { passive: true });

  const mobile = matchMedia('(pointer: coarse)').matches;
  async function deliver(list) {
    if (mobile && navigator.canShare && navigator.canShare({ files: list })) {
      try { await navigator.share({ files: list }); return; } catch (e) { if (e.name === 'AbortError') return; }
    }
    for (const f of list) {
      const a = h('a', { href: urls[files.indexOf(f)], download: f.name });
      document.body.append(a); a.click(); a.remove();
      await new Promise((r) => setTimeout(r, 350));
    }
  }

  (async () => {
    await fontsReady;
    await loadDeviceImages();
    S.decos[S.cut] = S.deco;
    const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
    for (let i = 0; i < n; i++) {
      const canvas = renderStrip(stripOpts({ photos: [S.shots[i]], index: i, deco: S.decos[i] }), L().exportScale);
      const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
      const f = new File([blob], `digicam-${stamp}-${i + 1}.png`, { type: 'image/png' });
      files.push(f);
      urls.push(URL.createObjectURL(blob));
      gallery.append(h('div.gallery-item', {}, h('img.final-img', { src: urls[i], alt: `Photo ${i + 1}` })));
      dots.append(h(`i${i === 0 ? '.on' : ''}`));
    }
    confetti();
    saveBtn.disabled = false;
    saveBtn.onclick = () => deliver(files);
    if (oneBtn) { oneBtn.disabled = false; oneBtn.onclick = () => deliver([files[current()]]); }
    tip.textContent = mobile ? 'Tip: press and hold a photo to save it to Photos.' : 'PNG files, full resolution.';
  })();

  return () => setTimeout(() => urls.forEach((u) => URL.revokeObjectURL(u)), 1000);
}

SCENES.digicam = digicamScene({
  S, h, icon, ICON, toast, header, go, back, savePrefs, fontsReady, addShot, resetShots, autoFill, setMode, syncLayout,
  get app() { return app; },
});

function confetti() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const box = h('div.confetti', { 'aria-hidden': 'true' });
  const cols = ['#FF7BA3', '#5FA0FF', '#FFC94D', '#7ED6A5', '#B48CF2'];
  for (let i = 0; i < 70; i++) {
    box.append(h('i', { style: {
      left: `${Math.random() * 100}%`, background: cols[i % cols.length],
      animationDelay: `${Math.random() * 0.5}s`, animationDuration: `${1.8 + Math.random() * 1.4}s`,
      transform: `rotate(${Math.random() * 360}deg)`,
    } }));
  }
  document.body.append(box);
  setTimeout(() => box.remove(), 3800);
}

go('start');

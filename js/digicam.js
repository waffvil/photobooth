// Y2K digicam mode: pick a device (digicam, slim cam, flip phone, phone) and a body
// colour, see yourself live on its screen, and snap each cut by hand. By default each
// photo comes out *on the device*, the way it looked when you took it.
import { Y2K_FILTERS, filterById } from './filters.js';
import { drawStamp } from './render.js';
import { LAYOUTS } from './layouts.js';
import { DEVICES, DEVICE_ORDER, TINTS, CHARMS, drawDevice, drawScreenHud, loadDeviceImages } from './devices.js';
import { hasCamera, openCamera, closeCamera, grabFrame, fileToCanvas, unlockAudio, beep, shutter, focusBeep } from './camera.js';

export const EDITIONS = [
  { id: 'lace', name: 'Lace', frame: 'lace', filter: 'd2000', caption: 'lace edition',
    page: 'radial-gradient(120% 80% at 50% 18%, #8A55B8 0%, #3A1A5C 55%, #1E0C33 100%)' },
  { id: 'chrome', name: 'Chrome', frame: 'chrome', filter: 'glow', caption: 'digicam 2000',
    page: 'radial-gradient(120% 80% at 50% 18%, #9AA3B5 0%, #4A5263 55%, #1F232B 100%)' },
  { id: 'candy', name: 'Candy', frame: 'candy', filter: 'glow', caption: 'xoxo',
    page: 'radial-gradient(120% 80% at 50% 18%, #FF8CC6 0%, #B0306F 55%, #4E0F31 100%)' },
  { id: 'midnight', name: 'Midnight', frame: 'cyber', filter: 'bnw', caption: 'no signal',
    page: 'radial-gradient(120% 80% at 50% 18%, #3A3A4C 0%, #121219 55%, #000 100%)' },
  { id: 'mint', name: 'Mint', frame: 'butterfly', filter: 'ccd', caption: 'flutter',
    page: 'radial-gradient(120% 80% at 50% 18%, #5FCFAA 0%, #1D6B52 55%, #0A2E23 100%)' },
  { id: 'dream', name: 'Dream', frame: 'dream', filter: 'd2000', caption: 'sweet dreams',
    page: 'linear-gradient(170deg, #6FA8FF 0%, #A985F0 50%, #F06BAE 100%)' },
];
export const editionById = (id) => EDITIONS.find((e) => e.id === id) || EDITIONS[0];

const ICONS = {
  flip: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11a8 8 0 0 0-14.3-4.9L4 8"/><path d="M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14.3 4.9L20 16"/><path d="M20 20v-4h-4"/></svg>',
};

// A device drawn into a canvas element at a CSS size (no backdrop), for pickers and
// the live camera. Returns the canvas and the CSS scale it was drawn at.
// A little retro "window" with a title bar, for grouping controls.
export function win(h, title, kids) {
  return h('section.win', {}, [h('div.win-bar', {}, [h('span', { text: title }), h('span.win-btns', {}, [h('i'), h('i'), h('i')])]), h('div.win-body', {}, kids)]);
}

export function deviceCanvas(deviceId, skinId, maxW, maxH, extra = {}) {
  const L = LAYOUTS[`dev-${deviceId}`];
  const k = Math.min(maxW / L.W, maxH / L.H);
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const c = document.createElement('canvas');
  c.width = Math.round(L.W * k * dpr); c.height = Math.round(L.H * k * dpr);
  c.style.width = `${L.W * k}px`; c.style.height = `${L.H * k}px`;
  drawDevice(c.getContext('2d'), deviceId, skinId, k * dpr, { backdrop: false, ...extra });
  return { canvas: c, k, L };
}

export function digicamScene(ctx) {
  const { S, h, toast, header, go, savePrefs, fontsReady, addShot, syncLayout } = ctx;

  return () => {
    let alive = true;
    let busy = false;
    let camReady = false;
    if (![0, 3, 5].includes(S.dcTimer)) S.dcTimer = 0;

    const hd = header({ step: 'shoot', title: '', sub: '' });
    hd.titleEl.remove(); hd.subEl.remove();
    const counter = h('span.dc-counter');
    hd.root.querySelector('.topbar').append(counter);

    // --- the live device ----------------------------------------------------------
    const video = h('video', { autoplay: true, muted: true, playsinline: true });
    const review = h('img.dc-review', { alt: '', hidden: true });
    const hudCanvas = h('canvas.dc-hudc');
    const countdown = h('div.dc-count');
    const flash = h('div.flash');
    const lcdMsg = h('div.dc-lcd-msg', { hidden: true });
    const screen = h('div.dc-screen', {}, [video, review, hudCanvas, countdown, flash, lcdMsg]);
    const stage = h('div.dc-stage');

    // --- pickers ------------------------------------------------------------------
    const devBtns = DEVICE_ORDER.map((id) => h('button.dc-dev', { 'aria-label': DEVICES[id].name, onclick: () => setDevice(id) }));
    const devRow = h('div.dc-devs', {}, devBtns);
    const tintChips = TINTS.map((t) => h('button.dc-ed', { 'aria-label': `${t.name} colour`, onclick: () => setTint(t.id) },
      [h(`span.swatch-dot.tint-${t.id}`), h('span', { text: t.name })]));
    const edRow = h('div.dc-eds', {}, tintChips);
    const charmChips = CHARMS.map((c) => h('button.charm-chip', { 'aria-label': c === 'none' ? 'No charm' : `${c} charm`, onclick: () => setCharm(c) }, c === 'none' ? h('span.none', { text: '∅' }) : c));
    const charmRow = h('div.dc-charms', {}, charmChips);
    const fChips = Y2K_FILTERS.map((f) => h('button.dc-chip', { text: f.name, onclick: () => setFilter(f.id) }));

    // --- controls -----------------------------------------------------------------
    const fileInput = h('input', { type: 'file', accept: 'image/*', multiple: true, hidden: true, onchange: onFiles });
    const snapBtn = h('button.dc-snap', { text: 'Snap', onclick: snap });
    const uploadBtn = h('button.dc-small', { text: 'Upload', onclick: () => fileInput.click() });
    const flipBtn = h('button.dc-small.dc-flip', { 'aria-label': 'Switch camera', html: ICONS.flip, onclick: flip });
    const cutSegs = [1, 2, 3, 4].map((n) => h('button.seg', { text: String(n), onclick: () => setCuts(n) }));
    const timerSegs = [[0, 'off'], [3, '3s'], [5, '5s']].map(([t, label]) => h('button.seg', { text: label, onclick: () => setTimer(t) }));
    const settings = h('div.dc-settings', {}, [
      h('div.segs', { role: 'group', 'aria-label': 'Cuts' }, [h('span.dc-seg-label', { text: 'CUTS' }), ...cutSegs]),
      h('div.segs', { role: 'group', 'aria-label': 'Self-timer' }, [h('span.dc-seg-label', { text: 'TIMER' }), ...timerSegs]),
    ]);
    const tray = h('div.dc-tray');
    const hint = h('p.dc-hint', { text: 'Tap a cut to retake it.' });

    ctx.app.append(h('main.scene.dc', {}, [
      hd.root,
      h('h1.dc-logo', {}, [h('span.spark.s1', { text: '✦' }), h('span', { text: 'digicam' }), h('span.spark.s2', { text: '♡' })]),
      win(h, 'Choose Digital Camera', [devRow]),
      h('div.dc-stage-wrap', {}, [h('span.spark.s3', { text: '✧' }), stage, h('span.spark.s4', { text: '★' })]),
      h('div.dc-controls', {}, [uploadBtn, snapBtn, flipBtn]),
      tray,
      hint,
      win(h, 'Make it yours', [
        h('p.dc-row-label', { text: 'colour' }), edRow,
        h('p.dc-row-label', { text: 'phone charm' }), charmRow,
        h('p.dc-row-label', { text: 'look' }), h('div.dc-chips', {}, fChips),
        settings,
      ]),
      fileInput,
    ]));

    // --- drawing --------------------------------------------------------------------
    let screenBox = null;
    function drawStage() {
      const maxW = Math.min(stage.clientWidth || window.innerWidth - 32, 460);
      const portrait = DEVICES[S.device].kind === 'phone';
      const maxH = portrait ? Math.min(window.innerHeight * 0.5, 500) : 320;
      const { canvas, k, L } = deviceCanvas(S.device, S.edition, maxW, maxH, { tint: S.tint, charm: S.charm });
      const sl = L.slots[0];
      screenBox = { w: sl.w * k, h: sl.h * k };
      Object.assign(screen.style, { left: `${sl.x * k}px`, top: `${sl.y * k}px`, width: `${screenBox.w}px`, height: `${screenBox.h}px` });
      stage.style.width = canvas.style.width;
      stage.style.height = canvas.style.height;
      stage.replaceChildren(canvas, screen);
      drawHud();
    }
    function drawHud() {
      if (!screenBox) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      const w = Math.round(screenBox.w * dpr), hh = Math.round(screenBox.h * dpr);
      hudCanvas.width = w; hudCanvas.height = hh;
      const g = hudCanvas.getContext('2d');
      g.clearRect(0, 0, w, hh);
      const phone = DEVICES[S.device].kind === 'phone';
      if (S.stamp) drawStamp(g, 0, 0, w, hh * (phone ? 0.92 : 1));
      drawScreenHud(g, S.device, 0, 0, w, hh, { index: Math.min(S.shots.length, S.cuts - 1), total: S.cuts });
    }
    function drawDeviceButtons() {
      devBtns.forEach((b, i) => {
        const id = DEVICE_ORDER[i];
        const { canvas } = deviceCanvas(id, S.edition, 64, 56, { tint: S.tint });
        b.replaceChildren(h('span.dc-dev-art', {}, canvas), h('span', { text: DEVICES[id].name }));
      });
    }

    function paint() {
      devBtns.forEach((b, i) => b.classList.toggle('on', DEVICE_ORDER[i] === S.device));
      tintChips.forEach((c, i) => c.classList.toggle('on', TINTS[i].id === S.tint));
      charmChips.forEach((c, i) => c.classList.toggle('on', CHARMS[i] === S.charm));
      fChips.forEach((c, i) => c.classList.toggle('on', Y2K_FILTERS[i].id === S.filter));
      cutSegs.forEach((c, i) => c.classList.toggle('on', i + 1 === S.cuts));
      timerSegs.forEach((c, i) => c.classList.toggle('on', [0, 3, 5][i] === S.dcTimer));
      const css = filterById(S.filter).css || 'none';
      video.style.filter = css;
      review.style.filter = css;
      counter.textContent = `${S.shots.length}/${S.cuts}`;
      const L = LAYOUTS[`dev-${S.device}`];
      tray.style.setProperty('--n', S.cuts);
      tray.style.setProperty('--ar', `${L.slots[0].w} / ${L.slots[0].h}`);
      tray.replaceChildren(...Array.from({ length: S.cuts }, (_, i) => {
        const shot = S.shots[i];
        if (!shot) return h('span.dc-cut', { text: String(i + 1) });
        return h('button.dc-cut.filled', { 'aria-label': `Retake cut ${i + 1}`, onclick: () => removeShot(i) },
          h('img', { src: shot.thumb, alt: '', style: { filter: css } }));
      }));
      hint.hidden = !S.shots.length;
      settings.classList.toggle('locked', busy);
      snapBtn.disabled = busy || !camReady;
      drawHud();
    }

    function setDevice(id) {
      if (busy) return;
      S.device = id; syncLayout(); savePrefs();
      drawStage(); paint();
    }
    function setFilter(id) { S.filter = id; paint(); }
    function setTint(id) { S.tint = id; savePrefs(); drawStage(); drawDeviceButtons(); paint(); }
    function setCharm(c) { S.charm = c; savePrefs(); drawStage(); paint(); }
    function setCuts(n) {
      if (busy) return;
      S.cuts = n;
      if (S.shots.length > n) S.shots.length = n;
      syncLayout(); savePrefs(); paint();
    }
    function setTimer(t) { S.dcTimer = t; paint(); }
    function removeShot(i) {
      if (busy) return;
      S.shots.splice(i, 1);
      paint();
    }

    // --- camera -----------------------------------------------------------------------
    async function startCam() {
      lcdMsg.hidden = true;
      camReady = false;
      paint();
      if (!hasCamera()) { noCam('This browser can’t open a camera.'); return; }
      try {
        await openCamera(video, S.facing);
        if (!alive) { closeCamera(); return; }
        video.classList.toggle('mirror', S.facing === 'user');
        camReady = true;
        paint();
      } catch (e) {
        if (!alive) return;
        const denied = e && (e.name === 'NotAllowedError' || e.name === 'SecurityError');
        noCam(denied ? 'Camera blocked. Allow it in your browser settings, or upload photos.' : 'No camera found. You can upload photos instead.');
      }
    }
    function noCam(text) {
      lcdMsg.hidden = false;
      lcdMsg.replaceChildren(h('b', { text: 'NO CAMERA' }), h('span', { text }));
      paint();
    }
    async function flip() {
      if (busy) return;
      S.facing = S.facing === 'user' ? 'environment' : 'user';
      await startCam();
    }

    const wait = (ms) => new Promise((r) => setTimeout(r, ms));

    async function snap() {
      if (busy || !camReady || !video.videoWidth || S.shots.length >= S.cuts) return;
      busy = true;
      unlockAudio();
      paint();
      for (let s = S.dcTimer; s > 0; s--) {
        if (!alive) return;
        countdown.textContent = String(s);
        countdown.classList.remove('tick'); void countdown.offsetWidth; countdown.classList.add('tick');
        beep(s === 1 ? 1760 : 1318, s === 1 ? 0.18 : 0.12);
        await wait(1000);
      }
      if (!alive) return;
      countdown.textContent = '';
      if (!S.dcTimer) { focusBeep(); await wait(200); if (!alive) return; }
      shutter();
      flash.classList.remove('go'); void flash.offsetWidth; flash.classList.add('go');
      const shot = addShot(grabFrame(video, S.facing === 'user'));
      review.src = shot.thumb;
      review.hidden = false;
      await wait(650);
      review.hidden = true;
      busy = false;
      paint();
      maybeFinish();
    }

    async function onFiles() {
      const room = S.cuts - S.shots.length;
      const files = [...fileInput.files].slice(0, Math.max(room, 0));
      fileInput.value = '';
      if (!files.length) { if (room <= 0) toast('All cuts are taken. Tap one to retake it.'); return; }
      busy = true; paint();
      for (const f of files) {
        try { addShot(await fileToCanvas(f)); } catch { toast('That photo couldn’t be opened.'); }
        if (!alive) return;
      }
      busy = false; paint();
      maybeFinish();
    }

    async function maybeFinish() {
      if (S.shots.length < S.cuts) return;
      busy = true; paint();
      await wait(500);
      if (!alive) return;
      go('style');
    }

    const onResize = () => drawStage();
    window.addEventListener('resize', onResize);
    syncLayout();
    drawStage(); drawDeviceButtons(); paint();
    fontsReady.then(() => { if (alive) { drawStage(); drawDeviceButtons(); paint(); } });
    startCam();
    loadDeviceImages().then(() => { if (alive) { drawStage(); drawDeviceButtons(); paint(); } });
    // keep the picked device in view in the scrolling row
    requestAnimationFrame(() => devBtns[DEVICE_ORDER.indexOf(S.device)]?.scrollIntoView({ inline: 'center', block: 'nearest' }));

    return () => { alive = false; closeCamera(); window.removeEventListener('resize', onResize); };
  };
}

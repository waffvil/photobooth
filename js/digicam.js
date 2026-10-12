// Y2K digicam mode: pick a camera "edition", see yourself on its LCD with a live
// digicam look, and snap each cut by hand. The shots then go through the same
// style / decorate / save steps as the classic booth.
import { Y2K_FILTERS, filterById } from './filters.js';
import { stampText } from './render.js';
import { hasCamera, openCamera, closeCamera, grabFrame, fileToCanvas, unlockAudio, beep, shutter } from './camera.js';

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

export function digicamScene(ctx) {
  const { S, h, icon, toast, header, go, savePrefs, fontsReady, addShot, autoFill } = ctx;

  return () => {
    let alive = true;
    let busy = false;
    let camReady = false;
    let ed = editionById(S.edition);
    if (![0, 3, 5].includes(S.dcTimer)) S.dcTimer = 0;

    const hd = header({ step: 'shoot', title: '', sub: '' });
    hd.titleEl.remove(); hd.subEl.remove();
    const counter = h('span.dc-counter');
    hd.root.querySelector('.topbar').append(counter);

    // --- the camera -----------------------------------------------------------
    const video = h('video', { autoplay: true, muted: true, playsinline: true });
    const review = h('img.dc-review', { alt: '', hidden: true });
    const countdown = h('div.dc-count');
    const flash = h('div.flash');
    const lcdMsg = h('div.dc-lcd-msg', { hidden: true });
    const hudCut = h('span');
    const hudStamp = h('span.dc-hud-stamp');
    const hud = h('div.dc-hud', { 'aria-hidden': 'true' }, [
      h('div.dc-hud-row', {}, [h('span', { text: '▣ P  ϟA' }), h('span.dc-batt', {}, [h('i'), h('i'), h('i')])]),
      h('div.dc-focus', {}, [h('i'), h('i'), h('i'), h('i')]),
      h('div.dc-hud-row', {}, [hudCut, hudStamp]),
    ]);
    const lcd = h('div.cam-lcd', {}, [video, review, hud, countdown, flash, lcdMsg]);
    const shutterBtn = h('button.cam-shutter', { 'aria-label': 'Shutter', onclick: snap });
    const cam = h('div.cam', {}, [
      h('div.cam-top', {}, [h('span.cam-dial'), shutterBtn]),
      lcd,
      h('div.cam-side', {}, [
        h('div.cam-btns', {}, [h('span', { text: '▶' }), h('span', { text: '◉' })]),
        h('span.cam-speaker'),
        h('span.cam-dpad', {}, h('span')),
        h('span.cam-small', { text: '⌫' }),
      ]),
    ]);

    // --- editions ---------------------------------------------------------------
    const edChips = EDITIONS.map((e) => h('button.dc-ed', {
      'aria-label': `${e.name} edition`,
      onclick: () => setEdition(e.id),
    }, [h(`span.cam-mini.skin-${e.id}`), h('span', { text: e.name })]));
    const edRow = h('div.dc-eds', {}, edChips);

    // --- filters ----------------------------------------------------------------
    const fChips = Y2K_FILTERS.map((f) => h('button.dc-chip', { text: f.name, onclick: () => setFilter(f.id) }));

    // --- controls ---------------------------------------------------------------
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
      h('h1.dc-logo', {}, [h('span', { text: 'digicam' }), h('sup', { text: '✦' })]),
      edRow,
      h('div.cam-wrap', {}, cam),
      h('div.dc-chips', {}, fChips),
      h('div.dc-controls', {}, [uploadBtn, snapBtn, flipBtn]),
      settings,
      tray,
      hint,
      fileInput,
    ]));

    // --- state → screen -----------------------------------------------------------
    function paint() {
      cam.className = `cam skin-${ed.id}`;
      edChips.forEach((c, i) => c.classList.toggle('on', EDITIONS[i].id === ed.id));
      fChips.forEach((c, i) => c.classList.toggle('on', Y2K_FILTERS[i].id === S.filter));
      cutSegs.forEach((c, i) => c.classList.toggle('on', i + 1 === S.cuts));
      timerSegs.forEach((c, i) => c.classList.toggle('on', [0, 3, 5][i] === S.dcTimer));
      const css = filterById(S.filter).css || 'none';
      video.style.filter = css;
      review.style.filter = css;
      counter.textContent = `${S.shots.length}/${S.cuts}`;
      hudCut.textContent = `${Math.min(S.shots.length + 1, S.cuts)}/${S.cuts}`;
      hudStamp.textContent = S.stamp ? stampText() : '';
      tray.style.setProperty('--n', S.cuts);
      tray.replaceChildren(...Array.from({ length: S.cuts }, (_, i) => {
        const shot = S.shots[i];
        if (!shot) return h('span.dc-cut', { text: String(i + 1) });
        return h('button.dc-cut.filled', { 'aria-label': `Retake cut ${i + 1}`, onclick: () => removeShot(i) },
          h('img', { src: shot.thumb, alt: '', style: { filter: filterById(S.filter).css || 'none' } }));
      }));
      hint.hidden = !S.shots.length;
      settings.classList.toggle('locked', busy);
      snapBtn.disabled = busy || (!camReady);
      document.body.style.setProperty('--y2k-bg', ed.page);
    }

    function setEdition(id) {
      ed = editionById(id);
      S.edition = id; S.frame = ed.frame; S.filter = ed.filter; S.caption = ed.caption;
      savePrefs();
      paint();
    }
    function setFilter(id) { S.filter = id; paint(); }
    function setCuts(n) {
      if (busy) return;
      S.cuts = n;
      S.layout = `y2k${n}`;
      if (S.shots.length > n) S.shots.length = n;
      savePrefs();
      paint();
    }
    function setTimer(t) { S.dcTimer = t; paint(); }
    function removeShot(i) {
      if (busy) return;
      S.shots.splice(i, 1);
      paint();
    }

    // --- camera ---------------------------------------------------------------------
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
        beep(s === 1 ? 1320 : 990, 0.06, 0.12);
        await wait(1000);
      }
      if (!alive) return;
      countdown.textContent = '';
      shutter();
      flash.classList.remove('go'); void flash.offsetWidth; flash.classList.add('go');
      shutterBtn.classList.add('down');
      const shot = addShot(grabFrame(video, S.facing === 'user'));
      review.src = shot.thumb;
      review.hidden = false;
      await wait(650);
      shutterBtn.classList.remove('down');
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
      S.layout = `y2k${S.cuts}`;
      autoFill();
      go('style');
    }

    S.layout = `y2k${S.cuts}`;
    paint();
    fontsReady.then(() => alive && paint());
    startCam();

    return () => { alive = false; closeCamera(); };
  };
}

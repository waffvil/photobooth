# Photobooth

A free online photobooth that runs in your browser. Take photos with your camera
(or pick them from your camera roll) and save them as a classic photobooth print.

**Live:** https://waffvil.github.io/photobooth/

## What it does

1. **Frame**: pick a size (4-cut strip, 2×2 card, 2-cut, or polaroid), then a frame
   (solid colours, patterns, seasonal).
2. **Shoot**: a countdown (3, 5 or 10 seconds) snaps each shot. You get a couple of
   spare shots, so you can drop the bad ones.
3. **Pick**: tap photos to place them in the boxes.
4. **Style**: one filter for the whole strip, plus a caption and the date.
5. **Decorate**: emoji stickers (drag, pinch, rotate) and doodles.
6. **Done**: save a print-ready PNG, or share it straight from your phone.

### Y2K digicam mode

Inspired by freqznow.site. Pick a camera edition (Lace, Chrome, Candy, Midnight, Mint,
Dream) and you see yourself live on its LCD with a digicam look: 2000, GLOW, BNW, CCD,
FLASH or BASIC. Snap each cut by hand (1 to 4 cuts, optional self-timer) and the orange
`'26 10 12` date stamp gets burned in. Then choose a frame colour, add pixel word
stickers ("xoxo", "luv u"…), and save the strip or each photo on its own.

Everything happens on your device. Nothing is uploaded, and there's no account
or tracking.

## Run locally

It's a static site with no build step:

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

Browsers only allow the camera on `https://` or `localhost`, so open it through a
server, not as a `file://` path.

## Layout

```
index.html        page shell
css/style.css     all styles (mobile first)
js/app.js         scenes and flow
js/layouts.js     strip sizes and slot geometry
js/frames.js      frames, with patterns drawn in code
js/filters.js     filters as pixel math (same result on iOS Safari)
js/render.js      the one renderer behind every preview and the export
js/camera.js      camera, uploads and sounds
js/digicam.js     the Y2K digicam mode (camera editions, live LCD, snap)
```

Inspired by the photobooth at getangie.com.

## License

MIT

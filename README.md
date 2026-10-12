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

Inspired by freqznow.site. Pick a device and you see yourself live on its screen:

- **Real devices** (photos of the actual hardware): Canon IXUS 70, Sony Cyber-shot T33,
  Motorola RAZR V3 (silver and white), Nokia 2760 flip.
- **Drawn devices** in six body colours: digicam, slim cam, flip phone, candybar phone.

Pick a digicam look (2000, GLOW, BNW, CCD, FLASH, BASIC) and snap each cut by hand (1 to 4
cuts, optional self-timer). Each photo comes out *on the device*, with its screen overlay
(battery, file number or phone status bar) and the orange `'26 10 12` date stamp. Or turn
the cuts into a Y2K photo strip instead. Pixel word stickers ("xoxo", "luv u"…) included.

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
js/digicam.js     the Y2K digicam mode (device picker, live screen, snap)
js/devices.js     drawn devices + the real-device photos and their screens
```

Inspired by the photobooth at getangie.com.

## Credits

The real-device photos come from Wikimedia Commons. They were cut out and straightened for
this app (`assets/devices/`), and each keeps its own licence:

| Device | Photo by | Licence |
| --- | --- | --- |
| [Canon IXUS 70](https://commons.wikimedia.org/wiki/File:Canon_Ixus_70_back.jpg) | David Gerard | Public domain |
| [Sony Cyber-shot DSC-T33](https://commons.wikimedia.org/wiki/File:SONY-Cyber-shot-dsc-T33-back.jpg) | DavidIvar | CC BY-SA 4.0 |
| [Motorola RAZR V3](https://commons.wikimedia.org/wiki/File:RAZR_silver_plainbg.jpg) | Steve Jurvetson | CC BY 2.0 |
| [Motorola RAZR V3 (white)](https://commons.wikimedia.org/wiki/File:Motorola_Razr_V3_montage_closed_open.png) | Raimond Spekking | CC BY-SA 4.0 |
| [Nokia 2760](https://commons.wikimedia.org/wiki/File:Nokia_2760_open.png) | AnVuong1222004 | CC BY-SA 4.0 |

Brand names and logos on the devices belong to their owners. This project isn't
affiliated with any of them.

## License

Code: MIT. Device photos: see Credits above.

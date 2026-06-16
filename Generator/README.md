# Europe particle flow field (p5.js)

Open `index.html` in a local web server (recommended).


## Controls

- `R` reseed + restart
- `SPACE` toggle stacking (particle separation)
- `S` save a PNG frame
- `V` start/stop video recording (exports MP4 at 1920×1080, 30 fps; falls back to WebM if H.264 is unavailable)
- Interactive mode (UI toggle): when enabled, left-click pushes particles away for ~2 seconds
- Click to zoom in on a spot
- Mouse wheel / trackpad scroll to zoom further (zoom around cursor)
- Color tool (top-left):
	- Particles: click (or click-drag) the color spectrum to pick instantly (top = white/pastels, bottom = black)
	- Background: click (or click-drag) the color spectrum to pick instantly (top = white/pastels, bottom = black)
	- Saved swatches: white + your last 5 picked colors (click to re-apply; persists in the browser)
	- Transparent BG: when enabled, the canvas background becomes transparent (and saved PNGs export with alpha)
	- Overlap visibility: controls how much lower particles show through top particles when stacked (0% = top particles most opaque, 100% = original overlap look)
	- Mix (orig→picked): blend original particle colors into the picked color
	- Mix (trail→bg): blend particle/trail color toward the background
	- Trail fade: controls how long trails persist
	- Particle size: controls stroke thickness
	- Map → Gravitation: controls how strongly particles are pulled toward the dark lines of the selected base image

## Map image spawning

This sketch spawns particles from the dark pixels in the selected map image.

Default:

- `Assets/EU Map Clean.jpg`

You can switch between available images in the UI (Map → Image).

Tuning knobs are in `CONFIG.map` inside `sketch.js`:

- `darknessThreshold` (higher = more pixels treated as line)
- `pixelStride` (higher = faster sampling, fewer spawn candidates)
- `ignoreWatermark` (skips bottom-right area)
- `edgeIgnorePx` (skips pixels near the image edge to avoid the black frame)

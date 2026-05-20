// Math and Color Utilities

function mixHsbShortest(a, b, t) {
  const tt = constrain(t, 0, 1);
  const dh = shortestHueDelta(a.h, b.h);
  const h = (a.h + dh * tt + 360) % 360;
  return { h, s: lerp(a.s, b.s, tt), b: lerp(a.b, b.b, tt) };
}

function shortestHueDelta(h1, h2) {
  let d = ((h2 - h1 + 540) % 360) - 180;
  return d === -180 ? 180 : d;
}

function rgbToHsb(r, g, b) {
  const rr = constrain(r / 255, 0, 1), gg = constrain(g / 255, 0, 1), bb = constrain(b / 255, 0, 1);
  const maxV = Math.max(rr, gg, bb), minV = Math.min(rr, gg, bb), delta = maxV - minV;
  let h = 0;
  if (delta > 1e-10) {
    if (maxV === rr) h = ((gg - bb) / delta) % 6;
    else if (maxV === gg) h = (bb - rr) / delta + 2;
    else h = (rr - gg) / delta + 4;
    h = (h * 60 + 360) % 360;
  }
  return { h, s: maxV === 0 ? 0 : delta / maxV * 100, b: maxV * 100 };
}

function hsbToRgb(h, s, b) {
  const hh = ((h % 360) + 360) % 360, ss = constrain(s / 100, 0, 1), vv = constrain(b / 100, 0, 1);
  const c = vv * ss, x = c * (1 - Math.abs((hh / 60) % 2 - 1)), m = vv - c;
  let [rp, gp, bp] = [0, 0, 0];
  if (hh < 60) [rp, gp] = [c, x];
  else if (hh < 120) [rp, gp] = [x, c];
  else if (hh < 180) [gp, bp] = [c, x];
  else if (hh < 240) [gp, bp] = [x, c];
  else if (hh < 300) [rp, bp] = [x, c];
  else [rp, bp] = [c, x];
  return { r: Math.round((rp + m) * 255), g: Math.round((gp + m) * 255), b: Math.round((bp + m) * 255) };
}

function hsbToHex(h, s, b) {
  const rgb = hsbToRgb(h, s, b);
  const to2 = (n) => n.toString(16).padStart(2, '0');
  return `#${to2(rgb.r)}${to2(rgb.g)}${to2(rgb.b)}`;
}

function hexToRgb(hex) {
  if (typeof hex !== 'string') return null;
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function hexToHsb(hex) {
  const rgb = hexToRgb(hex);
  return rgb ? rgbToHsb(rgb.r, rgb.g, rgb.b) : null;
}

function normalizeHexColor(hex) {
  if (typeof hex !== 'string') return null;
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  return m ? `#${m[1].toUpperCase()}` : null;
}

/** Accepts "#RRGGBB", "RRGGBB", or "#RGB" while typing in the UI hex field. */
function parseHexInput(raw) {
  let s = String(raw ?? '').trim();
  if (!s) return null;
  if (s[0] === '#') s = s.slice(1);
  if (/^[0-9a-f]{3}$/i.test(s)) s = s.split('').map((c) => c + c).join('');
  if (/^[0-9a-f]{6}$/i.test(s)) return normalizeHexColor(`#${s}`);
  return null;
}

function relativeLuminance(r, g, b) {
  const lin = (c) => {
    const v = constrain(c / 255, 0, 1);
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrastRatio(rgbA, rgbB) {
  const l1 = relativeLuminance(rgbA.r, rgbA.g, rgbA.b);
  const l2 = relativeLuminance(rgbB.r, rgbB.g, rgbB.b);
  const lighter = Math.max(l1, l2), darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Picks a light, vivid background HSB that contrasts strongly with the particle color. */
function computeHighContrastBackgroundHSB(particleHsb) {
  const ph = ((+particleHsb?.h || 0) + 360) % 360;
  const ps = constrain(+particleHsb?.s || 0, 0, 100);
  const pb = constrain(+particleHsb?.b || 0, 0, 100);
  const particleRgb = hsbToRgb(ph, ps, pb);

  const hueOffsets = [120, 150, 180, 210];
  const satLevels = [55, 70, 82, 92];
  const brightLevels = [78, 85, 90, 94, 98];

  let best = { h: (ph + 180) % 360, s: 75, b: 90 };
  let bestScore = -1;

  const scoreCandidate = (bgRgb, bh, s, b) => {
    const contrast = contrastRatio(particleRgb, bgRgb);
    const bgLum = relativeLuminance(bgRgb.r, bgRgb.g, bgRgb.b);
    return contrast * (1 + bgLum * 0.45);
  };

  for (const offset of hueOffsets) {
    const bh = (ph + offset) % 360;
    for (const s of satLevels) {
      for (const b of brightLevels) {
        const bgRgb = hsbToRgb(bh, s, b);
        const score = scoreCandidate(bgRgb, bh, s, b);
        if (score > bestScore) {
          bestScore = score;
          best = { h: bh, s, b };
        }
      }
    }
  }

  if (pb > 55) {
    for (const offset of hueOffsets) {
      const bh = (ph + offset) % 360;
      for (const b of [82, 88, 92, 96]) {
        const bgRgb = hsbToRgb(bh, 65, b);
        const score = scoreCandidate(bgRgb, bh, 65, b);
        if (score > bestScore) {
          bestScore = score;
          best = { h: bh, s: 65, b };
        }
      }
    }
  }

  best.b = Math.min(100, Math.max(80, best.b + 6));
  if (best.s > 88) best.s = 88;

  return best;
}

// Canvas Painting Utilities
function hardClearMainCanvas() {
  try {
    const ctx = drawingContext;
    if (ctx) {
      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, ctx.canvas?.width ?? width, ctx.canvas?.height ?? height);
      ctx.restore();
    }
  } catch { /* ignore */ }
  clear();
}

function primeOpaqueBackgroundHSB(h, s, b) {
  try {
    const ctx = drawingContext;
    if (ctx) {
      const rgb = hsbToRgb(h, s, b);
      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = `rgb(${rgb.r},${rgb.g},${rgb.b})`;
      ctx.fillRect(0, 0, ctx.canvas?.width ?? width, ctx.canvas?.height ?? height);
      ctx.getImageData(0, 0, 1, 1);
      ctx.restore();
      return;
    }
  } catch { /* ignore */ }
  background(h, s, b);
}

// Erode alpha (destination-out); optional destination-over rgb paints solid bg under cleared pixels (no grey smears vs semi-transparent bg fill).
function applyTrailFadeCanvas2D(ctx, cw, ch, fade01, behindRgb) {
  if (!ctx) return;
  const a = constrain(fade01, 0, 1);
  if (a <= 0) return;
  try {
    const w = Math.max(1, cw | 0), h = Math.max(1, ch | 0);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = `rgba(0,0,0,${a})`;
    ctx.fillRect(0, 0, w, h);
    if (behindRgb && typeof behindRgb.r === 'number') {
      ctx.globalCompositeOperation = 'destination-over';
      ctx.fillStyle = `rgb(${behindRgb.r | 0},${behindRgb.g | 0},${behindRgb.b | 0})`;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.restore();
    ctx.globalCompositeOperation = 'source-over';
  } catch { /* ignore */ }
}

/** Clears nearly-invisible pixels on the trail buffer (fixes leftover color when alpha is tiny). */
function snapTrailLowAlphaToTransparent(ctx, cw, ch, alphaMax255) {
  if (!ctx?.getImageData) return;
  const th = Math.max(0, Math.min(255, alphaMax255 | 0));
  if (th <= 0) return;
  const w = Math.max(1, cw | 0), h = Math.max(1, ch | 0);
  let img;
  try {
    img = ctx.getImageData(0, 0, w, h);
  } catch {
    return;
  }
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] <= th) {
      d[i] = 0;
      d[i + 1] = 0;
      d[i + 2] = 0;
      d[i + 3] = 0;
    }
  }
  try {
    ctx.putImageData(img, 0, 0);
  } catch { /* ignore */ }
}

// Camera Utilities
function applyCameraTransform(pg) {
  if (!camera) return;
  const zx = width * 0.5, zy = height * 0.5, z = camera.zoom, cx = -camera.center.x, cy = -camera.center.y;
  if (pg) {
    pg.translate(zx, zy);
    pg.scale(z);
    pg.translate(cx, cy);
  } else {
    translate(zx, zy);
    scale(z);
    translate(cx, cy);
  }
}

function screenToWorld(sx, sy) {
  const z = camera?.zoom ?? 1, cx = camera?.center?.x ?? width * 0.5, cy = camera?.center?.y ?? height * 0.5;
  return createVector((sx - width * 0.5) / z + cx, (sy - height * 0.5) / z + cy);
}

function getCameraWorldBounds() {
  const z = camera?.zoom ?? 1, cx = camera?.center?.x ?? width * 0.5, cy = camera?.center?.y ?? height * 0.5;
  const halfW = (width * 0.5) / z, halfH = (height * 0.5) / z;
  return { l: cx - halfW, r: cx + halfW, t: cy - halfH, b: cy + halfH };
}

function segmentIntersectsBounds(a, b, bounds) {
  const minX = Math.min(a.x, b.x), maxX = Math.max(a.x, b.x);
  const minY = Math.min(a.y, b.y), maxY = Math.max(a.y, b.y);
  return !(maxX < bounds.l || minX > bounds.r || maxY < bounds.t || minY > bounds.b);
}

function inBounds(x, y) {
  return x >= -20 && x <= width + 20 && y >= -20 && y <= height + 20;
}

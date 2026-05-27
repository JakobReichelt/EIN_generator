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

function linearRgbFromSrgb8(r, g, b) {
  const lin = (c) => {
    const v = constrain(c / 255, 0, 1);
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return [lin(r), lin(g), lin(b)];
}

function srgb8FromLinearRgb(lr, lg, lb) {
  const enc = (c) => {
    const v = constrain(c, 0, 1);
    const s = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
    return Math.round(constrain(s, 0, 1) * 255);
  };
  return { r: enc(lr), g: enc(lg), b: enc(lb) };
}

/** Oklab (Björn Ottosson) — perceptually uniform lightness. */
function rgbToOklab(r, g, b) {
  const [lr, lg, lb] = linearRgbFromSrgb8(r, g, b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return {
    L: 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s
  };
}

function oklabToRgb(L, a, b) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
  const l = l_ * l_ * l_, m = m_ * m_ * m_, s = s_ * s_ * s_;
  const lr = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const lg = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const lb = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;
  return srgb8FromLinearRgb(constrain(lr, 0, 1), constrain(lg, 0, 1), constrain(lb, 0, 1));
}

function oklabChroma(a, b) {
  return Math.sqrt(a * a + b * b);
}

function oklabHueDeg(a, b) {
  return (Math.atan2(b, a) * 180 / Math.PI + 360) % 360;
}

function oklabFromHue(L, C, hueDeg) {
  const rad = (hueDeg * Math.PI) / 180;
  return oklabToRgb(L, C * Math.cos(rad), C * Math.sin(rad));
}

/** Anchor L/C for hue-only strips; falls back when chroma is near zero. */
function oklabAnchorFromRgb(r, g, b, minChroma = 0.04) {
  const lab = rgbToOklab(r, g, b);
  const C = oklabChroma(lab.a, lab.b);
  return { L: lab.L, C: C < 0.008 ? minChroma : C };
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

/** WCAG 2.1 contrast thresholds (Adobe Color Contrast Checker AA / AAA). */
const WCAG_CONTRAST_MIN = {
  AA_LARGE_TEXT: 3,
  AA_SMALL_TEXT: 4.5,
  AAA_LARGE_TEXT: 4.5,
  AAA_SMALL_TEXT: 7,
  AA_UI_GRAPHICS: 3
};

function wcagContrastPasses(ratio, level = 'AA', category = 'small') {
  const r = +ratio || 0;
  if (level === 'AAA') {
    if (category === 'large') return r >= WCAG_CONTRAST_MIN.AAA_LARGE_TEXT;
    if (category === 'ui') return r >= WCAG_CONTRAST_MIN.AA_UI_GRAPHICS;
    return r >= WCAG_CONTRAST_MIN.AAA_SMALL_TEXT;
  }
  if (category === 'large') return r >= WCAG_CONTRAST_MIN.AA_LARGE_TEXT;
  if (category === 'ui') return r >= WCAG_CONTRAST_MIN.AA_UI_GRAPHICS;
  return r >= WCAG_CONTRAST_MIN.AA_SMALL_TEXT;
}

/**
 * Same hue; find a passing HSB brightness for this saturation.
 * Light foregrounds → saturated dark band (not pure black). Dark foregrounds → bright band.
 */
function findWcagBackgroundAtHueSat(h, s, fgRgb, fgLum, minRatio) {
  const wantLightBg = fgLum < 0.5;
  const passings = [];

  for (let b = 1; b <= 100; b++) {
    const ratio = contrastRatio(fgRgb, hsbToRgb(h, s, b));
    if (ratio >= minRatio) passings.push({ b, ratio });
  }
  if (!passings.length) return null;

  if (wantLightBg) {
    const sweet = passings.filter((p) => p.b >= 60);
    const pool = sweet.length ? sweet : passings;
    const aaa = pool.filter((p) => p.ratio >= WCAG_CONTRAST_MIN.AAA_SMALL_TEXT);
    const aa = pool.filter((p) => p.ratio >= minRatio);
    const pick = (aaa.length ? aaa : aa).reduce((a, p) => (p.b > a.b ? p : a));
    return { h, s, b: pick.b };
  }

  const sweet = passings.filter((p) => p.b >= 12 && p.b <= 58);
  const pool = sweet.length ? sweet : passings;
  const aaa = pool.filter((p) => p.ratio >= WCAG_CONTRAST_MIN.AAA_SMALL_TEXT);
  const aa = pool.filter((p) => p.ratio >= minRatio);
  const pick = (aaa.length ? aaa : aa).reduce((a, p) => (p.b > a.b ? p : a));
  return { h, s, b: pick.b };
}

/** Auto background for user mode: same hue, opposite brightness, WCAG AA small-text contrast. */
function computeHighContrastBackgroundHSB(particleHsb) {
  const ph = ((+particleHsb?.h || 0) + 360) % 360;
  const ps = constrain(+particleHsb?.s || 0, 0, 100);
  const pb = constrain(+particleHsb?.b || 0, 0, 100);
  const fgRgb = hsbToRgb(ph, ps, pb);
  const fgLum = relativeLuminance(fgRgb.r, fgRgb.g, fgRgb.b);
  const minRatio = WCAG_CONTRAST_MIN.AA_SMALL_TEXT;
  const wantLightBg = fgLum < 0.5;

  const satLevels = ps < 8
    ? [8, 12, 18, 26, 36]
    : wantLightBg
      ? [constrain(ps * 0.85, 10, 100), ps, constrain(ps * 0.72, 10, 100), 20, 12, 8]
      : [100, 92, 85, Math.max(ps, 80), ps, constrain(ps * 0.88, 10, 100)];

  let best = null;
  let bestRatio = -1;

  for (const s of satLevels) {
    const candidate = findWcagBackgroundAtHueSat(ph, s, fgRgb, fgLum, minRatio);
    if (!candidate) continue;
    const ratio = contrastRatio(fgRgb, hsbToRgb(candidate.h, candidate.s, candidate.b));
    if (!best || ratio > bestRatio) {
      best = candidate;
      bestRatio = ratio;
    }
  }

  if (best) return best;

  return {
    h: ph,
    s: ps < 8 ? 12 : (wantLightBg ? constrain(ps * 0.72, 10, 100) : 100),
    b: wantLightBg ? 96 : 24
  };
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

function moveCamera(dx, dy) {
  if (typeof camera === 'undefined' || !camera) return;
  const step = 90 / (camera.zoom || 1);
  camera.center.x += dx * step;
  camera.center.y += dy * step;
}

function setCameraZoom(nextZoom) {
  if (!camera) return;
  const minZ = camera.minZoom ?? 1;
  const maxZ = camera.maxZoom ?? 40;
  camera.zoom = constrain(+nextZoom || 1, minZ, maxZ);
  if (typeof syncCameraZoomUI === 'function') syncCameraZoomUI();
}

function isEditingTextInput() {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName?.toLowerCase();
  return tag === 'input' || tag === 'textarea' || el.isContentEditable === true;
}

function segmentIntersectsBounds(a, b, bounds) {
  const minX = Math.min(a.x, b.x), maxX = Math.max(a.x, b.x);
  const minY = Math.min(a.y, b.y), maxY = Math.max(a.y, b.y);
  return !(maxX < bounds.l || minX > bounds.r || maxY < bounds.t || minY > bounds.b);
}

function inBounds(x, y) {
  return x >= -20 && x <= width + 20 && y >= -20 && y <= height + 20;
}

const PARTICLE_RECENT_COLORS_STORAGE_KEY = 'eiz.generativ.particleRecentColors.v1';
const BACKGROUND_RECENT_COLORS_STORAGE_KEY = 'eiz.generativ.backgroundRecentColors.v1';

let colorTool = {
  container: null, particleSpectrum: null, particleValueText: null, backgroundSpectrum: null, backgroundValueText: null,
  particleRecentColors: [], backgroundRecentColors: [], particleRecentRow: null, backgroundRecentRow: null,
  transparentBackgroundCheckbox: null, gravitationSlider: null, gravitationValueText: null, particleMixSlider: null, trailToBgMixSlider: null,
  trailFadeSlider: null, trailLowAlphaCullSlider: null, trailLowAlphaCullValueText: null, particleSpeedSlider: null, particleSizeSlider: null, particleSizeValueText: null, particleCountSlider: null, particleCountValueText: null,
  particleOverlapSlider: null, particleOverlapValueText: null,
  colorVarianceSlider: null, colorVarianceValueText: null,
  particleBaseHSB: null,
  particlePaletteHSB: [null, null, null],
  activeParticlePaletteIndex: 0,
  particlePaletteButtons: null,
  setActiveParticlePaletteIndex: null,
  refreshParticlePaletteUI: null,
  backgroundHSB: { h: 0, s: 0, b: 100 },
  interactiveModeCheckbox: null
};

const UI_MODE_STORAGE_KEY = 'eiz.generativ.uiMode.v1';
let uiMode = 'dev';
let activeUserStageIndex = -1;
let userStageSlider = null;
let activeUserColorPresetIndex = -1;
let userColorPresetButtons = [];
let _userStageTarget = null;
let userStageTransitionActive = false;
let userStageParticleSyncPending = false;
let userStageFadePhase = null;
let userStageFadeT = 0;
let userStageFadeFrom = 3;
let userStageFadeTarget = 3;
let userStageLastAppliedSize = null;
let userStageSliderDragging = false;

const USER_STAGE_SIZE_FADE_THRESHOLD = 0.35;

const userColorTool = {
  container: null,
  particleValueText: null,
  backgroundValueText: null,
  transparentBackgroundToggle: null
};

let transparentBackgroundEnabled = false;

const USER_STAGE_FADE_PEAK = 70;

const USER_STAGE_BASE = {
  zoom: 3,
  overlap: 0,
  colorVar: 20,
  trailCull: 15,
  count: 5000,
  speed: 0.2,
  fade: 3,
  grav: 1,
  interactive: true
};

const USER_STAGE_PRESETS = [
  { ...USER_STAGE_BASE, size: 3, speed: 0.1 },
  { ...USER_STAGE_BASE, size: 35 },
  { ...USER_STAGE_BASE, size: 100 }
];

const USER_STAGE_NUMERIC_KEYS = ['size', 'zoom', 'overlap', 'colorVar', 'trailCull', 'count', 'speed', 'fade', 'grav'];

function interpolateUserStageAt(t) {
  const presets = USER_STAGE_PRESETS;
  if (!presets.length) return null;
  const maxT = presets.length - 1;
  t = constrain(t, 0, maxT);
  if (presets.length === 1) return { ...presets[0] };

  const i = Math.min(Math.floor(t), maxT - 1);
  const localT = t - i;
  const a = presets[i];
  const b = presets[i + 1];
  const out = { interactive: localT >= 0.5 ? b.interactive : a.interactive };
  for (const key of USER_STAGE_NUMERIC_KEYS) {
    if (a[key] !== undefined && b[key] !== undefined) {
      out[key] = a[key] + (b[key] - a[key]) * localT;
    }
  }
  return out;
}

function applyUserStageAt(t) {
  const target = interpolateUserStageAt(t);
  if (!target || !colorTool?.particleSizeSlider) return;

  activeUserStageIndex = Math.round(t);
  _targetValues = null;
  _userStageTarget = null;
  userStageTransitionActive = false;
  userStageFadeTarget = target.fade;

  const sizeChanged = userStageLastAppliedSize === null
    || Math.abs(target.size - userStageLastAppliedSize) >= USER_STAGE_SIZE_FADE_THRESHOLD;

  setSliderValue(colorTool.particleSizeSlider, target.size);
  setSliderValue(colorTool.particleCountSlider, target.count);
  if (colorTool.trailLowAlphaCullSlider) setSliderValue(colorTool.trailLowAlphaCullSlider, target.trailCull);
  if (colorTool.gravitationSlider) setSliderValue(colorTool.gravitationSlider, target.grav);
  if (colorTool.particleOverlapSlider) setSliderValue(colorTool.particleOverlapSlider, target.overlap);
  if (colorTool.colorVarianceSlider) setSliderValue(colorTool.colorVarianceSlider, target.colorVar);
  if (colorTool.particleSpeedSlider) setSliderValue(colorTool.particleSpeedSlider, target.speed);

  if (userStageLastAppliedSize === null) {
    userStageLastAppliedSize = target.size;
    userStageFadePhase = null;
    setSliderValue(colorTool.trailFadeSlider, target.fade);
  } else if (sizeChanged) {
    userStageLastAppliedSize = target.size;
    if (userStageSliderDragging) {
      userStageFadePhase = null;
      setSliderValue(colorTool.trailFadeSlider, USER_STAGE_FADE_PEAK);
    } else {
      beginUserStageFadePulse();
    }
  } else if (!userStageFadePhase) {
    setSliderValue(colorTool.trailFadeSlider, target.fade);
  }

  if (target.zoom !== undefined) setCameraZoom(target.zoom);

  interactionEnabled = !!target.interactive;
  if (colorTool.interactiveModeCheckbox) {
    try { colorTool.interactiveModeCheckbox.checked(interactionEnabled); } catch { /* ignore */ }
  }
}

function createSpectrumPicker(parent, w, h, onChange, onCommit) {
  const spectrum = createElement('canvas').parent(parent).style('display', 'block').style('margin-top', '4px')
    .style('border-radius', '8px').style('border', '1px solid rgba(255,255,255,0.22)').style('cursor', 'crosshair');
  const canvas = spectrum.elt;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: false }), img = ctx.createImageData(w, h), data = img.data;

  for (let y = 0; y < h; y++) {
    const t = h <= 1 ? 0 : y / (h - 1);
    for (let x = 0; x < w; x++) {
      const hue = w <= 1 ? 0 : (x / (w - 1)) * 360, base = hsbToRgb(hue, 100, 100);
      let r, g, b;
      if (t < 0.5) { const k = t / 0.5; r = 255 + (base.r - 255) * k; g = 255 + (base.g - 255) * k; b = 255 + (base.b - 255) * k; }
      else { const k = (t - 0.5) / 0.5; r = base.r * (1 - k); g = base.g * (1 - k); b = base.b * (1 - k); }
      const idx = (y * w + x) * 4;
      data.set([r, g, b, 255], idx);
    }
  }

  let idleHex = '#000000', active = false, dragging = false, last = null;
  const drawIdle = () => { ctx.save(); ctx.clearRect(0, 0, w, h); ctx.fillStyle = idleHex; ctx.fillRect(0, 0, w, h); ctx.restore(); };
  drawIdle();

  const pickFromEvent = (ev) => {
    const rect = canvas.getBoundingClientRect(), nx = constrain(ev.clientX - rect.left, 0, rect.width) / (rect.width || 1), ny = constrain(ev.clientY - rect.top, 0, rect.height) / (rect.height || 1);
    const hue = nx * 360, base = hsbToRgb(hue, 100, 100);
    let r, g, b;
    if (ny < 0.5) { const k = ny / 0.5; r = 255 + (base.r - 255) * k; g = 255 + (base.g - 255) * k; b = 255 + (base.b - 255) * k; }
    else { const k = (ny - 0.5) / 0.5; r = base.r * (1 - k); g = base.g * (1 - k); b = base.b * (1 - k); }
    const hsb = rgbToHsb(r, g, b);
    onChange(hsb);
    return hsb;
  };

  canvas.addEventListener('pointerdown', (ev) => { if (!active) { active = true; ctx.putImageData(img, 0, 0); } dragging = true; canvas.setPointerCapture(ev.pointerId); last = pickFromEvent(ev); });
  canvas.addEventListener('pointermove', (ev) => { if (dragging) last = pickFromEvent(ev); });
  canvas.addEventListener('pointerup', () => { if (dragging && last && onCommit) onCommit(last); dragging = false; last = null; });
  canvas.addEventListener('pointercancel', () => { if (dragging && last && onCommit) onCommit(last); dragging = false; last = null; });
  canvas.addEventListener('pointerenter', () => { if (!active) { active = true; ctx.putImageData(img, 0, 0); } });
  canvas.addEventListener('pointerleave', () => { if (dragging) return; active = false; drawIdle(); });

  spectrum._setIdleHex = (hex) => { const n = normalizeHexColor(hex); if (n) { idleHex = n; if (!active) drawIdle(); } };
  return spectrum;
}

const PARTICLE_PALETTE_SLOTS = 11;

const PRIDE_PARTICLE_COLORS = [
  '#E40303', '#FF8C00', '#FFED00', '#008026', '#004CFF', '#732982',
  '#8B5A2B', '#000000', '#FFFFFF', '#5EC8E8', '#FF8FC7'
];

const USER_COLOR_PRESETS = [
  { fg: '#BDFA4F', bg: '#0073A9' },
  { fg: '#FA032E', bg: '#35ABE2' },
  { fg: '#E9FE90', bg: '#FF9401' },
  { fg: '#E9E137', bg: '#6D00C9' },
  { fg: '#E6FD94', bg: '#001BB8' },
  { fg: '#FFF200', bg: '#4163FF' },
  { bg: '#EAF6FF', particleColors: PRIDE_PARTICLE_COLORS }
];

function ensureParticlePaletteSize() {
  if (!Array.isArray(colorTool.particlePaletteHSB)) colorTool.particlePaletteHSB = [];
  while (colorTool.particlePaletteHSB.length < PARTICLE_PALETTE_SLOTS) colorTool.particlePaletteHSB.push(null);
  if (colorTool.particlePaletteHSB.length > PARTICLE_PALETTE_SLOTS) colorTool.particlePaletteHSB.length = PARTICLE_PALETTE_SLOTS;
}

function repickAllParticlePaletteSlots() {
  try {
    if (Array.isArray(particles)) {
      for (const p of particles) {
        if (p && typeof p.pickPaletteSlot === 'function') p.pickPaletteSlot();
      }
    }
  } catch { /* ignore */ }
}

function getUserPresetSwatchStyle(preset) {
  if (preset.particleColors?.length) {
    const n = preset.particleColors.length;
    const stops = preset.particleColors.map((c, i) => {
      const pct0 = ((i / n) * 100).toFixed(1);
      const pct1 = (((i + 1) / n) * 100).toFixed(1);
      return `${c} ${pct0}% ${pct1}%`;
    });
    return `linear-gradient(to right, ${stops.join(', ')})`;
  }
  return `linear-gradient(to bottom, ${preset.fg} 50%, ${preset.bg} 50%)`;
}

function getUserPresetAriaLabel(preset, index) {
  if (preset.particleColors?.length) {
    return `Color preset ${index + 1}: Pride (${preset.particleColors.join(', ')}) / ${preset.bg}`;
  }
  return `Color preset ${index + 1}: ${preset.fg} / ${preset.bg}`;
}

function syncUserParticleColorUI(hex) {
  if (userColorTool.particleValueText) userColorTool.particleValueText.value(hex.toUpperCase());
}

function syncUserBackgroundColorUI(hex) {
  if (userColorTool.backgroundValueText) userColorTool.backgroundValueText.value(hex.toUpperCase());
}

function layoutUserControlsWidth() {
  const controls = document.getElementById('user-controls-root');
  const colorRoot = document.getElementById('user-color-root');
  if (!controls || !colorRoot) return;
  const w = colorRoot.getBoundingClientRect().width;
  if (w > 0) controls.style.width = `${Math.ceil(w)}px`;
}

function applyParticleHSB(hsb, commit = false, opts = {}) {
  const hh = ((+hsb.h || 0) + 360) % 360, ss = constrain(+hsb.s || 0, 0, 100), bb = constrain(+hsb.b || 0, 0, 100);
  ensureParticlePaletteSize();
  const idx = Math.max(0, Math.min(PARTICLE_PALETTE_SLOTS - 1, colorTool.activeParticlePaletteIndex | 0));
  colorTool.particlePaletteHSB[idx] = { h: hh, s: ss, b: bb };
  colorTool.particleBaseHSB = { h: hh, s: ss, b: bb };
  const hex = hsbToHex(hh, ss, bb);
  if (colorTool.particleValueText) colorTool.particleValueText.value(hex.toUpperCase());
  if (colorTool.particleSpectrum?._setIdleHex) colorTool.particleSpectrum._setIdleHex(hex);
  syncUserParticleColorUI(hex);
  if (commit) pushRecentColor('particle', hex);
  if (colorTool.refreshParticlePaletteUI) colorTool.refreshParticlePaletteUI();

  if (uiMode === 'user' && !opts?.keepBackground) {
    setTransparentBackgroundEnabled(false);
    const bgHsb = computeHighContrastBackgroundHSB({ h: hh, s: ss, b: bb });
    applyBackgroundHSB(bgHsb, false);
  }
}

function applyUserMultiColorPreset(preset, presetIndex = -1) {
  const bg = normalizeHexColor(preset.bg);
  if (!bg) return;
  const bgHsb = hexToHsb(bg);
  if (!bgHsb) return;

  ensureParticlePaletteSize();
  for (let i = 0; i < PARTICLE_PALETTE_SLOTS; i++) colorTool.particlePaletteHSB[i] = null;

  let firstHsb = null;
  const colors = preset.particleColors ?? [];
  for (let i = 0; i < colors.length && i < PARTICLE_PALETTE_SLOTS; i++) {
    const hex = normalizeHexColor(colors[i]);
    if (!hex) continue;
    const hsb = hexToHsb(hex);
    if (!hsb) continue;
    colorTool.particlePaletteHSB[i] = { h: hsb.h, s: hsb.s, b: hsb.b };
    if (!firstHsb) firstHsb = hsb;
  }
  if (!firstHsb) return;

  if (presetIndex >= 0) {
    activeUserColorPresetIndex = presetIndex;
    refreshUserColorPresetUI();
  }
  setTransparentBackgroundEnabled(false);
  colorTool.activeParticlePaletteIndex = 0;
  applyParticleHSB(firstHsb, true, { keepBackground: true });
  applyBackgroundHSB(bgHsb, true);
  if (colorTool.refreshParticlePaletteUI) colorTool.refreshParticlePaletteUI();
  repickAllParticlePaletteSlots();
}

function applyUserColorPresetFromEntry(preset, presetIndex = -1) {
  if (preset.particleColors?.length) {
    applyUserMultiColorPreset(preset, presetIndex);
    return;
  }
  applyUserColorPreset(preset.fg, preset.bg, presetIndex);
}

function applyUserColorPreset(fgHex, bgHex, presetIndex = -1) {
  const fg = normalizeHexColor(fgHex);
  const bg = normalizeHexColor(bgHex);
  if (!fg || !bg) return;
  const fgHsb = hexToHsb(fg);
  const bgHsb = hexToHsb(bg);
  if (!fgHsb || !bgHsb) return;
  if (presetIndex >= 0) {
    activeUserColorPresetIndex = presetIndex;
    refreshUserColorPresetUI();
  }
  ensureParticlePaletteSize();
  for (let i = 0; i < PARTICLE_PALETTE_SLOTS; i++) colorTool.particlePaletteHSB[i] = null;
  setTransparentBackgroundEnabled(false);
  colorTool.activeParticlePaletteIndex = 0;
  applyParticleHSB(fgHsb, true, { keepBackground: true });
  applyBackgroundHSB(bgHsb, true);
  if (colorTool.refreshParticlePaletteUI) colorTool.refreshParticlePaletteUI();
  repickAllParticlePaletteSlots();
}

function refreshUserColorPresetUI() {
  userColorPresetButtons.forEach((btn, i) => {
    btn.classList.toggle('is-active', i === activeUserColorPresetIndex);
  });
}

function createUserColorPresetRow(parent) {
  const row = createDiv('').parent(parent).addClass('user-color-preset-row');
  userColorPresetButtons = [];
  USER_COLOR_PRESETS.forEach((preset, i) => {
    const btn = createButton('').parent(row).addClass('user-color-preset');
    btn.elt.type = 'button';
    btn.elt.setAttribute('aria-label', getUserPresetAriaLabel(preset, i));
    btn.style('background', getUserPresetSwatchStyle(preset));
    btn.mousePressed(() => applyUserColorPresetFromEntry(preset, i));
    userColorPresetButtons.push(btn.elt);
  });
  return row;
}

function applyBackgroundHSB(hsb, commit = false) {
  const hh = ((+hsb.h || 0) + 360) % 360, ss = constrain(+hsb.s || 0, 0, 100), bb = constrain(+hsb.b || 0, 0, 100);
  colorTool.backgroundHSB = { h: hh, s: ss, b: bb };
  const hex = hsbToHex(hh, ss, bb);
  if (colorTool.backgroundValueText) colorTool.backgroundValueText.value(hex.toUpperCase());
  if (colorTool.backgroundSpectrum?._setIdleHex) colorTool.backgroundSpectrum._setIdleHex(hex);
  syncUserBackgroundColorUI(hex);
  if (!isTransparentBackgroundEnabled() && typeof trailLayer !== 'undefined' && trailLayer) trailLayer.clear();
  if (commit) pushRecentColor('background', hex);
}

function setSliderValue(slider, value) {
  if (!slider) return;
  slider.value(value);
  slider.elt.dispatchEvent(new Event('input', { bubbles: true }));
}

function loadUiMode() {
  try {
    const m = localStorage.getItem(UI_MODE_STORAGE_KEY);
    return m === 'user' || m === 'dev' ? m : null;
  } catch {
    return null;
  }
}

function saveUiMode(mode) {
  try { localStorage.setItem(UI_MODE_STORAGE_KEY, mode); } catch { /* ignore */ }
}

function loadRecentColors(storageKey) {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    const out = [], seen = new Set();
    for (const v of arr) {
      const hex = normalizeHexColor(v);
      if (!hex || hex === '#FFFFFF' || seen.has(hex)) continue;
      seen.add(hex); out.push(hex);
      if (out.length >= 5) break; 
    }
    return out;
  } catch { return []; }
}

function saveRecentColors(storageKey, colors) {
  try { localStorage.setItem(storageKey, JSON.stringify(colors)); } catch { /* ignore */ }
}

function wireColorHexInput(input, applyHSB, getCanonicalHsb, ariaLabel = 'Hex color') {
  const el = input.elt;
  el.setAttribute('spellcheck', 'false');
  el.setAttribute('autocomplete', 'off');
  el.setAttribute('aria-label', ariaLabel);

  const commitOrRevert = () => {
    const hex = parseHexInput(el.value);
    if (hex) {
      const hsb = hexToHsb(hex);
      if (hsb) {
        const c = getCanonicalHsb();
        const curHex = c ? normalizeHexColor(hsbToHex(c.h, c.s, c.b)) : null;
        if (!curHex || curHex !== hex) applyHSB(hsb, true);
        el.value = hex;
        return;
      }
    }
    const c = getCanonicalHsb();
    if (c) el.value = hsbToHex(c.h, c.s, c.b).toUpperCase();
  };

  el.addEventListener('input', () => {
    const hex = parseHexInput(el.value);
    if (!hex) return;
    const hsb = hexToHsb(hex);
    if (hsb) applyHSB(hsb, false);
  });

  el.addEventListener('blur', commitOrRevert);
  el.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      el.blur();
    }
  });
}

function pushRecentColor(kind, hex) {
  const n = normalizeHexColor(hex);
  if (!n || n === '#FFFFFF') return;
  const isBg = kind === 'background', key = isBg ? BACKGROUND_RECENT_COLORS_STORAGE_KEY : PARTICLE_RECENT_COLORS_STORAGE_KEY;
  const field = isBg ? 'backgroundRecentColors' : 'particleRecentColors';
  colorTool[field] = [n, ...colorTool[field].filter((c) => c !== n)].slice(0, 5);
  saveRecentColors(key, colorTool[field]);
  updateRecentSwatches();
}

function updateRecentSwatches() {
  const rowConfigs = [
    { row: colorTool?.particleRecentRow, colors: ['#FFFFFF', ...(colorTool?.particleRecentColors ?? [])] },
    { row: colorTool?.backgroundRecentRow, colors: ['#FFFFFF', ...(colorTool?.backgroundRecentColors ?? [])] },
  ];
  for (const { row, colors } of rowConfigs) {
    if (!row?.elt) continue;
    row.elt.querySelectorAll('button[data-hex]').forEach((btn, i) => {
      const hex = colors[i] ?? null;
      btn.style.display = hex ? 'inline-block' : 'none';
      if (hex) { btn.dataset.hex = hex; btn.style.background = hex; btn.title = hex; btn.setAttribute('aria-label', hex); }
    });
  }
}

function initColorTool() {
  if (colorTool.container) return;
  const initialParticle = particles?.length ? { h: particles[0].h, s: particles[0].s, b: particles[0].b } : { h: 215, s: 85, b: 50 };
  const initialBg = { h: 0, s: 0, b: 100 };
  const container = createDiv('');
  
  try { if (document.getElementById('ui-root')) container.parent('ui-root'); } catch { /* ignore */ }
  container.style('user-select', 'none').addClass('ui-panel');

  const createSection = (titleText) => {
    const sec = createDiv('').parent(container).addClass('ui-section');
    createDiv(titleText).parent(sec).addClass('ui-section-title');
    return createDiv('').parent(sec);
  };

  const colorsSec = createSection('Colors');
  const particleRow = createDiv('').parent(colorsSec).addClass('ui-row');
  createSpan('Particles').parent(particleRow);
  const particleValueText = createInput(hsbToHex(initialParticle.h, initialParticle.s, initialParticle.b).toUpperCase()).parent(particleRow).addClass('ui-hex');
  const particleSpectrumRow = createDiv('').parent(colorsSec).style('display', 'flex').style('align-items', 'flex-start').style('gap', '8px');
  const particleSpectrumWrap = createDiv('').parent(particleSpectrumRow);
  const particleRecentRow = createDiv('').parent(createDiv('').parent(colorsSec)).addClass('ui-swatch-grid');

  const bgRow = createDiv('').parent(colorsSec).addClass('ui-row').style('margin-top', '14px');
  createSpan('Background').parent(bgRow);
  const backgroundValueText = createInput(hsbToHex(initialBg.h, initialBg.s, initialBg.b).toUpperCase()).parent(bgRow).addClass('ui-hex');
  const transparentBackgroundCheckbox = createCheckbox('Transparent', false).parent(bgRow).input(() => {
    const on = transparentBackgroundCheckbox.checked() === true || transparentBackgroundCheckbox.checked() === 'true';
    setTransparentBackgroundEnabled(on);
  });
  const backgroundSpectrumWrap = createDiv('').parent(colorsSec).style('margin-top', '6px');
  const backgroundRecentRow = createDiv('').parent(createDiv('').parent(colorsSec)).addClass('ui-swatch-grid');

  const varianceRow = createDiv('').parent(colorsSec).addClass('ui-row').style('margin-top', '14px');
  createSpan('Shade variance').parent(varianceRow);
  const colorVarianceDefault = Math.max(0, Math.min(200, Math.round((CONFIG.particles.colorVariance ?? 1) * 100)));
  const colorVarianceSlider = createSlider(0, 200, colorVarianceDefault, 1).parent(varianceRow);
  colorVarianceSlider.elt.setAttribute('aria-label', 'Shade variance');
  const colorVarianceValueText = createSpan(colorVarianceDefault + '%').parent(varianceRow).addClass('ui-hex');
  colorVarianceSlider.input(() => {
    const v = Math.max(0, Math.min(200, Math.round(+colorVarianceSlider.value() || 0)));
    colorVarianceValueText.html(v + '%');
  });

  const trailsSec = createSection('Trails'), fadeRow = createDiv('').parent(trailsSec).addClass('ui-row');
  createSpan('Fade').parent(fadeRow);
  const trailFadeSlider = createSlider(0, 100, CONFIG.backgroundAlpha, 1).parent(fadeRow);

  const smearCullRow = createDiv('').parent(trailsSec).addClass('ui-row').style('margin-top', '8px');
  createSpan('Smear clean').parent(smearCullRow);
  const trailLowAlphaCullDefault = Math.max(0, Math.min(80, Math.round(+CONFIG.trailLowAlphaCull || 0)));
  const trailLowAlphaCullSlider = createSlider(0, 80, trailLowAlphaCullDefault, 1).parent(smearCullRow);
  trailLowAlphaCullSlider.elt.setAttribute('aria-label', 'Smear cleanup (opaque trails)');
  const trailLowAlphaCullValueText = createSpan(String(trailLowAlphaCullDefault)).parent(smearCullRow).addClass('ui-hex');
  trailLowAlphaCullSlider.input(() => {
    const v = Math.max(0, Math.min(80, Math.round(+trailLowAlphaCullSlider.value() || 0)));
    trailLowAlphaCullValueText.html(String(v));
  });

  const speedRow = createDiv('').parent(trailsSec).addClass('ui-row').style('margin-top', '8px');
  createSpan('Speed').parent(speedRow);
  const particleSpeedSlider = createSlider(0, 2, CONFIG.particles.speed, 0.01).parent(speedRow);

  const particlesSec = createSection('Particles'), sizeRow = createDiv('').parent(particlesSec).addClass('ui-row');
  createSpan('Size').parent(sizeRow);
  const particleSizeSlider = createSlider(0.25, 100, CONFIG.particles.strokeWeight, 0.05).parent(sizeRow);
  const particleSizeValueText = createSpan(Number(CONFIG.particles.strokeWeight).toFixed(2)).parent(sizeRow).addClass('ui-hex');

  const countRow = createDiv('').parent(particlesSec).addClass('ui-row');
  createSpan('Count').parent(countRow);
  const baseCount = Math.max(0, Math.floor(+CONFIG.particles.count || 0));
  const particleCountSlider = createSlider(10, 30000, baseCount, 100).parent(countRow);
  const particleCountValueText = createSpan(baseCount.toLocaleString()).parent(countRow).addClass('ui-hex');

  const overlapRow = createDiv('').parent(particlesSec).addClass('ui-row');
  createSpan('Overlap visibility').parent(overlapRow);
  const overlapDefault = Math.max(0, Math.min(100, Math.round(+CONFIG.particles.overlapVisibility || 0)));
  const particleOverlapSlider = createSlider(0, 100, overlapDefault, 1).parent(overlapRow);
  particleOverlapSlider.elt.setAttribute('aria-label', 'Overlap visibility');
  const particleOverlapValueText = createSpan(overlapDefault + '%').parent(overlapRow).addClass('ui-hex');
  particleOverlapSlider.input(() => {
    const v = Math.max(0, Math.min(100, Math.round(+particleOverlapSlider.value() || 0)));
    particleOverlapValueText.html(v + '%');
  });

  const refreshParticlePaletteUI = () => {
    const palette = Array.isArray(colorTool?.particlePaletteHSB) ? colorTool.particlePaletteHSB : [null, null, null];
    const btns = Array.isArray(colorTool?.particlePaletteButtons) ? colorTool.particlePaletteButtons : null;
    if (!btns) return;

    for (let i = 0; i < btns.length; i++) {
      const btn = btns[i];
      if (!btn?.elt) continue;
      const hsb = palette[i];
      if (hsb) {
        const hex = hsbToHex(hsb.h, hsb.s, hsb.b);
        btn.elt.style.background = hex;
        btn.elt.title = hex.toUpperCase();
        btn.elt.dataset.hex = hex.toUpperCase();
        btn.elt.setAttribute('aria-label', `Particle palette color ${i + 1}: ${hex.toUpperCase()}`);
      } else {
        btn.elt.style.background = 'transparent';
        btn.elt.title = `Particle palette color ${i + 1}: empty`;
        btn.elt.dataset.hex = '';
        btn.elt.setAttribute('aria-label', `Particle palette color ${i + 1}: empty`);
      }
      btn.elt.classList.toggle('is-selected', i === (colorTool.activeParticlePaletteIndex | 0));
    }
  };

  const setActiveParticlePaletteIndex = (index) => {
    const i = Math.max(0, Math.min(2, index | 0));
    colorTool.activeParticlePaletteIndex = i;
    refreshParticlePaletteUI();

    const hsb = colorTool?.particlePaletteHSB?.[i] ?? null;
    if (hsb) {
      const hex = hsbToHex(hsb.h, hsb.s, hsb.b);
      particleValueText.value(hex.toUpperCase());
      if (particleSpectrum?._setIdleHex) particleSpectrum._setIdleHex(hex);
    }
  };

  const particleSpectrum = createSpectrumPicker(particleSpectrumWrap, 160, 72, (h) => applyParticleHSB(h, false), (h) => applyParticleHSB(h, true));

  // Particle palette (3 slots) - placed to the right of the particle spectrum canvas.
  const particlePaletteCol = createDiv('').parent(particleSpectrumRow)
    .style('display', 'flex').style('flex-direction', 'column').style('gap', '6px').style('margin-top', '4px');
  const particlePaletteButtons = [];
  for (let i = 0; i < 3; i++) {
    const btn = createButton('').parent(particlePaletteCol).addClass('ui-swatch').style('margin', '0');
    btn.elt.type = 'button';
    btn.mousePressed(() => setActiveParticlePaletteIndex(i));
    btn.elt.addEventListener('contextmenu', (ev) => {
      ev.preventDefault();
      if (!Array.isArray(colorTool.particlePaletteHSB) || colorTool.particlePaletteHSB.length !== PARTICLE_PALETTE_SLOTS) {
        ensureParticlePaletteSize();
      }
      colorTool.particlePaletteHSB[i] = null;
      refreshParticlePaletteUI();
    });
    particlePaletteButtons.push(btn);
  }
  const backgroundSpectrum = createSpectrumPicker(backgroundSpectrumWrap, 160, 72, (h) => applyBackgroundHSB(h, false), (h) => applyBackgroundHSB(h, true));

  wireColorHexInput(particleValueText, applyParticleHSB, () => {
    const i = colorTool.activeParticlePaletteIndex | 0;
    return colorTool.particlePaletteHSB?.[i] ?? colorTool.particleBaseHSB;
  });
  wireColorHexInput(backgroundValueText, applyBackgroundHSB, () => colorTool.backgroundHSB);

  const createSwatches = (parentRow, onPickHex) => {
    for (let i = 0; i < 6; i++) {
      const btn = createButton('').parent(parentRow).addClass('ui-swatch').style('margin', '0').mousePressed(() => {
        const n = normalizeHexColor(btn.elt.dataset.hex); if (n) onPickHex(n);
      });
      btn.elt.type = 'button'; btn.elt.dataset.hex = '';
    }
  };
  createSwatches(particleRecentRow, (hex) => { const hsb = hexToHsb(hex); if (hsb) applyParticleHSB(hsb, true); });
  createSwatches(backgroundRecentRow, (hex) => { const hsb = hexToHsb(hex); if (hsb) applyBackgroundHSB(hsb, true); });

  particleSpeedSlider.input(() => {
    CONFIG.particles.speed = +particleSpeedSlider.value() || 0;
  });
  particleSizeSlider.input(() => {
    const v = +particleSizeSlider.value() || 0; particleSizeValueText.html(v.toFixed(2));
    if (userStageTransitionActive) return;
    const target = getAdaptiveParticleCount(v); if (particles.length > target) particles.length = target;
  });
  particleCountSlider.input(() => {
    const v = Math.max(0, Math.floor(+particleCountSlider.value() || 0)); CONFIG.particles.count = v;
    particleCountValueText.html(v.toLocaleString());
    const target = getAdaptiveParticleCount(); if (particles.length > target) particles.length = target;
    syncParticleCountToSize();
  });

  // Camera & Navigation
  const cameraSec = createSection('Camera');
  
  const zoomRow = createDiv('').parent(cameraSec).addClass('ui-row');
  createSpan('Zoom').parent(zoomRow);
  const zoomSlider = createSlider(1, 40, typeof camera !== 'undefined' ? camera.zoom : 1, 0.1).parent(zoomRow);
  const zoomValueText = createSpan(Number(typeof camera !== 'undefined' ? camera.zoom : 1).toFixed(1)).parent(zoomRow).addClass('ui-hex');
  
  colorTool.zoomSlider = zoomSlider;
  colorTool.zoomValueText = zoomValueText;

  zoomSlider.input(() => {
    setCameraZoom(+zoomSlider.value() || 1);
  });

  const positionRow = createDiv('').parent(cameraSec).addClass('ui-row').style('justify-content', 'center').style('margin-top', '10px');
  const dpadContainer = createDiv('').parent(positionRow).style('display', 'grid').style('grid-template-areas', '". up ." "left . right" ". down ."').style('gap', '4px');
  
  const btnStyle = 'width: 32px; height: 32px; font-size: 16px; border-radius: 4px; cursor: pointer; border: 1px solid rgba(255,255,255,0.22); background: rgba(0,0,0,0.4); color: white; display: flex; align-items: center; justify-content: center; padding: 0;';

  createButton('↑').parent(dpadContainer).style('grid-area', 'up').mousePressed(() => moveCamera(0, -1)).elt.style.cssText += btnStyle;
  createButton('←').parent(dpadContainer).style('grid-area', 'left').mousePressed(() => moveCamera(-1, 0)).elt.style.cssText += btnStyle;
  createButton('→').parent(dpadContainer).style('grid-area', 'right').mousePressed(() => moveCamera(1, 0)).elt.style.cssText += btnStyle;
  createButton('↓').parent(dpadContainer).style('grid-area', 'down').mousePressed(() => moveCamera(0, 1)).elt.style.cssText += btnStyle;

  // Interaction
  const interactionSec = createSection('Interaction');
  const interactionRow = createDiv('').parent(interactionSec).addClass('ui-row');
  const interactiveModeCheckbox = createCheckbox('Interactive mode', typeof interactionEnabled !== 'undefined' ? interactionEnabled : false)
    .parent(interactionRow)
    .input(() => {
      try { interactionEnabled = interactiveModeCheckbox.checked() === true || interactiveModeCheckbox.checked() === 'true'; } catch { /* ignore */ }
    });
  interactiveModeCheckbox.elt.setAttribute('aria-label', 'Interactive mode');

  const mapSec = createSection('Map'), mapRow = createDiv('').parent(mapSec).addClass('ui-row');
  createSpan('Image').parent(mapRow);
  const mapSelect = createSelect().parent(mapRow);
  const mapPaths = Array.isArray(CONFIG.map.imagePaths) && CONFIG.map.imagePaths.length ? CONFIG.map.imagePaths : [CONFIG.map.imagePath];
  for (const p of mapPaths) mapSelect.option(p, p);
  mapSelect.selected(activeMapImagePath || CONFIG.map.imagePath);
  mapSelect.changed(() => setActiveMapImage(mapSelect.value()));

  const gravRow = createDiv('').parent(mapSec).addClass('ui-row');
  createSpan('Gravitation').parent(gravRow);
  const gravitationSlider = createSlider(0, 4, CONFIG.magnet.strength, 0.05).parent(gravRow);
  gravitationSlider.elt.setAttribute('aria-label', 'Gravitation');
  const gravitationValueText = createSpan(Number(CONFIG.magnet.strength).toFixed(2)).parent(gravRow).addClass('ui-hex');
  gravitationSlider.input(() => gravitationValueText.html((+gravitationSlider.value() || 0).toFixed(2)));

  Object.assign(colorTool, {
    container, mapSelect, gravitationSlider, gravitationValueText, particleSpectrum, particleValueText, backgroundSpectrum, backgroundValueText,
    particleRecentColors: loadRecentColors(PARTICLE_RECENT_COLORS_STORAGE_KEY), backgroundRecentColors: loadRecentColors(BACKGROUND_RECENT_COLORS_STORAGE_KEY),
    particleRecentRow, backgroundRecentRow, transparentBackgroundCheckbox, trailFadeSlider, trailLowAlphaCullSlider, trailLowAlphaCullValueText, particleSpeedSlider, particleSizeSlider, particleSizeValueText, particleCountSlider, particleCountValueText,
    particleOverlapSlider, particleOverlapValueText,
    colorVarianceSlider, colorVarianceValueText,
    interactiveModeCheckbox,
    applyParticleHSB, applyBackgroundHSB,
    particlePaletteHSB: (() => {
      const p = Array(PARTICLE_PALETTE_SLOTS).fill(null);
      p[0] = initialParticle;
      return p;
    })(),
    activeParticlePaletteIndex: 0,
    particlePaletteButtons,
    setActiveParticlePaletteIndex,
    refreshParticlePaletteUI
  });

  refreshParticlePaletteUI();
  applyParticleHSB(initialParticle);
  applyBackgroundHSB(initialBg);
  updateRecentSwatches();

  // Default: all current particles use the first palette color.
  try {
    if (Array.isArray(particles)) for (const p of particles) p.paletteSlot = 0;
  } catch { /* ignore */ }
}

function setTransparentBackgroundEnabled(enabled) {
  const on = !!enabled;
  transparentBackgroundEnabled = on;
  if (colorTool.transparentBackgroundCheckbox) {
    try { colorTool.transparentBackgroundCheckbox.checked(on); } catch { /* ignore */ }
  }
  const toggle = userColorTool.transparentBackgroundToggle;
  if (toggle) {
    toggle.classList.toggle('is-active', on);
    toggle.setAttribute('aria-pressed', on ? 'true' : 'false');
  }
  if (on) hardClearMainCanvas();
  else {
    if (typeof trailLayer !== 'undefined' && trailLayer) trailLayer.clear();
    hardClearMainCanvas();
  }
}

function isTransparentBackgroundEnabled() {
  return transparentBackgroundEnabled;
}

function createUserTransparentBgToggle(parentEl) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'user-transparent-bg-toggle';
  btn.setAttribute('aria-label', 'Transparent background');
  btn.setAttribute('aria-pressed', 'false');
  btn.innerHTML = '<span class="user-transparent-bg-check" aria-hidden="true"></span>';
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    setTransparentBackgroundEnabled(!isTransparentBackgroundEnabled());
  });
  parentEl.appendChild(btn);
  return btn;
}

function getParticleSpeed() { const s = colorTool?.particleSpeedSlider; return s ? constrain(+s.value() || 0, 0, 2) : CONFIG.particles.speed; }
function getParticleStrokeWeight() { const s = colorTool?.particleSizeSlider; return s ? constrain(+s.value(), 0.05, 100) : CONFIG.particles.strokeWeight; }
function getParticleMix() { const s = colorTool?.particleMixSlider; return s ? constrain((+s.value() || 0) / 100, 0, 1) : 1; }
function getTrailToBackgroundMix() { const s = colorTool?.trailToBgMixSlider; return s ? constrain((+s.value() || 0) / 100, 0, 1) : 0; }
function getTrailFadeAlpha() { const s = colorTool?.trailFadeSlider; return s ? constrain(+s.value() || 0, 0, 100) : CONFIG.backgroundAlpha; }
function getTrailLowAlphaCull() {
  const s = colorTool?.trailLowAlphaCullSlider;
  if (!s) return Math.max(0, Math.min(255, Math.round(+CONFIG.trailLowAlphaCull || 0)));
  return constrain(Math.round(+s.value() || 0), 0, 80);
}
function getParticleOverlapVisibility() {
  const s = colorTool?.particleOverlapSlider;
  if (!s) return constrain(Math.round(+CONFIG.particles.overlapVisibility || 100), 0, 100);
  return constrain(Math.round(+s.value() || 0), 0, 100);
}
function getColorVariance() { const s = colorTool?.colorVarianceSlider; return s ? constrain((+s.value() || 0) / 100, 0, 2) : (CONFIG.particles.colorVariance ?? 1); }
function getGravitationStrength() { const s = colorTool?.gravitationSlider; return s ? constrain(+s.value(), 0, 50) : CONFIG.magnet.strength; }

function isPointerOverColorTool() {
  const x = typeof winMouseX === 'number' ? winMouseX : mouseX, y = typeof winMouseY === 'number' ? winMouseY : mouseY;
  const el = document.elementFromPoint(x, y);
  if (!el) return false;
  if (colorTool?.container?.elt && colorTool.container.elt.contains(el)) return true;
  if (userColorTool?.container?.elt && userColorTool.container.elt.contains(el)) return true;
  return false;
}

function isUserUiMode() {
  return uiMode === 'user';
}

function syncCameraZoomUI() {
  if (!camera) return;
  const v = camera.zoom;
  const slider = colorTool?.zoomSlider;
  if (slider) slider.value(v);
  if (colorTool?.zoomValueText) colorTool.zoomValueText.html(v.toFixed(1));
}

function noteManualZoomChange() {
  _userStageTarget = null;
  userStageTransitionActive = false;
  userStageFadePhase = null;
  _targetValues = null;
}

function isPointerOverUI() {
  const x = typeof winMouseX === 'number' ? winMouseX : mouseX, y = typeof winMouseY === 'number' ? winMouseY : mouseY;
  const el = document.elementFromPoint(x, y);
  if (!el) return false;
  const roots = ['ui-root', 'timeline-root', 'user-controls-root', 'user-color-root', 'user-stage-root', 'mode-toggle-root'];
  for (const id of roots) {
    const root = document.getElementById(id);
    if (root && root.contains(el)) return true;
  }
  return false;
}

function selectUserStage(index) {
  const t = Math.max(0, Math.min(USER_STAGE_PRESETS.length - 1, index));
  if (userStageSlider) userStageSlider.value = String(t);
  applyUserStageAt(t);
}

function initUserStageUI() {
  const root = document.getElementById('user-stage-root');
  if (!root || root.dataset.initialized === '1') return;
  root.dataset.initialized = '1';

  const wrap = document.createElement('div');
  wrap.className = 'user-stage-wrap';

  userStageSlider = document.createElement('input');
  userStageSlider.type = 'range';
  userStageSlider.className = 'user-stage-slider';
  userStageSlider.min = '0';
  userStageSlider.max = String(Math.max(0, USER_STAGE_PRESETS.length - 1));
  userStageSlider.step = '0.01';
  userStageSlider.value = '0';
  userStageSlider.setAttribute('aria-label', 'Stage preset');

  userStageSlider.addEventListener('input', (e) => {
    e.stopPropagation();
    applyUserStageAt(parseFloat(userStageSlider.value) || 0);
  });
  userStageSlider.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    userStageSliderDragging = true;
  });
  const endUserStageSliderDrag = () => {
    if (!userStageSliderDragging) return;
    userStageSliderDragging = false;
    beginUserStageFadeEaseDown();
  };
  userStageSlider.addEventListener('pointerup', endUserStageSliderDrag);
  userStageSlider.addEventListener('pointercancel', endUserStageSliderDrag);

  wrap.appendChild(userStageSlider);
  root.appendChild(wrap);
  requestAnimationFrame(layoutUserControlsWidth);
}

function initUserColorUI() {
  if (userColorTool.container) return;

  const initialParticle = colorTool.particleBaseHSB ?? (particles?.length ? { h: particles[0].h, s: particles[0].s, b: particles[0].b } : { h: 215, s: 85, b: 50 });
  const initialBg = colorTool.backgroundHSB ?? { h: 0, s: 0, b: 100 };
  const initialHex = hsbToHex(initialParticle.h, initialParticle.s, initialParticle.b);
  const initialBgHex = hsbToHex(initialBg.h, initialBg.s, initialBg.b);
  const container = createDiv('');
  try { if (document.getElementById('user-color-root')) container.parent('user-color-root'); } catch { /* ignore */ }
  container.style('user-select', 'none').addClass('user-color-inner');

  const hexRow = createDiv('').parent(container).addClass('ui-row user-color-hex-row').style('justify-content', 'center').style('margin-bottom', '6px');
  const particleValueText = createInput(initialHex.toUpperCase()).parent(hexRow).addClass('ui-hex');
  const backgroundValueText = createInput(initialBgHex.toUpperCase()).parent(hexRow).addClass('ui-hex');
  const controlsRow = createDiv('').parent(container).addClass('user-color-controls-row');
  createUserColorPresetRow(controlsRow);
  const transparentBackgroundToggle = createUserTransparentBgToggle(controlsRow.elt);

  wireColorHexInput(particleValueText, applyParticleHSB, () => colorTool.particleBaseHSB, 'Particle hex color');
  wireColorHexInput(backgroundValueText, applyBackgroundHSB, () => colorTool.backgroundHSB, 'Background hex color');

  Object.assign(userColorTool, { container, particleValueText, backgroundValueText, transparentBackgroundToggle });
  syncUserParticleColorUI(initialHex);
  syncUserBackgroundColorUI(initialBgHex);
  requestAnimationFrame(layoutUserControlsWidth);
}

let modeToggleUserBtn = null;
let modeToggleDevBtn = null;

function updateModeToggleUI() {
  if (modeToggleUserBtn) modeToggleUserBtn.classList.toggle('is-active', uiMode === 'user');
  if (modeToggleDevBtn) modeToggleDevBtn.classList.toggle('is-active', uiMode === 'dev');
}

function setUiMode(mode) {
  uiMode = mode === 'user' ? 'user' : 'dev';
  saveUiMode(uiMode);

  const uiRoot = document.getElementById('ui-root');
  const timelineRoot = document.getElementById('timeline-root');
  const userControlsRoot = document.getElementById('user-controls-root');

  if (uiMode === 'user') {
    deselectValueSet();
    if (uiRoot) uiRoot.style.display = 'none';
    if (timelineRoot) timelineRoot.style.display = 'none';
    if (userControlsRoot) userControlsRoot.style.display = 'flex';
    setTransparentBackgroundEnabled(false);
    if (colorTool.particleBaseHSB) {
      applyBackgroundHSB(computeHighContrastBackgroundHSB(colorTool.particleBaseHSB), false);
    }
    const t = userStageSlider ? parseFloat(userStageSlider.value) || 0 : 0;
    applyUserStageAt(t);
    requestAnimationFrame(layoutUserControlsWidth);
  } else {
    _userStageTarget = null;
    userStageTransitionActive = false;
    userStageParticleSyncPending = false;
    userStageFadePhase = null;
    userStageSliderDragging = false;
    if (userControlsRoot) userControlsRoot.style.display = 'none';
    if (timelineRoot) timelineRoot.style.display = '';
    activeUserStageIndex = -1;
    if (activeValueSetIndex < 0 && uiRoot) uiRoot.style.display = 'none';
  }

  updateModeToggleUI();
}

function initModeToggle() {
  const root = document.getElementById('mode-toggle-root');
  if (!root || root.dataset.initialized === '1') return;
  root.dataset.initialized = '1';

  const wrap = document.createElement('div');
  wrap.className = 'mode-switch';
  wrap.setAttribute('role', 'group');
  wrap.setAttribute('aria-label', 'UI mode');

  modeToggleUserBtn = document.createElement('button');
  modeToggleUserBtn.type = 'button';
  modeToggleUserBtn.className = 'mode-switch-btn';
  modeToggleUserBtn.textContent = 'User';
  modeToggleUserBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    setUiMode('user');
  });

  modeToggleDevBtn = document.createElement('button');
  modeToggleDevBtn.type = 'button';
  modeToggleDevBtn.className = 'mode-switch-btn';
  modeToggleDevBtn.textContent = 'Dev';
  modeToggleDevBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    setUiMode('dev');
  });

  wrap.appendChild(modeToggleUserBtn);
  wrap.appendChild(modeToggleDevBtn);
  root.appendChild(wrap);
  updateModeToggleUI();
}

// --- Timeline Value Sets UI --
const VALUE_SETS = [
  { size: 0.42, count: 16000, fade: 16, trailCull: 48, grav: 1.35, colorVar: 100, ph: 215, ps: 85, pb: 50, bh: 0, bs: 0, bb: 100, zoom: 1, camX: null, camY: null },
  { size: 0.42, count: 16000, fade: 16, trailCull: 48, grav: 1.35, colorVar: 100, ph: 215, ps: 85, pb: 50, bh: 0, bs: 0, bb: 100, zoom: 1, camX: null, camY: null },
  { size: 0.42, count: 16000, fade: 16, trailCull: 48, grav: 1.35, colorVar: 100, ph: 215, ps: 85, pb: 50, bh: 0, bs: 0, bb: 100, zoom: 1, camX: null, camY: null },
  { size: 0.42, count: 16000, fade: 16, trailCull: 48, grav: 1.35, colorVar: 100, ph: 215, ps: 85, pb: 50, bh: 0, bs: 0, bb: 100, zoom: 1, camX: null, camY: null },
];
let activeValueSetIndex = -1;
let _targetValues = null;

function initTimelineUI() {
  const root = document.getElementById('timeline-root');
  if(!root) return;
  const line = document.createElement('div');
  line.className = 'timeline-line';
  root.appendChild(line);

  VALUE_SETS.forEach((v, i) => {
    const dot = document.createElement('div');
    dot.className = 'timeline-dot';
    dot.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      selectValueSet(i);
    });
    root.appendChild(dot);
  });

  document.addEventListener('pointerdown', (e) => {
    const isTimelineOrUI = !!e.target.closest('.ui-root')
      || !!e.target.closest('.timeline-container')
      || !!e.target.closest('.user-controls-root')
      || !!e.target.closest('.user-color-root')
      || !!e.target.closest('.user-stage-root')
      || !!e.target.closest('.mode-toggle-root');
    if (!isTimelineOrUI && uiMode === 'dev') {
      deselectValueSet();
    }
  });

  const uiRootEl = document.getElementById('ui-root');
  if (uiRootEl) {
    uiRootEl.addEventListener('pointerdown', () => {
      _targetValues = null; // stop any ongoing transition if user interacts
    });
  }

  requestAnimationFrame(timelineLoop);
}

function selectValueSet(index) {
  activeValueSetIndex = index;
  _targetValues = VALUE_SETS[index];
  document.querySelectorAll('.timeline-dot').forEach((d, i) => {
    if(i === index) d.classList.add('active');
    else d.classList.remove('active');
  });
  const uiRoot = document.getElementById('ui-root');
  if(uiRoot) uiRoot.style.display = 'block';

  // Timeline value sets should always target the first particle palette slot.
  try { if (colorTool?.setActiveParticlePaletteIndex) colorTool.setActiveParticlePaletteIndex(0); } catch { /* ignore */ }
}

function deselectValueSet() {
  activeValueSetIndex = -1;
  document.querySelectorAll('.timeline-dot').forEach(d => d.classList.remove('active'));
  const uiRoot = document.getElementById('ui-root');
  if(uiRoot) uiRoot.style.display = 'none';
}

function minAngleDiff(a, b) {
  let diff = (b - a) % 360;
  if(diff < -180) diff += 360;
  if(diff > 180) diff -= 360;
  return diff;
}

function easeInOutCubic(t) {
  const x = constrain(t, 0, 1);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

function beginUserStageFadePulse() {
  userStageFadePhase = 'up';
  userStageFadeT = 0;
  userStageFadeFrom = colorTool?.trailFadeSlider
    ? parseFloat(colorTool.trailFadeSlider.value()) || userStageFadeTarget
    : userStageFadeTarget;
}

function beginUserStageFadeEaseDown() {
  if (!colorTool?.trailFadeSlider) return;
  const cur = parseFloat(colorTool.trailFadeSlider.value()) || userStageFadeTarget;
  const endFade = userStageFadeTarget ?? USER_STAGE_BASE.fade;
  if (cur <= endFade + 0.5) {
    userStageFadePhase = null;
    setSliderValue(colorTool.trailFadeSlider, endFade);
    return;
  }
  userStageFadePhase = 'down';
  userStageFadeT = 0;
  userStageFadeFrom = cur;
}

/** Ease fade up to peak, then down to target; returns true while the pulse is running. */
function stepUserStageFadePulse(targetFade) {
  if (!userStageFadePhase || !colorTool?.trailFadeSlider) return false;

  const fadeStep = 0.045;
  userStageFadeT = Math.min(1, userStageFadeT + fadeStep);
  const eased = easeInOutCubic(userStageFadeT);
  let v;

  if (userStageFadePhase === 'up') {
    v = userStageFadeFrom + (USER_STAGE_FADE_PEAK - userStageFadeFrom) * eased;
    if (userStageFadeT >= 1) {
      userStageFadePhase = 'down';
      userStageFadeT = 0;
      userStageFadeFrom = USER_STAGE_FADE_PEAK;
      v = USER_STAGE_FADE_PEAK;
    }
  } else {
    const endFade = targetFade ?? userStageFadeTarget ?? USER_STAGE_BASE.fade;
    v = userStageFadeFrom + (endFade - userStageFadeFrom) * eased;
    if (userStageFadeT >= 1) {
      userStageFadePhase = null;
      userStageFadeT = 0;
      v = endFade;
    }
  }

  const slider = colorTool.trailFadeSlider;
  const cur = parseFloat(slider.value());
  if (Math.abs(cur - v) > 0.01) {
    slider.value(v);
    slider.elt.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }

  return userStageFadePhase !== null;
}

function timelineLoop() {
  requestAnimationFrame(timelineLoop);

  if (userStageFadePhase && colorTool?.trailFadeSlider && uiMode === 'user') {
    stepUserStageFadePulse(userStageFadeTarget);
  }

  if (userStageParticleSyncPending && typeof syncParticleCountGradual === 'function') {
    try {
      if (syncParticleCountGradual(120)) userStageParticleSyncPending = false;
    } catch { userStageParticleSyncPending = false; }
  }

  const activeTarget = _userStageTarget || _targetValues;
  const isUserStage = !!_userStageTarget;

  if (activeTarget && colorTool && colorTool.particleSizeSlider) {
    userStageTransitionActive = isUserStage;
    const amt = isUserStage ? 0.16 : 0.22;
    let anyChanged = false;

    const setLerp = (slider, target) => {
      const cur = parseFloat(slider.value());
      const step = parseFloat(slider.elt.step) || 0.05;
      if (Math.abs(cur - target) >= step / 2 + 0.001) {
        let v = cur + (target - cur) * amt;
        if (Math.abs(v - cur) < step * 0.5) {
          v = cur + Math.sign(target - cur) * step;
        }
        slider.value(v);
        slider.elt.dispatchEvent(new Event('input', { bubbles: true }));
        anyChanged = true;
      } else if (cur !== target) {
        slider.value(target);
        slider.elt.dispatchEvent(new Event('input', { bubbles: true }));
      }
    };

    setLerp(colorTool.particleSizeSlider, activeTarget.size);
    setLerp(colorTool.particleCountSlider, activeTarget.count);
    if (!isUserStage) {
      setLerp(colorTool.trailFadeSlider, activeTarget.fade);
    }
    if (colorTool.trailLowAlphaCullSlider && activeTarget.trailCull !== undefined && activeTarget.trailCull !== null) {
      setLerp(colorTool.trailLowAlphaCullSlider, activeTarget.trailCull);
    }

    if (isUserStage) {
      if (stepUserStageFadePulse(activeTarget.fade)) anyChanged = true;
      if (colorTool.gravitationSlider && activeTarget.grav !== undefined) {
        setLerp(colorTool.gravitationSlider, activeTarget.grav);
      }
      if (colorTool.particleOverlapSlider && activeTarget.overlap !== undefined) {
        setLerp(colorTool.particleOverlapSlider, activeTarget.overlap);
      }
      if (colorTool.colorVarianceSlider && activeTarget.colorVar !== undefined) {
        setLerp(colorTool.colorVarianceSlider, activeTarget.colorVar);
      }
      if (colorTool.particleSpeedSlider && activeTarget.speed !== undefined) {
        setLerp(colorTool.particleSpeedSlider, activeTarget.speed);
      }
    } else {
      setLerp(colorTool.gravitationSlider, activeTarget.grav);
      if (colorTool.colorVarianceSlider && activeTarget.colorVar !== undefined && activeTarget.colorVar !== null) {
        setLerp(colorTool.colorVarianceSlider, activeTarget.colorVar);
      }
      if (colorTool.zoomSlider && activeTarget.zoom !== undefined) {
        setLerp(colorTool.zoomSlider, activeTarget.zoom);
      }

      if (typeof camera !== 'undefined' && camera && activeTarget.camX !== null && activeTarget.camY !== null && activeTarget.camX !== undefined && activeTarget.camY !== undefined) {
        const cxTarget = activeTarget.camX, cyTarget = activeTarget.camY;
        const diffX = cxTarget - camera.center.x, diffY = cyTarget - camera.center.y;
        if (Math.abs(diffX) > 0.5 || Math.abs(diffY) > 0.5) {
          camera.center.x += diffX * amt;
          camera.center.y += diffY * amt;
          anyChanged = true;
        } else {
          camera.center.x = cxTarget;
          camera.center.y = cyTarget;
        }
      }

      if (colorTool.particleBaseHSB && activeTarget.ph !== undefined) {
        const ph = colorTool.particleBaseHSB.h;
        const dh = minAngleDiff(ph, activeTarget.ph);
        if (Math.abs(dh) > 1 || Math.abs(colorTool.particleBaseHSB.s - activeTarget.ps) > 1 || Math.abs(colorTool.particleBaseHSB.b - activeTarget.pb) > 1) {
          colorTool.applyParticleHSB({
            h: (ph + dh * amt + 360) % 360,
            s: colorTool.particleBaseHSB.s + (activeTarget.ps - colorTool.particleBaseHSB.s) * amt,
            b: colorTool.particleBaseHSB.b + (activeTarget.pb - colorTool.particleBaseHSB.b) * amt
          }, false);
          anyChanged = true;
        } else if (ph !== activeTarget.ph || colorTool.particleBaseHSB.s !== activeTarget.ps || colorTool.particleBaseHSB.b !== activeTarget.pb) {
          colorTool.applyParticleHSB({ h: activeTarget.ph, s: activeTarget.ps, b: activeTarget.pb }, false);
        }
      }

      if (colorTool.backgroundHSB && activeTarget.bh !== undefined) {
        const bh = colorTool.backgroundHSB.h;
        const dbh = minAngleDiff(bh, activeTarget.bh);
        if (Math.abs(dbh) > 1 || Math.abs(colorTool.backgroundHSB.s - activeTarget.bs) > 1 || Math.abs(colorTool.backgroundHSB.b - activeTarget.bb) > 1) {
          colorTool.applyBackgroundHSB({
            h: (bh + dbh * amt + 360) % 360,
            s: colorTool.backgroundHSB.s + (activeTarget.bs - colorTool.backgroundHSB.s) * amt,
            b: colorTool.backgroundHSB.b + (activeTarget.bb - colorTool.backgroundHSB.b) * amt
          }, false);
          anyChanged = true;
        } else if (bh !== activeTarget.bh || colorTool.backgroundHSB.s !== activeTarget.bs || colorTool.backgroundHSB.b !== activeTarget.bb) {
          colorTool.applyBackgroundHSB({ h: activeTarget.bh, s: activeTarget.bs, b: activeTarget.bb }, false);
        }
      }
    }

    if (!anyChanged && !(isUserStage && userStageFadePhase)) {
      if (isUserStage) {
        _userStageTarget = null;
        userStageTransitionActive = false;
        userStageFadePhase = null;
        userStageParticleSyncPending = true;
      } else {
        _targetValues = null;
      }
    }
  } else if (!_userStageTarget && !(_targetValues) && activeValueSetIndex >= 0 && colorTool && colorTool.particleSizeSlider) {
    if (colorTool.particleBaseHSB && colorTool.backgroundHSB) {
      VALUE_SETS[activeValueSetIndex] = {
        size: parseFloat(colorTool.particleSizeSlider.value()),
        count: parseFloat(colorTool.particleCountSlider.value()),
        fade: parseFloat(colorTool.trailFadeSlider.value()),
        trailCull: colorTool.trailLowAlphaCullSlider ? parseFloat(colorTool.trailLowAlphaCullSlider.value()) : 48,
        grav: parseFloat(colorTool.gravitationSlider.value()),
        colorVar: colorTool.colorVarianceSlider ? parseFloat(colorTool.colorVarianceSlider.value()) : 100,
        ph: colorTool.particleBaseHSB.h, ps: colorTool.particleBaseHSB.s, pb: colorTool.particleBaseHSB.b,
        bh: colorTool.backgroundHSB.h, bs: colorTool.backgroundHSB.s, bb: colorTool.backgroundHSB.b,
        zoom: colorTool.zoomSlider ? parseFloat(colorTool.zoomSlider.value()) : 1,
        camX: (typeof camera !== 'undefined' && camera && camera.center) ? camera.center.x : null,
        camY: (typeof camera !== 'undefined' && camera && camera.center) ? camera.center.y : null
      };
    }
  }
}

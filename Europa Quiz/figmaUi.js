const FIGMA_W = 3840;
const FIGMA_H = 2160;

function figmaPos(x, y, w, h) {
  const style = {
    left: `${(x / FIGMA_W) * 100}%`,
    top: `${(y / FIGMA_H) * 100}%`
  };
  if (w != null) style.width = `${(w / FIGMA_W) * 100}%`;
  if (h != null) style.height = `${(h / FIGMA_H) * 100}%`;
  return style;
}

function applyPos(el, x, y, w, h) {
  Object.assign(el.style, figmaPos(x, y, w, h));
  return el;
}

function mountFigmaStage(container, options = {}) {
  container.classList.add('quiz-overlay--figma');
  const screen = document.createElement('div');
  screen.className = 'figma-screen stage-enter-preparing';
  if (options.tap) screen.classList.add('figma-screen--tap');
  container.appendChild(screen);

  const cleanup = () => {
    container.classList.remove('quiz-overlay--figma');
  };
  screen._cleanup = cleanup;

  return { screen, cleanup };
}

function unmountFigmaStage(container) {
  if (window.particleField?.detach) particleField.detach();
  const screen = container.querySelector('.figma-screen');
  if (screen?._labelFollowCleanups?.length) {
    for (const cleanup of screen._labelFollowCleanups) cleanup();
    screen._labelFollowCleanups = [];
  }
  if (screen?._particleCleanups?.length) {
    for (const cleanup of screen._particleCleanups) cleanup();
    screen._particleCleanups = [];
  }
  if (screen?._cleanup) screen._cleanup();
}

const LABEL_FOLLOW_EASE = 0.05;

function createEasedLabelFollower(label, initialX, initialY, screen) {
  const state = {
    targetX: initialX,
    targetY: initialY,
    displayX: initialX,
    displayY: initialY,
    running: true,
    rafId: 0
  };

  function tick() {
    if (!state.running) return;
    state.displayX += (state.targetX - state.displayX) * LABEL_FOLLOW_EASE;
    state.displayY += (state.targetY - state.displayY) * LABEL_FOLLOW_EASE;
    applyPos(label, state.displayX, state.displayY);
    state.rafId = requestAnimationFrame(tick);
  }

  state.rafId = requestAnimationFrame(tick);

  function cleanup() {
    state.running = false;
    if (state.rafId) cancelAnimationFrame(state.rafId);
  }

  if (screen) {
    if (!screen._labelFollowCleanups) screen._labelFollowCleanups = [];
    screen._labelFollowCleanups.push(cleanup);
  }

  return {
    setTarget(x, y) {
      state.targetX = x;
      state.targetY = y;
    },
    cleanup
  };
}

function addParticleRegion(screen, x, y, w, h, colorClass = '', labelOptions = null) {
  const colorHex = colorClassToHex(colorClass);
  const region = createParticleRegion(screen, x, y, w, h, colorHex);
  if (!screen._particleCleanups) screen._particleCleanups = [];
  screen._particleCleanups.push(region.cleanup);

  if (labelOptions?.text) {
    const labelX = labelOptions.x ?? labelOptions.lx;
    const labelY = labelOptions.y ?? labelOptions.ly;
    const label = addLabel(screen, labelOptions.text, labelX, labelY);
    bindLabelToParticle(label, region, labelX, labelY);
  }

  return region;
}

function addCenteredLabel(screen, text, cx, cy) {
  const el = addLabel(screen, text, cx, cy);
  el.style.transform = 'translate(-50%, -50%)';
  return el;
}

const CHOICE_PARTICLE_SIZE = 520;
const CHOICE_PARTICLE_RADIUS = 300;
const CHOICE_PARTICLE_MOTION = { spawnAnimation: true, motionProfile: 'float' };
const CHOICE_TEXT_HIT_PAD = { x: 340, y: 90 };

const CONTROL_PARTICLE_GLYPH_RATIO = 0.4;
const CONTROL_PARTICLE_REGION_SIZE = 280;

const CONTROL_UP_ARROW_SVG =
  '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
  '<path d="M12 19 V7" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>' +
  '<path d="M6 11 L12 5 L18 11" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>' +
  '</svg>';

const CONTROL_REPLAY_SVG =
  '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
  '<path d="M12 4 A8 8 0 1 0 19.5 15.5" stroke="#fff" stroke-width="2.6" stroke-linecap="round" fill="none"/>' +
  '<path d="M9.5 4.5 L12 4 L9.5 6.5" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>' +
  '</svg>';

function controlParticleRegionForButton(btnX, btnY, btnSize = 156) {
  const pad = (CONTROL_PARTICLE_REGION_SIZE - btnSize) / 2;
  return {
    x: btnX - pad,
    y: btnY - pad,
    w: CONTROL_PARTICLE_REGION_SIZE,
    h: CONTROL_PARTICLE_REGION_SIZE
  };
}

function spawnScreenControlParticle(screen, regionDef, glyphHtml, onClick, ariaLabel, options = {}) {
  const glyphRatio = options.glyphRatio ?? CONTROL_PARTICLE_GLYPH_RATIO;
  const colorHex = options.colorHex ?? '#00263e';
  const { x, y, w, h } = regionDef;

  const reg = createParticleRegion(screen, x, y, w, h, colorHex, {
    spawnAnimation: options.spawnAnimation !== false,
    skipStageAnim: true
  });

  const size = Math.min(w, h) * glyphRatio;
  const cx = x + w / 2;
  const cy = y + h / 2;

  const glyph = document.createElement('span');
  glyph.className = 'control-particle-glyph';
  glyph.innerHTML = glyphHtml;
  applyPos(glyph, cx - size / 2, cy - size / 2, size, size);
  markStageTier(glyph, 'interactive');
  screen.appendChild(glyph);

  const follower = createEasedLabelFollower(glyph, cx - size / 2, cy - size / 2, screen);
  reg.onPosition((nx, ny) => {
    const px = reg.bounds.x + nx * reg.bounds.w;
    const py = reg.bounds.y + ny * reg.bounds.h;
    follower.setTarget(px - size / 2, py - size / 2);
  });

  const hit = document.createElement('button');
  hit.type = 'button';
  hit.className = 'control-particle-hit';
  hit.setAttribute('aria-label', ariaLabel);
  applyPos(hit, x, y, w, h);
  hit.addEventListener('click', (e) => {
    e.stopPropagation();
    onClick();
  });
  markStageTier(hit, 'interactive');
  screen.appendChild(hit);

  const cleanup = () => {
    follower.cleanup();
    reg.cleanup();
    glyph.remove();
    hit.remove();
  };

  if (!screen._particleCleanups) screen._particleCleanups = [];
  screen._particleCleanups.push(cleanup);

  return { cleanup, glyph, hit, region: reg };
}

function addChoiceText(screen, text, x, y) {
  const el = document.createElement('span');
  el.className = 'figma-choice';
  el.textContent = text;
  el.setAttribute('aria-hidden', 'true');
  el.style.left = `${(x / FIGMA_W) * 100}%`;
  el.style.top = `${(y / FIGMA_H) * 100}%`;
  el.style.pointerEvents = 'none';
  markStageTier(el, 'content');
  screen.appendChild(el);
  return el;
}

// Fraction of the blob size the particle's center is allowed to wander from its
// anchor. Small so the blob stays hugging its text.
const CHOICE_WANDER_RATIO = 0.32;

function getAnchoredField(screen) {
  if (!screen._anchoredField) {
    screen._anchoredField = createAnchoredParticleField(screen);
    if (!screen._particleCleanups) screen._particleCleanups = [];
    screen._particleCleanups.push(screen._anchoredField.cleanup);
  }
  return screen._anchoredField;
}

// All anchored "choice" particles on a stage share one canvas + animation loop
// (see createAnchoredParticleField) so the framerate matches the idle stage.
// `blobSize` controls the visual blob size; the wander leash is kept small so
// the particle stays around its text.
function spawnAnchoredParticle(screen, anchorX, anchorY, blobSize, color, options = {}) {
  const colorHex = options.colorHex ?? colorClassToHex(color);
  const field = getAnchoredField(screen);
  const wanderFigma = options.wanderFigma ?? blobSize * CHOICE_WANDER_RATIO;
  return field.addParticle(anchorX, anchorY, colorHex, {
    wanderFigma,
    strokeFigma: blobSize,
    instantAppear: options.instantAppear
  });
}

// Backwards-compatible alias. (`blobSize` here is the visual particle size.)
function spawnRandomParticleAround(screen, anchorX, anchorY, blobSize, _radius, color, options = {}) {
  return spawnAnchoredParticle(screen, anchorX, anchorY, blobSize, color, options);
}

function addFloatingParticle(screen, cx, cy, size, colorClass = '') {
  const half = size / 2;
  return addParticleRegion(screen, cx - half, cy - half, size, size, colorClass);
}

function bindLabelToParticle(label, region, labelX, labelY) {
  const screen = label.closest('.figma-screen');
  const { x, y, w, h } = region.bounds;
  const offsetX = labelX - x - w / 2;
  const offsetY = labelY - y - h / 2;
  const follower = createEasedLabelFollower(label, labelX, labelY, screen);
  region.onPosition((nx, ny) => {
    follower.setTarget(x + nx * w + offsetX, y + ny * h + offsetY);
  });
}

function bindLabelToParticleAverage(label, regions, labelX, labelY) {
  const screen = label.closest('.figma-screen');
  const avgCenterX = regions.reduce((sum, r) => sum + r.bounds.x + r.bounds.w / 2, 0) / regions.length;
  const avgCenterY = regions.reduce((sum, r) => sum + r.bounds.y + r.bounds.h / 2, 0) / regions.length;
  const offsetX = labelX - avgCenterX;
  const offsetY = labelY - avgCenterY;
  const positions = regions.map(() => ({ nx: 0.5, ny: 0.5 }));
  const follower = createEasedLabelFollower(label, labelX, labelY, screen);

  const updateTarget = () => {
    let ax = 0;
    let ay = 0;
    regions.forEach((region, i) => {
      ax += region.bounds.x + positions[i].nx * region.bounds.w;
      ay += region.bounds.y + positions[i].ny * region.bounds.h;
    });
    ax /= regions.length;
    ay /= regions.length;
    follower.setTarget(ax + offsetX, ay + offsetY);
  };

  regions.forEach((region, i) => {
    region.onPosition((nx, ny) => {
      positions[i] = { nx, ny };
      updateTarget();
    });
  });
}

function addLabelFollowingParticleAverage(screen, text, labelX, labelY, regions) {
  const label = addLabel(screen, text, labelX, labelY);
  bindLabelToParticleAverage(label, regions, labelX, labelY);
  return label;
}

// The pause control is now a single persistent floating particle managed by
// pauseParticle.js (mounted outside the stage DOM), so per-stage stages no
// longer render their own pause dot. Kept as a no-op so existing stage code
// keeps working without edits.
function addPauseButton() {
  return null;
}

function addContinueButton(screen, onClick, options = {}) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'figma-continue';
  if (options.variant === 'add') btn.classList.add('figma-continue--add');
  if (options.hidden) btn.classList.add('figma-continue--hidden');
  btn.setAttribute('aria-label', options.label || 'Weiter');
  btn.textContent = options.icon || '→';
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    onClick();
  });
  markStageTier(btn, 'interactive');
  screen.appendChild(btn);
  return btn;
}

function showSelectionConfirm(screen) {
  if (!window.confirmParticle) return;
  confirmParticle.show({
    onClick: () => {
      if (screen._selectedHit?._onConfirm) screen._selectedHit._onConfirm();
      else if (screen._selectionConfirmHandler) screen._selectionConfirmHandler();
    },
    label: 'Auswahl bestätigen'
  });
}

function addConfirmParticle(onClick, options = {}) {
  if (!window.confirmParticle) return;

  const showConfirm = () => {
    confirmParticle.show({
      onClick,
      delayMs: options.delayMs ?? 0,
      label: options.label || 'Weiter'
    });
  };

  const deferUntilEnter = options.deferUntilEnter !== false;
  if (deferUntilEnter && window.stageTransitions) {
    stageTransitions.onEnterTier('interactive', showConfirm);
  } else {
    showConfirm();
  }
}

// Bottom-center confirm control for selection stages (hidden until something is selected).
function addSelectionConfirmButton(screen, onConfirm, options = {}) {
  screen._selectionConfirmHandler = onConfirm;
  return null;
}

function addHitArea(screen, x, y, w, h, onClick, ariaLabel) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'figma-hit';
  btn.setAttribute('aria-label', ariaLabel);
  applyPos(btn, x, y, w, h);
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    onClick();
  });
  markStageTier(btn, 'interactive');
  screen.appendChild(btn);
  return btn;
}

const CHECK_SVG = '<svg class="figma-check-svg" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 12.5 L9.5 18 L20 6.5" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function createCheckmark() {
  const el = document.createElement('span');
  el.className = 'figma-check';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = CHECK_SVG;
  return el;
}

// How much the hit area extends beyond the particle region bounds.
const HIT_PADDING_RATIO = 0.08;

function clearSelectionHighlights(screen) {
  if (!screen._selectedRegions?.length) return;
  for (const region of screen._selectedRegions) region.setSelected?.(false);
  screen._selectedRegions = [];
}

// Single click selects an option and draws a white dot on the particle canvas.
// Confirmation happens via the bottom confirm particle (addConfirmParticle).
function addSelectableHitArea(screen, regions, onConfirm, ariaLabel, options = {}) {
  const regionList = Array.isArray(regions) ? regions : [regions];
  const boundsOf = (r) => r.interactionBounds || r.bounds;

  let minX = Math.min(...regionList.map((r) => boundsOf(r).x));
  let minY = Math.min(...regionList.map((r) => boundsOf(r).y));
  let maxX = Math.max(...regionList.map((r) => boundsOf(r).x + boundsOf(r).w));
  let maxY = Math.max(...regionList.map((r) => boundsOf(r).y + boundsOf(r).h));

  if (options.textAnchor) {
    const pad = options.textHitPad || CHOICE_TEXT_HIT_PAD;
    minX = Math.min(minX, options.textAnchor.x - pad.x);
    minY = Math.min(minY, options.textAnchor.y - pad.y);
    maxX = Math.max(maxX, options.textAnchor.x + pad.x);
    maxY = Math.max(maxY, options.textAnchor.y + pad.y);
  }

  const boxW = maxX - minX;
  const boxH = maxY - minY;
  const pad = Math.min(boxW, boxH) * HIT_PADDING_RATIO;
  const hit = { x: minX - pad, y: minY - pad, w: boxW + pad * 2, h: boxH + pad * 2 };

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'figma-hit';
  btn.setAttribute('aria-label', ariaLabel);
  applyPos(btn, hit.x, hit.y, hit.w, hit.h);
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    clearSelectionHighlights(screen);
    screen._selectedHit = btn;
    screen._selectedRegions = regionList;
    btn._onConfirm = onConfirm;
    for (const region of regionList) region.setSelected?.(true);
    showSelectionConfirm(screen);
  });
  markStageTier(btn, 'interactive');
  screen.appendChild(btn);
  return btn;
}

function addPlaceholder(screen, x, y, w, h, colorClass = '') {
  const el = document.createElement('div');
  el.className = `figma-placeholder${colorClass ? ` ${colorClass}` : ''}`;
  el.setAttribute('aria-hidden', 'true');
  applyPos(el, x, y, w, h);
  markStageTier(el, 'content');
  screen.appendChild(el);
  return el;
}

function addTitle(screen, text) {
  const el = document.createElement('h1');
  el.className = 'figma-title';
  el.textContent = text;
  markStageTier(el, 'heading');
  screen.appendChild(el);
  return el;
}

function addSubtitle(screen, text) {
  const el = document.createElement('p');
  el.className = 'figma-subtitle';
  el.textContent = text;
  markStageTier(el, 'heading');
  screen.appendChild(el);
  return el;
}

function addHero(screen, text, options = {}) {
  const el = document.createElement('h1');
  el.className = `figma-hero${options.black ? ' figma-hero--black' : ''}`;
  el.textContent = text;
  markStageTier(el, 'heading');
  screen.appendChild(el);
  return el;
}

function addHint(screen, text) {
  const el = document.createElement('p');
  el.className = 'figma-hint';
  el.textContent = text;
  markStageTier(el, 'heading');
  screen.appendChild(el);
  return el;
}

function addLabel(screen, text, x, y) {
  const el = document.createElement('span');
  el.className = 'figma-label';
  el.textContent = text;
  applyPos(el, x, y);
  markStageTier(el, 'content');
  screen.appendChild(el);
  return el;
}

function addQuestionHeader(screen, step, questionHtml, options = {}) {
  const parent = options.parent || screen;
  const wrap = document.createElement('div');
  wrap.className = 'figma-question-header';
  const stepEl = document.createElement('p');
  stepEl.className = 'figma-question-step';
  stepEl.textContent = step;
  const qEl = document.createElement('h1');
  qEl.className = 'figma-question-text';
  qEl.innerHTML = questionHtml;
  wrap.appendChild(stepEl);
  wrap.appendChild(qEl);
  markStageTier(wrap, 'heading');
  parent.appendChild(wrap);
  return wrap;
}

function addAnswerHeader(screen, context, resultHtml, options = {}) {
  const parent = options.parent || screen;
  const wrap = document.createElement('div');
  wrap.className = 'figma-answer-header';
  const ctxEl = document.createElement('p');
  ctxEl.className = 'figma-answer-context';
  ctxEl.textContent = context;
  const resEl = document.createElement('h1');
  resEl.className = 'figma-answer-result';
  resEl.innerHTML = resultHtml;
  wrap.appendChild(ctxEl);
  wrap.appendChild(resEl);
  markStageTier(wrap, 'heading');
  parent.appendChild(wrap);
  return wrap;
}

function addInstruction(screen, text, options = {}) {
  const parent = options.parent || screen;
  const el = document.createElement('p');
  el.className = 'figma-instruction';
  el.textContent = text;
  markStageTier(el, 'heading');
  parent.appendChild(el);
  return el;
}

function addDot(screen, x, y, size, extraClass = '', options = {}) {
  const el = document.createElement('div');
  el.className = `figma-dot figma-dot--marker${extraClass ? ` ${extraClass}` : ''}`;
  applyPos(el, x, y, size, size);
  if (options.color) {
    el.style.background = options.color;
    el.style.boxShadow = `0 0 0 calc(4 * 100vw / var(--figma-canvas-width)) #fff`;
  }
  markStageTier(el, 'content');
  screen.appendChild(el);
  return el;
}

function wireTapToProceed(screen, ctx, options = {}) {
  const delay = options.delay ?? 150;
  const onProceed = options.onProceed;
  let armed = false;
  let proceeding = false;
  const timer = setTimeout(() => { armed = true; }, delay);
  const proceed = (event) => {
    if (!armed || proceeding) return;
    proceeding = true;
    if (onProceed) onProceed(event);
    else ctx.goNext();
  };
  screen.addEventListener('click', proceed);
  screen._tapCleanup = () => {
    clearTimeout(timer);
    screen.removeEventListener('click', proceed);
  };
}

function buildTimeline(screen, options = {}) {
  const years = options.years || [
    { label: '1950', x: 189 },
    { label: '1975', x: 1011 },
    { label: '2000', x: 1835 },
    { label: '2025', x: 2683 },
    { label: '2050', x: 3515 }
  ];

  const wrap = document.createElement('div');
  wrap.className = 'figma-timeline';
  const line = document.createElement('div');
  line.className = 'figma-timeline-line';
  wrap.appendChild(line);

  for (const year of years) {
    const tick = document.createElement('div');
    tick.className = 'figma-timeline-tick';
    tick.style.left = `${(year.x / FIGMA_W) * 100}%`;
    wrap.appendChild(tick);

    const label = document.createElement('p');
    label.className = 'figma-timeline-year';
    label.textContent = year.label;
    label.style.left = `${(year.x / FIGMA_W) * 100}%`;
    wrap.appendChild(label);
  }

  markStageTier(wrap, 'content');
  screen.appendChild(wrap);
  return wrap;
}

function addTimelineMarker(screen, t, options = {}) {
  const marker = document.createElement('div');
  marker.className = `figma-timeline-marker${options.correct ? ' figma-timeline-marker--correct' : ''}`;
  const xPct = 6.6 + t * 87;
  marker.style.left = `${xPct}%`;
  if (options.color) {
    marker.style.background = options.color;
    marker.style.boxShadow = `0 0 0 calc(2 * 100vw / var(--figma-canvas-width)) ${options.color}`;
  }
  if (!options.static) {
    marker.style.cursor = 'grab';
    markStageTier(marker, 'interactive');
    let dragging = false;
    const onMove = (clientX) => {
      const line = screen.querySelector('.figma-timeline-line');
      if (!line) return;
      const rect = line.getBoundingClientRect();
      const nt = constrain((clientX - rect.left) / rect.width, 0, 1);
      marker.style.left = `${6.6 + nt * 87}%`;
      if (options.onChange) options.onChange(nt);
    };
    marker.addEventListener('pointerdown', (e) => {
      dragging = true;
      marker.setPointerCapture(e.pointerId);
      onMove(e.clientX);
      e.preventDefault();
    });
    marker.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      onMove(e.clientX);
    });
    marker.addEventListener('pointerup', (e) => {
      dragging = false;
      try { marker.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    });
    marker.addEventListener('pointercancel', () => { dragging = false; });
  } else {
    markStageTier(marker, 'content');
  }
  screen.appendChild(marker);
  return marker;
}

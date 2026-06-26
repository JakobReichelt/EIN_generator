// Shared pannable/zoomable Europe map for question3Map and answer3Map stages.

const MAP_Y = 0;
const MAP_H = FIGMA_H;
const MAP_MARKER_SIZE = 180;
const MAP_DRAG_THRESHOLD_PX = 6;
const MAP_FIT_MIN_SPREAD = 0.12;
const MAP_DEFAULT_SCALE = 1.85;
const MAP_MAX_SCALE = 4;
const MAP_SVG_ASPECT = 1;
const MAP_FOCUS = { x: 0.5, y: 0.5 };
const MAP_ASPECT = MAP_SVG_ASPECT;
const MAP_TRANSITION_EASE = 'cubic-bezier(0.65, 0, 0.35, 1)';

function resolveEuropeMapAsset(topicId) {
  return getEuropeMapAsset(resolveEuropeMapTopicId(topicId));
}

function syncMapSvgAsset(world, topicId) {
  const img = world?.querySelector('.figma-map-svg');
  if (!img) return null;
  const asset = resolveEuropeMapAsset(topicId);
  if (img.getAttribute('src') !== asset) img.setAttribute('src', asset);
  return asset;
}

function createEuropeMapMarkup(topicId) {
  const asset = resolveEuropeMapAsset(topicId);
  return (
    `<img class="figma-map-svg" src="${asset}" alt="" aria-hidden="true" draggable="false">`
  );
}

let mapHandoff = null;
let retainedMap = null;

const MAP_EXPLANATION_GAP_FIGMA = 100;
const MAP_EXPLANATION_HEIGHT_FIGMA = 168;
const MAP_EXPLANATION_WIDTH_FIGMA = 770;
const MAP_HEADER_GAP_FIGMA = 80;
const MAP_MARKER_PAD_FIGMA = MAP_MARKER_SIZE * 0.55;
const MAP_BLOB_RADIUS_RATIO = window.MAP_MARKER_DRAW?.radiusRatio ?? 0.38;
const MAP_FIT_MIN_SCALE = 0.75;

function getCorrectMapImagePoint() {
  return { ...(QUIZ_SCORING?.correct?.q3MapPoint ?? { x: 0.480, y: 0.810 }) };
}

function getCorrectMapPoint() {
  return getCorrectMapImagePoint();
}

function getMapCoverSizePx() {
  const w = window.innerWidth || FIGMA_W;
  const h = window.innerHeight || FIGMA_H;
  return Math.min(w, h);
}

function getVisualMarkerRadiusPx() {
  const markerPx = (MAP_MARKER_SIZE / FIGMA_W) * (window.innerWidth || FIGMA_W);
  return (markerPx / 2) * MAP_BLOB_RADIUS_RATIO;
}

function particleCirclesTouch(elA, elB) {
  if (!elA || !elB) return false;
  const a = elA.getBoundingClientRect();
  const b = elB.getBoundingClientRect();
  const ax = a.left + a.width / 2;
  const ay = a.top + a.height / 2;
  const bx = b.left + b.width / 2;
  const by = b.top + b.height / 2;
  const ra = (Math.min(a.width, a.height) / 2) * MAP_BLOB_RADIUS_RATIO;
  const rb = (Math.min(b.width, b.height) / 2) * MAP_BLOB_RADIUS_RATIO;
  return Math.hypot(ax - bx, ay - by) <= ra + rb;
}

function getMapTouchTolerance() {
  const coverPx = getMapCoverSizePx();
  if (coverPx < 1) return 0;
  return (2 * getVisualMarkerRadiusPx()) / coverPx;
}

function isMapAnswerCorrect(userWorldNorm) {
  if (!userWorldNorm) return false;
  const correct = getCorrectMapImagePoint();
  return Math.hypot(userWorldNorm.x - correct.x, userWorldNorm.y - correct.y)
    <= getMapTouchTolerance();
}

function getExplanationFitPoint(correctPoint) {
  const ySpan =
    (MAP_EXPLANATION_GAP_FIGMA + MAP_EXPLANATION_HEIGHT_FIGMA) / FIGMA_H;
  return {
    x: correctPoint.x,
    y: Math.min(correctPoint.y + ySpan, 0.98)
  };
}

function getCorrectOnlyFitPoints(correctPoint) {
  const markerHalf = (MAP_MARKER_PAD_FIGMA / 2) / FIGMA_H;
  const textHalfX = (MAP_EXPLANATION_WIDTH_FIGMA / 2) / FIGMA_H;
  const textTopY = correctPoint.y + MAP_EXPLANATION_GAP_FIGMA / FIGMA_H;
  const textBottomY = Math.min(
    correctPoint.y + (MAP_EXPLANATION_GAP_FIGMA + MAP_EXPLANATION_HEIGHT_FIGMA) / FIGMA_H,
    0.98
  );

  return [
    { x: correctPoint.x - markerHalf, y: correctPoint.y - markerHalf },
    { x: correctPoint.x + markerHalf, y: correctPoint.y + markerHalf },
    { x: correctPoint.x - textHalfX, y: textTopY },
    { x: correctPoint.x + textHalfX, y: textBottomY }
  ];
}

function getMapFitPoints(userPoint, correctPoint) {
  const markerHalf = (MAP_MARKER_PAD_FIGMA / 2) / FIGMA_H;
  const textHalfX = (MAP_EXPLANATION_WIDTH_FIGMA / 2) / FIGMA_H;
  const textTopY = correctPoint.y + MAP_EXPLANATION_GAP_FIGMA / FIGMA_H;
  const textBottomY = Math.min(
    correctPoint.y + (MAP_EXPLANATION_GAP_FIGMA + MAP_EXPLANATION_HEIGHT_FIGMA) / FIGMA_H,
    0.98
  );

  return [
    { x: userPoint.x - markerHalf, y: userPoint.y - markerHalf },
    { x: userPoint.x + markerHalf, y: userPoint.y + markerHalf },
    { x: correctPoint.x - markerHalf, y: correctPoint.y - markerHalf },
    { x: correctPoint.x + markerHalf, y: correctPoint.y + markerHalf },
    { x: correctPoint.x - textHalfX, y: textTopY },
    { x: correctPoint.x + textHalfX, y: textBottomY }
  ];
}

function getMapFitAnchorScreenY(screen) {
  if (!screen) return FIGMA_H * 0.28;
  const screenRect = screen.getBoundingClientRect();
  if (screenRect.height < 1) return FIGMA_H * 0.28;

  const header = screen.querySelector('.figma-question-header, .figma-answer-header');
  if (header) {
    const headerRect = header.getBoundingClientRect();
    const gap = (MAP_HEADER_GAP_FIGMA / FIGMA_H) * screenRect.height;
    return headerRect.bottom - screenRect.top + gap;
  }

  return screenRect.height * 0.28;
}

function getMarkerPadScreen(worldH, mapScale) {
  return (MAP_MARKER_PAD_FIGMA / FIGMA_H) * worldH * mapScale;
}

function setMapHandoff(state) {
  mapHandoff = state;
}

function consumeMapHandoff() {
  const state = mapHandoff;
  mapHandoff = null;
  return state;
}

function retainEuropeMap(controller) {
  if (!controller?.viewport) return;
  retainedMap = controller;
  controller._setRetained(true);
  controller.setInteractive(false);
  if (controller.viewport.parentNode) {
    controller.viewport.remove();
  }
}

function adoptEuropeMap(screen, options = {}) {
  if (!retainedMap) return null;
  const map = retainedMap;
  retainedMap = null;
  map._setRetained(false);
  if (map.world) syncMapSvgAsset(map.world, options.topicId);
  map._attachToScreen(screen);
  return map;
}

function isEuropeMapRetained() {
  return retainedMap !== null;
}

function addMapExplanation(world, anchorNorm, text, getScale) {
  const el = document.createElement('p');
  el.className = 'figma-body-text figma-map-explanation';
  el.textContent = text;
  el.style.left = `${anchorNorm.x * 100}%`;
  el.style.top = `${anchorNorm.y * 100}%`;
  el._mapScaleFn = typeof getScale === 'function' ? getScale : null;
  world.appendChild(el);
  return el;
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function createEuropeMap(screen, options = {}) {
  let hostScreen = screen;
  const viewport = document.createElement('div');
  viewport.className = 'figma-map-viewport';
  viewport.setAttribute('role', 'application');
  viewport.setAttribute('aria-label', 'Karte — bewegen und Punkt platzieren');
  markStageTier(viewport, 'none');
  if (window.stageTransitions) stageTransitions.revealStageElement(viewport);

  const world = document.createElement('div');
  world.className = 'figma-map-world';
  world.innerHTML = createEuropeMapMarkup(options.topicId);
  syncMapSvgAsset(world, options.topicId);
  viewport.appendChild(world);

  let tx = options.viewport?.tx ?? 0;
  let ty = options.viewport?.ty ?? 0;
  let scale = options.viewport?.scale ?? MAP_DEFAULT_SCALE;
  let baseLeft = 0;
  let baseTop = 0;
  let coverW = 1;
  let coverH = 1;

  let userMarker = null;
  let correctMarker = null;
  let dragging = false;
  let dragStart = null;
  let dragViewportStart = null;
  let animFrame = null;
  let pendingDefaultViewport = !options.viewport;
  let retained = false;
  let interactive = options.interactive !== false;

  function getViewportSize() {
    const rect = viewport.getBoundingClientRect();
    return { w: rect.width, h: rect.height };
  }

  function getWorldSize() {
    return { w: coverW, h: coverH };
  }

  function layoutWorld() {
    const { w: vpW, h: vpH } = getViewportSize();
    if (vpW < 1 || vpH < 1) return;

    const vpAspect = vpW / vpH;
    if (vpAspect >= MAP_ASPECT) {
      coverW = vpW;
      coverH = vpW / MAP_ASPECT;
    } else {
      coverH = vpH;
      coverW = vpH * MAP_ASPECT;
    }

    baseLeft = (vpW - coverW) / 2;
    baseTop = (vpH - coverH) / 2;
    world.style.width = `${coverW}px`;
    world.style.height = `${coverH}px`;
    world.style.left = `${baseLeft}px`;
    world.style.top = `${baseTop}px`;
  }

  function clampPan() {
    const { w: vpW, h: vpH } = getViewportSize();
    if (vpW < 1 || vpH < 1 || coverW < 1 || coverH < 1) return;

    const scaledW = coverW * scale;
    const scaledH = coverH * scale;
    const txMin = Math.min(-baseLeft, vpW - baseLeft - scaledW);
    const txMax = Math.max(-baseLeft, vpW - baseLeft - scaledW);
    const tyMin = Math.min(-baseTop, vpH - baseTop - scaledH);
    const tyMax = Math.max(-baseTop, vpH - baseTop - scaledH);

    tx = clamp(tx, txMin, txMax);
    ty = clamp(ty, tyMin, tyMax);
  }

  function getDefaultViewport() {
    const { w: vpW, h: vpH } = getViewportSize();
    const nextScale = MAP_DEFAULT_SCALE;
    return {
      tx: vpW / 2 - baseLeft - nextScale * MAP_FOCUS.x * coverW,
      ty: vpH / 2 - baseTop - nextScale * MAP_FOCUS.y * coverH,
      scale: nextScale
    };
  }

  function syncExplanationTransforms() {
    const gapPx = (MAP_EXPLANATION_GAP_FIGMA * window.innerWidth) / FIGMA_W;
    const inv = 1 / scale;
    for (const el of world.querySelectorAll('.figma-map-explanation')) {
      el.style.transform = `translate(-50%, ${gapPx}px) scale(${inv})`;
    }
  }

  function applyTransform() {
    layoutWorld();
    if (pendingDefaultViewport && coverW > 1 && coverH > 1) {
      const defaults = getDefaultViewport();
      tx = defaults.tx;
      ty = defaults.ty;
      scale = defaults.scale;
      pendingDefaultViewport = false;
    }
    clampPan();
    world.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
    syncExplanationTransforms();
  }

  function attachToScreen(targetScreen) {
    hostScreen = targetScreen;
    targetScreen.classList.add('figma-screen--map');
    const overlay = targetScreen.closest('#quiz-overlay');
    if (overlay) overlay.classList.add('quiz-overlay--map');
    targetScreen.insertBefore(viewport, targetScreen.firstChild);
    applyTransform();
    requestAnimationFrame(() => applyTransform());
  }

  function getViewportState() {
    return { tx, ty, scale };
  }

  function setViewport(state) {
    tx = state.tx ?? tx;
    ty = state.ty ?? ty;
    scale = state.scale ?? scale;
    applyTransform();
  }

  function screenToMapNorm(clientX, clientY) {
    const rect = viewport.getBoundingClientRect();
    const vx = clientX - rect.left;
    const vy = clientY - rect.top;
    const wx = (vx - baseLeft - tx) / scale;
    const wy = (vy - baseTop - ty) / scale;
    return {
      x: clamp(wx / coverW, 0, 1),
      y: clamp(wy / coverH, 0, 1)
    };
  }

  function spawnMarker(norm, colorHex, kind, spawnAnim = true) {
    const region = createParticleRegion(world, 0, 0, MAP_MARKER_SIZE, MAP_MARKER_SIZE, colorHex, {
      parent: world,
      anchorNorm: norm,
      spawnAnimation: spawnAnim,
      skipStageAnim: true,
      motionProfile: 'pinned',
      wanderRadius: 0,
      mapMarkerStyle: kind === 'user' ? 'user' : 'correct'
    });
    if (window.stageTransitions) markStageExempt(region.el);
    region.el.classList.add(
      kind === 'user' ? 'figma-map-marker--user' : 'figma-map-marker--correct'
    );
    region.el.style.zIndex = kind === 'correct' ? '5' : '4';
    return region;
  }

  function clearUserMarker() {
    if (userMarker) {
      userMarker.cleanup();
      userMarker = null;
    }
  }

  function clearCorrectMarker() {
    if (correctMarker) {
      correctMarker.cleanup();
      correctMarker = null;
    }
  }

  function setUserPoint(norm, colorHex, options = {}) {
    clearUserMarker();
    if (!norm) return null;
    userMarker = spawnMarker(norm, colorHex, 'user', options.spawnAnimation !== false);
    return userMarker;
  }

  function setCorrectPoint(norm, colorHex, options = {}) {
    clearCorrectMarker();
    if (!norm) return null;
    correctMarker = spawnMarker(norm, colorHex, 'correct', options.spawnAnimation !== false);
    return correctMarker;
  }

  function hasMarkers() {
    return userMarker !== null || correctMarker !== null;
  }

  function checkPlacementCorrect(userNorm) {
    if (!userNorm || !userMarker?.el) return false;

    const correct = getCorrectMapPoint();
    const hadCorrect = correctMarker !== null;
    if (!hadCorrect) {
      setCorrectPoint(correct, getActiveQuizColors().correct, { spawnAnimation: false });
    }

    applyTransformForMeasure();
    const touches = particleCirclesTouch(userMarker.el, correctMarker?.el);

    if (!hadCorrect) {
      clearCorrectMarker();
    }

    return touches;
  }

  function computeFitTransform(points, padding = 0.08, fitOptions = {}) {
    const { w: vpW, h: vpH } = getViewportSize();
    const { w: worldW, h: worldH } = getWorldSize();
    if (!points.length || vpW < 1 || vpH < 1) {
      return { tx, ty, scale };
    }

    let minX = Math.min(...points.map((p) => p.x));
    let maxX = Math.max(...points.map((p) => p.x));
    let minY = Math.min(...points.map((p) => p.y));
    let maxY = Math.max(...points.map((p) => p.y));

    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    if (maxX - minX < MAP_FIT_MIN_SPREAD) {
      minX = cx - MAP_FIT_MIN_SPREAD / 2;
      maxX = cx + MAP_FIT_MIN_SPREAD / 2;
    }
    if (maxY - minY < MAP_FIT_MIN_SPREAD) {
      minY = cy - MAP_FIT_MIN_SPREAD / 2;
      maxY = cy + MAP_FIT_MIN_SPREAD / 2;
    }

    const padPx = padding * Math.min(vpW, vpH);
    const bw = Math.max(1, (maxX - minX) * worldW);
    const bh = Math.max(1, (maxY - minY) * worldH);
    const baseAnchorY = getMapFitAnchorScreenY(fitOptions.screen ?? hostScreen);
    const bottomPad = padPx;
    const markerPadEstimate = getMarkerPadScreen(worldH, MAP_DEFAULT_SCALE);

    let availableH = Math.max(1, vpH - baseAnchorY - bottomPad - markerPadEstimate);
    let nextScale = clamp(
      Math.min((vpW - padPx * 2) / bw, availableH / bh),
      MAP_FIT_MIN_SCALE,
      MAP_MAX_SCALE
    );

    let anchorScreenY = baseAnchorY + getMarkerPadScreen(worldH, nextScale);
    availableH = Math.max(1, vpH - anchorScreenY - bottomPad);
    nextScale = clamp(
      Math.min((vpW - padPx * 2) / bw, availableH / bh),
      MAP_FIT_MIN_SCALE,
      MAP_MAX_SCALE
    );
    anchorScreenY = baseAnchorY + getMarkerPadScreen(worldH, nextScale);

    const nextTx = vpW / 2 - baseLeft - nextScale * ((minX + maxX) / 2) * worldW;
    const nextTy = anchorScreenY - baseTop - nextScale * minY * worldH;

    const saved = { tx, ty, scale };
    tx = nextTx;
    ty = nextTy;
    scale = nextScale;
    clampPan();
    const result = { tx, ty, scale };
    tx = saved.tx;
    ty = saved.ty;
    scale = saved.scale;
    return result;
  }

  function computeCenterTransform(point, padding = 0.14) {
    const { w: vpW, h: vpH } = getViewportSize();
    const { w: worldW, h: worldH } = getWorldSize();
    if (vpW < 1 || vpH < 1) {
      return { tx, ty, scale };
    }

    const padPx = padding * Math.min(vpW, vpH);
    const markerWorldW = (MAP_MARKER_PAD_FIGMA / FIGMA_W) * worldW * 2;
    const markerWorldH = (MAP_MARKER_PAD_FIGMA / FIGMA_H) * worldH * 2;
    const nextScale = clamp(
      Math.min(
        (vpW - padPx * 2) / Math.max(1, markerWorldW),
        (vpH - padPx * 2) / Math.max(1, markerWorldH)
      ),
      MAP_FIT_MIN_SCALE,
      MAP_MAX_SCALE
    );

    const centerX = vpW / 2;
    const centerY = vpH / 2;
    const nextTx = centerX - baseLeft - nextScale * point.x * worldW;
    const nextTy = centerY - baseTop - nextScale * point.y * worldH;

    const saved = { tx, ty, scale };
    tx = nextTx;
    ty = nextTy;
    scale = nextScale;
    clampPan();
    const result = { tx, ty, scale };
    tx = saved.tx;
    ty = saved.ty;
    scale = saved.scale;
    return result;
  }

  function resolveCenterTarget(point, padding = 0.14) {
    const saved = { tx, ty, scale };
    layoutWorld();
    const target = computeCenterTransform(point, padding);
    tx = target.tx;
    ty = target.ty;
    scale = target.scale;
    applyTransformForMeasure();
    const result = { tx, ty, scale };
    tx = saved.tx;
    ty = saved.ty;
    scale = saved.scale;
    return result;
  }

  function animateToFitCenter(point, padding = 0.14, durationMs = 950) {
    const start = { tx, ty, scale };
    const target = resolveCenterTarget(point, padding);
    const startTime = performance.now();

    if (animFrame) cancelAnimationFrame(animFrame);

    return new Promise((resolve) => {
      function tick(now) {
        const t = clamp((now - startTime) / durationMs, 0, 1);
        const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        tx = start.tx + (target.tx - start.tx) * eased;
        ty = start.ty + (target.ty - start.ty) * eased;
        scale = start.scale + (target.scale - start.scale) * eased;
        applyTransform();

        if (t < 1) {
          animFrame = requestAnimationFrame(tick);
        } else {
          animFrame = null;
          tx = target.tx;
          ty = target.ty;
          scale = target.scale;
          applyTransform();
          resolve(getViewportState());
        }
      }
      animFrame = requestAnimationFrame(tick);
    });
  }

  function applyTransformForMeasure() {
    layoutWorld();
    world.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
    syncExplanationTransforms();
  }

  function measureContentInViewport() {
    const vpRect = viewport.getBoundingClientRect();
    if (vpRect.width < 1 || vpRect.height < 1) return null;

    let left = Infinity;
    let top = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;
    let count = 0;

    for (const el of world.querySelectorAll('.figma-particle-region, .figma-map-explanation')) {
      const r = el.getBoundingClientRect();
      left = Math.min(left, r.left - vpRect.left);
      top = Math.min(top, r.top - vpRect.top);
      right = Math.max(right, r.right - vpRect.left);
      bottom = Math.max(bottom, r.bottom - vpRect.top);
      count += 1;
    }

    if (!count || !isFinite(left)) return null;
    return { left, top, right, bottom };
  }

  function resolveFitTarget(points, padding = 0.08, fitOptions = {}) {
    const saved = { tx, ty, scale };
    const initial = computeFitTransform(points, padding, fitOptions);
    tx = initial.tx;
    ty = initial.ty;
    scale = initial.scale;

    applyTransformForMeasure();
    const fitScreen = fitOptions.screen ?? hostScreen;
    const { w: vpW, h: vpH } = getViewportSize();
    const padPx = padding * Math.min(vpW, vpH);

    let bounds = measureContentInViewport();
    if (bounds && vpW > 0 && vpH > 0) {
      const frameTop = getMapFitAnchorScreenY(fitScreen) - getMarkerPadScreen(coverH, scale);
      const frame = {
        left: padPx,
        top: Math.max(padPx, frameTop),
        right: vpW - padPx,
        bottom: vpH - padPx
      };

      const bW = bounds.right - bounds.left;
      const bH = bounds.bottom - bounds.top;
      const fW = frame.right - frame.left;
      const fH = frame.bottom - frame.top;

      if (bW > fW || bH > fH) {
        const scaleMul = Math.min(fW / bW, fH / bH, 1);
        if (scaleMul < 0.999) {
          scale = Math.max(MAP_FIT_MIN_SCALE, scale * scaleMul);
          applyTransformForMeasure();
          bounds = measureContentInViewport();
        }
      }

      if (bounds) {
        let dx = 0;
        let dy = 0;
        if (bounds.left < frame.left) dx = frame.left - bounds.left;
        else if (bounds.right > frame.right) dx = frame.right - bounds.right;
        if (bounds.top < frame.top) dy = frame.top - bounds.top;
        else if (bounds.bottom > frame.bottom) dy = frame.bottom - bounds.bottom;
        tx += dx;
        ty += dy;
        clampPan();
      }
    }

    const result = { tx, ty, scale };
    tx = saved.tx;
    ty = saved.ty;
    scale = saved.scale;
    return result;
  }

  function fitToContent(points, padding = 0.08, fitOptions = {}) {
    const target = resolveFitTarget(points, padding, fitOptions);
    tx = target.tx;
    ty = target.ty;
    scale = target.scale;
    applyTransform();
    return target;
  }

  function animateToFit(points, padding = 0.08, durationMs = 950, fitOptions = {}) {
    const start = { tx, ty, scale };
    const target = resolveFitTarget(points, padding, fitOptions);
    const startTime = performance.now();

    if (animFrame) cancelAnimationFrame(animFrame);

    return new Promise((resolve) => {
      function tick(now) {
        const t = clamp((now - startTime) / durationMs, 0, 1);
        const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        tx = start.tx + (target.tx - start.tx) * eased;
        ty = start.ty + (target.ty - start.ty) * eased;
        scale = start.scale + (target.scale - start.scale) * eased;
        applyTransform();

        if (t < 1) {
          animFrame = requestAnimationFrame(tick);
        } else {
          animFrame = null;
          tx = target.tx;
          ty = target.ty;
          scale = target.scale;
          applyTransform();
          resolve(getViewportState());
        }
      }
      animFrame = requestAnimationFrame(tick);
    });
  }

  function setInteractive(enabled) {
    interactive = enabled;
    viewport.style.pointerEvents = enabled ? '' : 'none';
    viewport.style.cursor = enabled ? 'grab' : 'default';
    if (!enabled && dragging) {
      dragging = false;
      viewport.classList.remove('figma-map-viewport--dragging');
    }
  }

  function onPointerDown(e) {
    if (!interactive || e.button !== 0) return;
    dragging = true;
    dragStart = { x: e.clientX, y: e.clientY };
    dragViewportStart = { tx, ty };
    viewport.classList.add('figma-map-viewport--dragging');
    viewport.setPointerCapture(e.pointerId);
    e.preventDefault();
  }

  function onPointerMove(e) {
    if (!dragging) return;
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    tx = dragViewportStart.tx + dx;
    ty = dragViewportStart.ty + dy;
    applyTransform();
  }

  function onPointerUp(e) {
    if (!dragging) return;
    dragging = false;
    viewport.classList.remove('figma-map-viewport--dragging');
    try { viewport.releasePointerCapture(e.pointerId); } catch { /* ignore */ }

    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    const dist = Math.hypot(dx, dy);

    if (dist < MAP_DRAG_THRESHOLD_PX && options.onPlace) {
      const norm = screenToMapNorm(e.clientX, e.clientY);
      options.onPlace(norm);
    }
  }

  viewport.addEventListener('pointerdown', onPointerDown);
  viewport.addEventListener('pointermove', onPointerMove);
  viewport.addEventListener('pointerup', onPointerUp);
  viewport.addEventListener('pointercancel', onPointerUp);

  const resizeObserver = typeof ResizeObserver !== 'undefined'
    ? new ResizeObserver(() => applyTransform())
    : null;
  if (resizeObserver) resizeObserver.observe(viewport);
  else window.addEventListener('resize', applyTransform);

  attachToScreen(screen);

  function addExplanation(anchorNorm, text) {
    const el = addMapExplanation(world, anchorNorm, text, () => scale);
    markStageTier(el, 'none');
    if (window.stageTransitions) markStageExempt(el);
    syncExplanationTransforms();
    return el;
  }

  function destroy() {
    if (retained) return;
    if (animFrame) cancelAnimationFrame(animFrame);
    if (resizeObserver) resizeObserver.disconnect();
    else window.removeEventListener('resize', applyTransform);
    clearUserMarker();
    clearCorrectMarker();
    viewport.removeEventListener('pointerdown', onPointerDown);
    viewport.removeEventListener('pointermove', onPointerMove);
    viewport.removeEventListener('pointerup', onPointerUp);
    viewport.removeEventListener('pointercancel', onPointerUp);
    if (hostScreen) hostScreen.classList.remove('figma-screen--map');
    const overlay = hostScreen?.closest('#quiz-overlay');
    if (overlay) overlay.classList.remove('quiz-overlay--map');
    viewport.remove();
  }

  const controller = {
    viewport,
    world,
    getViewport: getViewportState,
    setViewport,
    setInteractive,
    screenToMapNorm,
    setUserPoint,
    setCorrectPoint,
    clearUserMarker,
    hasMarkers,
    checkPlacementCorrect,
    addExplanation,
    computeFitTransform,
    fitToContent,
    animateToFit,
    animateToFitCenter,
    applyTransform,
    _attachToScreen: attachToScreen,
    _setRetained(value) { retained = value; },
    destroy
  };

  return controller;
}

window.europeMap = {
  MAP_Y,
  MAP_H,
  MAP_MARKER_SIZE,
  MAP_DEFAULT_SCALE,
  MAP_TRANSITION_EASE,
  getCorrectMapPoint,
  getCorrectMapImagePoint,
  isMapAnswerCorrect,
  getMapTouchTolerance,
  getExplanationFitPoint,
  getMapFitPoints,
  getCorrectOnlyFitPoints,
  getMapFitAnchorScreenY,
  createEuropeMap,
  addMapExplanation,
  retainEuropeMap,
  adoptEuropeMap,
  isEuropeMapRetained,
  setMapHandoff,
  consumeMapHandoff
};

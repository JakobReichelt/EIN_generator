// Main application entries

function preload() {
  activeMapImagePath = CONFIG.map.imagePath;
  const paths = Array.isArray(CONFIG.map.imagePaths) && CONFIG.map.imagePaths.length ? CONFIG.map.imagePaths : [CONFIG.map.imagePath];
  for (const path of paths) {
    const img = loadImage(path, (img) => {
      mapImageRegistry.set(path, { img, ok: true });
      if (path === activeMapImagePath) mapImg = img;
    }, () => {
      mapImageRegistry.set(path, { img: null, ok: false });
      if (path === activeMapImagePath) mapImg = null;
    });
    mapImageRegistry.set(path, { img, ok: true });
    if (path === activeMapImagePath) mapImg = img;
  }
}

function initTrailLayer() {
  if (trailLayer && typeof trailLayer.remove === 'function') {
    try { trailLayer.remove(); } catch { /* ignore */ }
  }
  trailLayer = createGraphics(width, height);
  trailLayer.pixelDensity(1);
  trailLayer.colorMode(HSB, 360, 100, 100, 100);
}

function getTrailDrawSurface() {
  if (typeof isTransparentBackgroundEnabled === 'function' && isTransparentBackgroundEnabled()) return null;
  return trailLayer || null;
}

function setup() {
  pixelDensity(1);
  mainCanvas = createCanvas(CONFIG.output.width, CONFIG.output.height);
  mainCanvas.style('background', 'transparent');
  colorMode(HSB, 360, 100, 100, 100);
  fitMainCanvasToWindow();
  initTrailLayer();
  initCamera();
  resetSketch();
  initColorTool();
  initTimelineUI();
  initUserColorUI();
  initUserStageUI();
  initModeToggle();
  setUiMode(loadUiMode() || 'dev');
  initWheelZoom();
}

function initWheelZoom() {
  const el = mainCanvas?.elt;
  if (!el || el.dataset.wheelZoom === '1') return;
  el.dataset.wheelZoom = '1';
  el.addEventListener('wheel', (e) => {
    if (typeof isEditingTextInput === 'function' && isEditingTextInput()) return;
    if (!camera) return;
    const delta = e.deltaY;
    if (!delta) return;
    e.preventDefault();
    setCameraZoom(camera.zoom - delta * 0.003);
    if (typeof noteManualZoomChange === 'function') noteManualZoomChange();
  }, { passive: false });
}

function initCamera() {
  camera = { center: createVector(width * 0.5, height * 0.5), zoom: 1, minZoom: 1, maxZoom: 40 };
}

function fitMainCanvasToWindow() {
  if (!mainCanvas?.style) return;
  const scale = Math.min(windowWidth / width, windowHeight / height);
  mainCanvas.style('width', `${Math.max(1, Math.floor(width * scale))}px`);
  mainCanvas.style('height', `${Math.max(1, Math.floor(height * scale))}px`);
}

function resetSketch() {
  seed = (seed + 104729) % 2147483647;
  randomSeed(seed); noiseSeed(seed);

  if (isTransparentBackgroundEnabled()) {
    hardClearMainCanvas();
  } else {
    if (trailLayer) trailLayer.clear();
    hardClearMainCanvas();
  }

  mapLines = buildEuropePoliticalLines(width, height, CONFIG.map.margin);

  if (mapImg) {
    const result = extractSpawnPointsFromMapImage(mapImg, width, height, CONFIG.map);
    spawnPoints = result.points;
    mapPlacement = result.placement;
    attractor = result.attractor;
  } else {
    spawnPoints = samplePolylines(mapLines, CONFIG.map.samplesPerSegment);
    mapPlacement = null;
    attractor = null;
  }

  const targetCount = getAdaptiveParticleCount();
  particles = Array.from({ length: targetCount }, () => new Particle(spawnPoints));

  if (camera) { camera.center.set(width * 0.5, height * 0.5); camera.zoom = 1; }
}

function draw() {
  if (typeof interactionEnabled !== 'undefined' && interactionEnabled) {
    pruneInteractionImpulses(millis());
  }

  noStroke();
  const fadeA = getTrailFadeAlpha();
  const fade01 = constrain((+fadeA || 0) / 100, 0, 1);
  const transparent = isTransparentBackgroundEnabled();

  if (transparent) {
    const ctx2d = drawingContext;
    const cw = ctx2d?.canvas?.width ?? width;
    const ch = ctx2d?.canvas?.height ?? height;
    applyTrailFadeCanvas2D(ctx2d, cw, ch, fade01, null);
    const cull = typeof getTrailLowAlphaCull === 'function' ? getTrailLowAlphaCull() : (CONFIG?.trailLowAlphaCull ?? 48);
    if (cull > 0) snapTrailLowAlphaToTransparent(ctx2d, cw, ch, cull);
  } else if (trailLayer) {
    const tctx = trailLayer.drawingContext;
    applyTrailFadeCanvas2D(tctx, trailLayer.width, trailLayer.height, fade01, null);
    const cull = typeof getTrailLowAlphaCull === 'function' ? getTrailLowAlphaCull() : (CONFIG?.trailLowAlphaCull ?? 48);
    if (cull > 0) snapTrailLowAlphaToTransparent(tctx, trailLayer.width, trailLayer.height, cull);
  }

  syncParticleCountToSize();
  for (let p of particles) p.step();
  applyParticleSeparation(particles);

  const view = getCameraWorldBounds();
  const drawParticles = getParticlesInZOrder();

  if (transparent) {
    push();
    applyCameraTransform();
    for (let p of drawParticles) if (segmentIntersectsBounds(p.prev, p.pos, view)) p.draw();
    if (showMapOverlay) drawMapOverlay(mapLines);
    pop();
  } else {
    const bg = colorTool?.backgroundHSB ?? { h: 0, s: 0, b: 100 };
    if (trailLayer) {
      trailLayer.push();
      trailLayer.colorMode(HSB, 360, 100, 100, 100);
      applyCameraTransform(trailLayer);
      for (let p of drawParticles) if (segmentIntersectsBounds(p.prev, p.pos, view)) p.draw();
      if (showMapOverlay) drawMapOverlay(mapLines, trailLayer);
      trailLayer.pop();
    }

    fill(bg.h, bg.s, bg.b);
    rect(0, 0, width, height);
    if (trailLayer) image(trailLayer, 0, 0);
  }
}

function getParticlesInZOrder() {
  if (!Array.isArray(particles) || particles.length <= 1) return particles;
  const ordered = particles.slice();
  ordered.sort((a, b) => (a?.zLayer ?? 0) - (b?.zLayer ?? 0));
  return ordered;
}

function windowResized() {
  fitMainCanvasToWindow();
}

function mousePressed() {
  try {
    if (typeof interactionEnabled === 'undefined' || !interactionEnabled) return;
    if (typeof isPointerOverUI === 'function' && isPointerOverUI()) return;
    if (typeof mouseButton !== 'undefined' && mouseButton !== LEFT) return;

    const w = (typeof screenToWorld === 'function') ? screenToWorld(mouseX, mouseY) : createVector(mouseX, mouseY);
    const now = millis();
    if (!Array.isArray(interactionImpulses)) interactionImpulses = [];
    interactionImpulses.push({ x: w.x, y: w.y, startMs: now });

    const maxImpulses = Math.max(1, (CONFIG?.interaction?.maxImpulses ?? 10) | 0);
    if (interactionImpulses.length > maxImpulses) interactionImpulses.splice(0, interactionImpulses.length - maxImpulses);
  } catch { /* ignore */ }
}

function pruneInteractionImpulses(nowMs) {
  try {
    if (!Array.isArray(interactionImpulses) || interactionImpulses.length === 0) return;
    const dur = Math.max(1, (CONFIG?.interaction?.durationMs ?? 2000) | 0);
    let write = 0;
    for (let i = 0; i < interactionImpulses.length; i++) {
      const imp = interactionImpulses[i];
      if (!imp) continue;
      const age = nowMs - (+imp.startMs || 0);
      if (age >= 0 && age < dur) interactionImpulses[write++] = imp;
    }
    interactionImpulses.length = write;
  } catch { /* ignore */ }
}

function keyPressed() {
  if (typeof isUserUiMode === 'function' && isUserUiMode() && !isEditingTextInput()) {
    if (keyCode === LEFT_ARROW) { moveCamera(-1, 0); return false; }
    if (keyCode === RIGHT_ARROW) { moveCamera(1, 0); return false; }
    if (keyCode === UP_ARROW) { moveCamera(0, -1); return false; }
    if (keyCode === DOWN_ARROW) { moveCamera(0, 1); return false; }
  }

  if (key === ' ') { const sep = CONFIG.particles?.separation; if (sep) sep.enabled = !sep.enabled; }
  else if (key === 'r' || key === 'R') resetSketch();
  else if (key === 's' || key === 'S') {
    const now = new Date();
    const dateStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
    const timeStr = String(now.getHours()).padStart(2, '0') + '-' + String(now.getMinutes()).padStart(2, '0') + '-' + String(now.getSeconds()).padStart(2, '0');
    saveCanvas('europe-flowfield_' + dateStr + '_' + timeStr, 'png');
  }
}

let trailCullFrame = 0;

function maybeCullTrailAlpha(ctx, cw, ch, cull) {
  if (!ctx || cull <= 0) return;
  const interval = Math.max(1, CONFIG.visualizer.trailCullInterval ?? 3);
  trailCullFrame = (trailCullFrame + 1) % interval;
  if (trailCullFrame !== 0) return;
  snapTrailLowAlphaToTransparent(ctx, cw, ch, cull);
}

function setup() {
  pixelDensity(1);
  mainCanvas = createCanvas(CONFIG.output.width, CONFIG.output.height);
  mainCanvas.style('background', 'transparent');
  mainCanvas.style('z-index', '0');
  mainCanvas.style('position', 'relative');
  colorMode(HSB, 360, 100, 100, 100);
  fitMainCanvasToWindow();
  initTrailLayer();
  initCamera();
  initColorTool();
  initVisualizerTrailDefaults();
  initTimelineUI();
  initVisualizerUI();
  initUserColorUI();
  initUserStageUI();
  wireUserControlsPointerIsolation();
  bringOverlayPanelsToFront();
  initWheelZoom();
  initCanvasResizeHandling();
  const timelineRoot = document.getElementById('timeline-root');
  if (timelineRoot) timelineRoot.style.display = 'none';
  const devRoot = document.getElementById('ui-root');
  if (devRoot) devRoot.style.display = 'none';
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

function initCamera() {
  camera = { center: createVector(width * 0.5, height * 0.5), zoom: 1, minZoom: 0.5, maxZoom: 8 };
}

function getOutputDimensions() {
  return {
    w: CONFIG.output.width | 0,
    h: CONFIG.output.height | 0
  };
}

/** Keep the drawing buffer at the fixed output size (browsers can corrupt it on DPI / monitor changes). */
function ensureCanvasDimensions() {
  const { w, h } = getOutputDimensions();
  if (!w || !h) return false;
  const el = mainCanvas?.elt;
  const bufferW = el?.width ?? width;
  const bufferH = el?.height ?? height;
  if (width === w && height === h && bufferW === w && bufferH === h) return false;
  const oldW = Math.max(1, width || bufferW || w);
  const oldH = Math.max(1, height || bufferH || h);
  resizeCanvas(w, h);
  pixelDensity(1);
  if (camera?.center) {
    camera.center.set(
      (camera.center.x / oldW) * w,
      (camera.center.y / oldH) * h
    );
  }
  initTrailLayer();
  return true;
}

function fitMainCanvasToWindow() {
  if (!mainCanvas?.style) return;
  const vw = window.innerWidth || windowWidth || width;
  const vh = window.innerHeight || windowHeight || height;
  if (!vw || !vh) return;
  const scale = Math.min(vw / width, vh / height);
  mainCanvas.style('width', `${Math.max(1, Math.floor(width * scale))}px`);
  mainCanvas.style('height', `${Math.max(1, Math.floor(height * scale))}px`);
}

function initCanvasResizeHandling() {
  let pending = false;
  const schedule = () => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      handleWindowResize();
    });
  };
  window.addEventListener('resize', schedule);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', schedule);
}

function handleWindowResize() {
  ensureCanvasDimensions();
  fitMainCanvasToWindow();
  if (typeof redraw === 'function') redraw();
}

function initWheelZoom() {
  const el = mainCanvas?.elt;
  if (!el || el.dataset.wheelZoom === '1') return;
  el.dataset.wheelZoom = '1';
  el.addEventListener('wheel', (e) => {
    if (isPointerOverUI()) return;
    if (!camera) return;
    const delta = e.deltaY;
    if (!delta) return;
    e.preventDefault();
    camera.zoom = constrain(camera.zoom - delta * 0.003, camera.minZoom, camera.maxZoom);
  }, { passive: false });
}

function handleRadiusWorld() {
  return 10 / (camera?.zoom ?? 1);
}

function draw() {
  const nowMs = millis();
  if (vizMode === 'play') {
    drawPlayMode(nowMs);
  } else {
    drawEditMode();
  }
}

function worldToScreen(wx, wy) {
  const z = camera?.zoom ?? 1;
  const cx = camera?.center?.x ?? width * 0.5;
  const cy = camera?.center?.y ?? height * 0.5;
  return {
    x: (wx - cx) * z + width * 0.5,
    y: (wy - cy) * z + height * 0.5
  };
}

function drawEditBackgroundGrid() {
  const cfg = CONFIG.visualizer?.editBackgroundGrid;
  if (!cfg) return;
  const cols = Math.max(1, cfg.cols | 0);
  const rows = Math.max(1, cfg.rows | 0);
  const cellW = width / cols;
  const cellH = height / rows;
  const alpha = cfg.strokeAlpha ?? 38;
  const sw = cfg.strokeWeight ?? 0.75;
  stroke(0, 0, 0, alpha);
  strokeWeight(sw);
  noFill();
  for (let c = 0; c <= cols; c++) {
    const wx = c * cellW;
    const a = worldToScreen(wx, 0);
    const b = worldToScreen(wx, height);
    line(a.x, a.y, b.x, b.y);
  }
  for (let r = 0; r <= rows; r++) {
    const wy = r * cellH;
    const a = worldToScreen(0, wy);
    const b = worldToScreen(width, wy);
    line(a.x, a.y, b.x, b.y);
  }
}

function paintEditBackground() {
  const { w, h } = getOutputDimensions();
  const cw = drawingContext?.canvas?.width ?? width ?? w;
  const ch = drawingContext?.canvas?.height ?? height ?? h;
  const ctx = drawingContext;
  if (ctx) {
    const rgb = typeof hsbToRgb === 'function' ? hsbToRgb(0, 0, 100) : { r: 255, g: 255, b: 255 };
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
    ctx.fillRect(0, 0, cw, ch);
    ctx.restore();
    return;
  }
  background(0, 0, 100);
}

function drawEditMode() {
  paintEditBackground();
  drawEditBackgroundGrid();
  push();
  applyCameraTransform();
  const sit = activeSituation;
  for (const cluster of clusters) {
    drawClusterOutline(cluster, sit);
    drawClusterGrid(cluster, sit);
  }
  if (editDrag?.mode === 'create') {
    const g = geomFromDrag(editDrag.ax, editDrag.ay, editDrag.bx, editDrag.by);
    noFill();
    stroke(0, 0, 0, 120);
    strokeWeight(1.5 / (camera?.zoom ?? 1));
    if (shapeTool === 'circle') {
      ellipse(g.x + g.w * 0.5, g.y + g.h * 0.5, g.w, g.h);
    } else {
      rect(g.x, g.y, g.w, g.h);
    }
  }
  if (activeDrawPath?.points?.length) {
    const pts = activeDrawPath.points;
    const w = screenToWorld(mouseX, mouseY);
    noFill();
    stroke(0, 0, 0, polygonRedrawTarget ? 180 : 140);
    strokeWeight(2 / (camera?.zoom ?? 1));
    drawPolygonPath(pts, false);
    line(pts[pts.length - 1].x, pts[pts.length - 1].y, w.x, w.y);
    const snap = getDrawCloseSnapWorld();
    noStroke();
    fill(0, 0, 0, 80);
    circle(pts[0].x, pts[0].y, snap * 2);
  } else if (polygonRedrawTarget) {
    const c = getClusterById(polygonRedrawTarget.clusterId);
    if (c) {
      noFill();
      stroke(0, 0, 0, 45);
      strokeWeight(1.5 / (camera?.zoom ?? 1));
      drawClusterOutline(c, polygonRedrawTarget.sitIndex, { alpha: 45 });
    }
  }
  pop();
}

function drawPlayMode(nowMs) {
  if (attractorDirty) rebuildAttractorFields();
  updateSituationTransition(nowMs);
  const blendT = getSituationBlendT();
  const transitioning = situationTransition.active;

  if (interactionEnabled) pruneInteractionImpulses(nowMs);

  const fade01 = constrain(getTrailFadeAlpha() / 100, 0, 1);
  const transparent = typeof isTransparentBackgroundEnabled === 'function' && isTransparentBackgroundEnabled();
  const cull = typeof getTrailLowAlphaCull === 'function'
    ? getTrailLowAlphaCull()
    : (CONFIG.trailLowAlphaCull ?? 15);

  if (transparent) {
    const ctx2d = drawingContext;
    const cw = ctx2d?.canvas?.width ?? width;
    const ch = ctx2d?.canvas?.height ?? height;
    applyTrailFadeCanvas2D(ctx2d, cw, ch, fade01, null);
    maybeCullTrailAlpha(ctx2d, cw, ch, cull);
  } else if (trailLayer) {
    const tctx = trailLayer.drawingContext;
    applyTrailFadeCanvas2D(tctx, trailLayer.width, trailLayer.height, fade01, null);
    maybeCullTrailAlpha(tctx, trailLayer.width, trailLayer.height, cull);
  }

  const stepCtx = buildPlayStepContext(blendT, transitioning, nowMs);
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    if (getPlayParticleVisibility(p, blendT) <= 0.001) continue;
    p.step(stepCtx);
  }
  applyParticleSeparation(particles, blendT);

  const bg = colorTool.backgroundHSB;
  const view = getCameraWorldBounds();
  const drawCtx = buildPlayDrawContext();

  if (transparent) {
    push();
    applyCameraTransform();
    strokeWeight(drawCtx.sw);
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      const vis = getPlayParticleVisibility(p, blendT);
      if (vis <= 0.001) continue;
      if (segmentIntersectsBounds(p.prev, p.pos, view)) p.draw(drawCtx, null, vis);
    }
    pop();
    return;
  }

  if (trailLayer) {
    trailLayer.push();
    trailLayer.colorMode(HSB, 360, 100, 100, 100);
    applyCameraTransform(trailLayer);
    trailLayer.strokeWeight(drawCtx.sw);
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      const vis = getPlayParticleVisibility(p, blendT);
      if (vis <= 0.001) continue;
      if (segmentIntersectsBounds(p.prev, p.pos, view)) p.draw(drawCtx, trailLayer, vis);
    }
    trailLayer.pop();
  }

  fill(bg.h, bg.s, bg.b);
  rect(0, 0, width, height);
  if (trailLayer) image(trailLayer, 0, 0);
}

function windowResized() {
  handleWindowResize();
}

function mousePressed() {
  if (typeof shouldBlockCanvasForTextInput === 'function' && shouldBlockCanvasForTextInput()) return false;
  if (typeof blurVizTextInputs === 'function') blurVizTextInputs();
  if (isPointerOverUI()) return false;
  if (mouseButton !== LEFT) return;

  const w = screenToWorld(mouseX, mouseY);

  if (vizMode === 'play') {
    if (!interactionEnabled) return;
    interactionImpulses.push({ x: w.x, y: w.y, startMs: millis() });
    const maxImpulses = Math.max(1, CONFIG.interaction.maxImpulses | 0);
    if (interactionImpulses.length > maxImpulses) {
      interactionImpulses.splice(0, interactionImpulses.length - maxImpulses);
    }
    return false;
  }

  const sit = activeSituation;
  const hr = handleRadiusWorld();

  if (polygonRedrawTarget) {
    activeDrawPath = { points: [{ x: w.x, y: w.y }] };
    return false;
  }

  for (let i = clusters.length - 1; i >= 0; i--) {
    const c = clusters[i];
    const corner = hitTestHandle(c, sit, w.x, w.y, hr);
    if (corner) {
      selectedClusterId = c.id;
      const g = { ...getClusterGeom(c, sit) };
      editDrag = {
        mode: 'resize',
        clusterId: c.id,
        corner,
        startGeom: g,
        startWx: w.x,
        startWy: w.y
      };
      if (c.type === 'polygon') {
        editDrag.startPoints = getPolygonPoints(c, sit).map((p) => ({ x: p.x, y: p.y }));
      }
      refreshVisualizerUI();
      return false;
    }
  }

  const hit = hitTestCluster(w.x, w.y, sit);
  if (hit) {
    selectedClusterId = hit.id;
    if (hit.type === 'polygon') {
      const pts = getPolygonPoints(hit, sit);
      const b = polygonBBox(pts);
      editDrag = {
        mode: 'move',
        clusterId: hit.id,
        startPoints: pts.map((p) => ({ x: p.x, y: p.y })),
        startWx: w.x,
        startWy: w.y
      };
    } else {
      const g = getClusterGeom(hit, sit);
      editDrag = {
        mode: 'move',
        clusterId: hit.id,
        offsetX: w.x - g.x,
        offsetY: w.y - g.y
      };
    }
    refreshVisualizerUI();
    return false;
  }

  selectedClusterId = null;
  refreshVisualizerUI();

  if (shapeTool === 'draw') {
    activeDrawPath = { points: [{ x: w.x, y: w.y }] };
    return false;
  }

  editDrag = {
    mode: 'create',
    ax: w.x,
    ay: w.y,
    bx: w.x,
    by: w.y
  };
  return false;
}

function mouseDragged() {
  if (typeof shouldBlockCanvasForTextInput === 'function' && shouldBlockCanvasForTextInput()) return false;
  if (vizMode !== 'edit') return;

  if (activeDrawPath) {
    const w = screenToWorld(mouseX, mouseY);
    const closed = appendDrawPathPoint(activeDrawPath, w.x, w.y);
    if (closed) finishDrawPath(closed);
    return false;
  }

  if (!editDrag) return;
  const w = screenToWorld(mouseX, mouseY);

  if (editDrag.mode === 'create') {
    editDrag.bx = w.x;
    editDrag.by = w.y;
    return false;
  }

  const cluster = getClusterById(editDrag.clusterId);
  if (!cluster) return false;
  const sit = activeSituation;

  if (editDrag.mode === 'move') {
    const cluster = getClusterById(editDrag.clusterId);
    if (!cluster) return false;
    if (cluster.type === 'polygon' && editDrag.startPoints) {
      const dx = w.x - editDrag.startWx;
      const dy = w.y - editDrag.startWy;
      setPolygonPoints(cluster, sit, editDrag.startPoints.map((p) => ({
        x: p.x + dx,
        y: p.y + dy
      })));
    } else {
      const g = getClusterGeom(cluster, sit);
      setClusterGeom(cluster, sit, {
        x: w.x - editDrag.offsetX,
        y: w.y - editDrag.offsetY,
        w: g.w,
        h: g.h
      });
    }
    return false;
  }

  if (editDrag.mode === 'resize') {
    const cluster = getClusterById(editDrag.clusterId);
    if (!cluster) return false;
    const sg = editDrag.startGeom;
    let x = sg.x;
    let y = sg.y;
    let x2 = sg.x + sg.w;
    let y2 = sg.y + sg.h;
    const corner = editDrag.corner;
    if (corner === 'nw' || corner === 'sw') x = w.x;
    if (corner === 'ne' || corner === 'se') x2 = w.x;
    if (corner === 'nw' || corner === 'ne') y = w.y;
    if (corner === 'sw' || corner === 'se') y2 = w.y;
    const newGeom = geomFromDrag(x, y, x2, y2);
    if (cluster.type === 'polygon' && editDrag.startPoints) {
      setPolygonPoints(cluster, sit, scalePolygonPoints(editDrag.startPoints, sg, newGeom));
    } else {
      setClusterGeom(cluster, sit, newGeom);
    }
    return false;
  }
}

function mouseReleased() {
  if (activeDrawPath) {
    activeDrawPath = null;
    return false;
  }

  if (!editDrag || vizMode !== 'edit') {
    editDrag = null;
    return false;
  }

  if (editDrag.mode === 'create' && shapeTool !== 'draw') {
    const w = screenToWorld(mouseX, mouseY);
    editDrag.bx = w.x;
    editDrag.by = w.y;
    const g = geomFromDrag(editDrag.ax, editDrag.ay, editDrag.bx, editDrag.by);
    const cluster = createCluster(shapeTool, g, newClusterParticleCount);
    selectedClusterId = cluster.id;
    refreshVisualizerUI();
  } else if (editDrag.mode === 'resize' || editDrag.mode === 'move') {
    const cluster = getClusterById(editDrag.clusterId);
    if (cluster) {
      refreshClusterUnitPoints(cluster);
      if (vizMode === 'play' && typeof syncPlayParticlePool === 'function') {
        syncPlayParticlePool(getSituationBlendT());
      }
    }
  }

  editDrag = null;
  return false;
}

function pruneInteractionImpulses(nowMs) {
  if (!interactionImpulses.length) return;
  const dur = Math.max(1, CONFIG.interaction.durationMs | 0);
  let write = 0;
  for (let i = 0; i < interactionImpulses.length; i++) {
    const imp = interactionImpulses[i];
    const age = nowMs - (+imp.startMs || 0);
    if (age >= 0 && age < dur) interactionImpulses[write++] = imp;
  }
  interactionImpulses.length = write;
}

function keyPressed() {
  if (typeof shouldBlockCanvasForTextInput === 'function' && shouldBlockCanvasForTextInput()) return;
  if (key === 's' || key === 'S') {
    if (typeof redraw === 'function') redraw();
    const now = new Date();
    const dateStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
    const timeStr = String(now.getHours()).padStart(2, '0') + '-' + String(now.getMinutes()).padStart(2, '0') + '-' + String(now.getSeconds()).padStart(2, '0');
    saveCanvas('visualizer_' + dateStr + '_' + timeStr, 'png');
    return false;
  }
  if (key === 'v' || key === 'V') {
    if (typeof toggleVideoRecording === 'function') toggleVideoRecording();
    return false;
  }
  if (key === 'Escape' && vizMode === 'edit' && isPolygonRedrawActive()) {
    cancelPolygonRedraw();
    return false;
  }
  if (key === 'Delete' || key === 'Backspace') {
    if (selectedClusterId != null && vizMode === 'edit') {
      deleteCluster(selectedClusterId);
      refreshVisualizerUI();
    }
  }
}

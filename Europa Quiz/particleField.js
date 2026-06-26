// Persistent particle grids that survive stage DOM teardown.
// Uses GRID_* constants and layout helpers from quizParticleRegion.js.

const FIELD_BOX_EASE = 0.12;
const FIELD_FIGMA_W = 3840;
const FIELD_FIGMA_H = 2160;
const GRID_MORPH_DURATION_MS = 700;
// Column count is frozen per grid (derived once from this reference tier) so a
// density change only adds/compresses ROWS. Particle i keeps its column for
// life, which keeps every horizontal position fixed -> no diagonal shearing.
const GRID_COLS_REF_TIER = 2;

function fieldEaseInOut(t) {
  const x = Math.max(0, Math.min(1, t));
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

const particleField = (function particleFieldModule() {
  let canvas = null;
  let ctx = null;
  let screen = null;
  let running = false;
  let rafId = 0;
  let pxW = 0;
  let pxH = 0;
  let dpr = 1;
  const grids = new Map();
  const impulseStore = createImpulseStore();
  let interactionCfg = scaleInteractionForWidth(1920);
  let interactionEnabled = false;
  let interactionListener = null;

  function ensureCanvas() {
    if (canvas) return;
    canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    if (window.stageTransitions) {
      stageTransitions.markStageTier(canvas, 'none');
    }
    canvas.style.cssText =
      'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:1;';
    ctx = canvas.getContext('2d', { alpha: true });
    window.addEventListener('resize', resizeCanvas);
  }

  function resizeCanvas() {
    if (!screen || !canvas) return;
    const rect = screen.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    pxW = Math.max(1, Math.round(rect.width * dpr));
    pxH = Math.max(1, Math.round(rect.height * dpr));
    canvas.width = pxW;
    canvas.height = pxH;
    if (interactionEnabled) {
      interactionCfg = scaleInteractionForWidth(pxW);
    }
  }

  function figmaToCanvas(fx, fy) {
    return {
      x: (fx / FIELD_FIGMA_W) * pxW,
      y: (fy / FIELD_FIGMA_H) * pxH
    };
  }

  function createBox(x, y, w, h) {
    const box = { x, y, w, h };
    return { cur: { ...box }, target: { ...box } };
  }

  function createFieldParticle(index, fx, fy) {
    const seed = particleGridSeed(index);
    return {
      index,
      appear: 0,
      targetAppear: 0,
      appearStartMs: 0,
      colorSeed: seed,
      swaySeed: seed * 1.37,
      biasAngle: (Math.random() - 0.5) * 0.24,
      rx: fx,
      ry: fy,
      posX: null,
      posY: null,
      velX: 0,
      velY: 0,
      fromNX: 0,
      fromNY: 0,
      toNX: 0,
      toNY: 0
    };
  }

  // Normalized cell center (0..1) within the grid box, filling bottom-up.
  function normHomeForIndex(index, cols, rows) {
    const col = index % cols;
    const rowFromBottom = Math.floor(index / cols);
    const rowFromTop = rows - 1 - rowFromBottom;
    const seed = particleGridSeed(index);
    const jitterX = (Math.sin(seed * 12.9898) * 0.5) * (1 / cols) * 0.18;
    const jitterY = (Math.cos(seed * 78.233) * 0.5) * (1 / rows) * 0.18;
    return {
      nx: (col + 0.5) / cols + jitterX,
      ny: (rowFromTop + 0.5) / rows + jitterY,
      rowFromBottom
    };
  }

  function homeForGridIndex(index, grid, box) {
    const nh = normHomeForIndex(index, grid.cols, grid.rows);
    return {
      x: box.x + nh.nx * box.w,
      y: box.y + nh.ny * box.h,
      rowFromBottom: nh.rowFromBottom
    };
  }

  function ensurePool(grid, capacity, box) {
    while (grid.particles.length < capacity) {
      const i = grid.particles.length;
      const home = homeForGridIndex(i, grid, box);
      grid.particles.push(createFieldParticle(i, home.x, home.y));
    }
    if (grid.particles.length > capacity) grid.particles.length = capacity;
  }

  function applyGridLayout(grid, tier, box) {
    const cap = computeGridCapacity(tier);
    if (grid.cols == null) {
      // Freeze columns once, sized for a mid reference density so cells stay
      // roughly square. From here on only the row count changes with tier.
      const aspect = box.w / box.h;
      const refCap = computeGridCapacity(GRID_COLS_REF_TIER);
      grid.cols = Math.max(1, Math.round(Math.sqrt(refCap * aspect)));
    }
    grid.tier = tier;
    grid.rows = Math.max(1, Math.ceil(cap / grid.cols));
    ensurePool(grid, grid.cols * grid.rows, box);
  }

  function getParticleFigmaPos(p) {
    if (p.posX != null && p.posY != null && pxW > 0 && pxH > 0) {
      return {
        x: (p.posX / pxW) * FIELD_FIGMA_W,
        y: (p.posY / pxH) * FIELD_FIGMA_H
      };
    }
    return { x: p.rx, y: p.ry };
  }

  function syncParticleFigmaFromCanvas(p) {
    if (p.posX == null || p.posY == null || pxW < 1 || pxH < 1) return;
    p.rx = (p.posX / pxW) * FIELD_FIGMA_W;
    p.ry = (p.posY / pxH) * FIELD_FIGMA_H;
  }

  // Synchronized morph: every particle travels in a straight line (in
  // normalized box space) from its current spot to its new cell. One shared
  // eased progress means no per-row time offset, so no diagonal shearing.
  function startMorph(grid, nowMs) {
    const box = grid.box.cur;
    for (let i = 0; i < grid.particles.length; i++) {
      const p = grid.particles[i];
      const figma = getParticleFigmaPos(p);
      p.fromNX = box.w ? (figma.x - box.x) / box.w : 0;
      p.fromNY = box.h ? (figma.y - box.y) / box.h : 0;
      const nh = normHomeForIndex(i, grid.cols, grid.rows);
      p.toNX = nh.nx;
      p.toNY = nh.ny;
    }
    grid.morphing = true;
    grid.morphStart = nowMs;
    grid.morphDur = GRID_MORPH_DURATION_MS;
  }

  function scheduleAppearances(grid, prevCount, nowMs) {
    const { targetCount } = grid;
    const delta = targetCount - prevCount;
    const adding = delta > 0;
    const removing = delta < 0;
    const box = grid.box.cur;

    for (let i = 0; i < grid.particles.length; i++) {
      const p = grid.particles[i];
      const home = homeForGridIndex(i, grid, box);
      const shouldShow = i < targetCount;
      const wasShowing = i < prevCount;
      p.targetAppear = shouldShow ? 1 : 0;

      if (shouldShow === wasShowing) {
        p.appearStartMs = nowMs;
        continue;
      }

      let rowDelay = home.rowFromBottom * GRID_PER_ROW_DELAY_MS;
      if (adding && shouldShow) {
        const rowsAdded = Math.floor((i - prevCount) / grid.cols);
        rowDelay = rowsAdded * GRID_PER_ROW_DELAY_MS;
      } else if (removing && !shouldShow) {
        const topRemoved = prevCount - 1;
        const rowsFromTop = Math.floor((topRemoved - i) / grid.cols);
        rowDelay = rowsFromTop * GRID_PER_ROW_DELAY_MS;
      }
      p.appearStartMs = nowMs + rowDelay;
    }
  }

  function setGridValue(grid, value, options = {}) {
    const nowMs = options.nowMs ?? performance.now();
    const immediate = !!options.immediate;
    const n = Math.max(0, Math.round(value / 1_000_000));
    const newTier = Math.max(0, Math.floor(value / GRID_TIER_STEP));
    const prevCount = grid.targetCount;
    const tierChanged = newTier !== grid.tier;

    grid.targetCount = n;

    if (!grid.ready || tierChanged) {
      grid.tier = newTier;
      applyGridLayout(grid, grid.tier, grid.box.cur);
      if (tierChanged && grid.ready && !immediate) {
        startMorph(grid, nowMs);
      }
      grid.ready = true;
    }

    scheduleAppearances(grid, prevCount, nowMs);

    if (immediate) {
      const box = grid.box.cur;
      for (let i = 0; i < grid.particles.length; i++) {
        const p = grid.particles[i];
        p.appear = p.targetAppear;
        p.appearStartMs = nowMs;
        const home = homeForGridIndex(i, grid, box);
        p.rx = home.x;
        p.ry = home.y;
        resetVizParticlePhysics(p);
      }
      grid.morphing = false;
    }
  }

  function easeBox(box) {
    const c = box.cur;
    const t = box.target;
    c.x += (t.x - c.x) * FIELD_BOX_EASE;
    c.y += (t.y - c.y) * FIELD_BOX_EASE;
    c.w += (t.w - c.w) * FIELD_BOX_EASE;
    c.h += (t.h - c.h) * FIELD_BOX_EASE;
  }

  const INTERACTION_CAPTURE = { capture: true };

  function detachInteractionListener() {
    if (interactionListener && screen) {
      screen.removeEventListener('pointerdown', interactionListener, INTERACTION_CAPTURE);
    }
    interactionListener = null;
    interactionEnabled = false;
    impulseStore.enabled = false;
  }

  function shouldIgnoreInteractionEvent(event) {
    const target = event.target;
    if (!target?.closest) return false;
    return !!target.closest(
      'button, a, input, textarea, select, [data-stage-tier="interactive"]'
    );
  }

  function clientToCanvasPx(clientX, clientY) {
    const rect = screen.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return { x: 0, y: 0 };
    return {
      x: ((clientX - rect.left) / rect.width) * pxW,
      y: ((clientY - rect.top) / rect.height) * pxH
    };
  }

  function onInteractionPointerDown(event) {
    if (!interactionEnabled || !impulseStore.enabled) return;
    if (event.button !== 0) return;
    if (shouldIgnoreInteractionEvent(event)) return;
    const local = clientToCanvasPx(event.clientX, event.clientY);
    pushImpulse(impulseStore, local.x, local.y, performance.now(), interactionCfg.maxImpulses);
  }

  function setInteractionEnabled(on, options = {}) {
    detachInteractionListener();
    if (!on || !screen) return;
    interactionEnabled = true;
    impulseStore.enabled = true;
    interactionCfg = scaleInteractionForWidth(pxW);
    if (!options.preservePositions) {
      for (const grid of grids.values()) {
        for (const p of grid.particles) resetVizParticlePhysics(p);
      }
    }
    interactionListener = onInteractionPointerDown;
    screen.addEventListener('pointerdown', interactionListener, INTERACTION_CAPTURE);
  }

  function enableInteractionAfterStageEnter(options = {}) {
    const enable = () => setInteractionEnabled(true, options);
    if (window.stageTransitions) {
      stageTransitions.onEnterTier('content', enable);
    } else {
      enable();
    }
  }

  function detach() {
    setInteractionEnabled(false);
    screen = null;
    if (!running) return;
    running = false;
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
  }

  function step(nowMs) {
    if (!ctx || !canvas?.isConnected || pxW < 1 || pxH < 1) return;
    ctx.clearRect(0, 0, pxW, pxH);

    if (interactionEnabled) {
      pruneInteractionImpulses(nowMs, impulseStore.impulses, interactionCfg);
    }

    const t = nowMs * 0.001;

    for (const grid of grids.values()) {
      if (!grid.claimed) continue;

      easeBox(grid.box);
      const box = grid.box.cur;
      const scale = pxW / FIELD_FIGMA_W;
      const cellSizeFigma = Math.min(box.w / grid.cols, box.h / grid.rows);
      const swayAmpFigma = cellSizeFigma * 0.06;
      const baseRadiusPx = cellSizeFigma * 0.36 * scale;

      const morphT = grid.morphing
        ? fieldEaseInOut((nowMs - grid.morphStart) / grid.morphDur)
        : 1;

      const stepCtx = interactionEnabled ? {
        tNow: nowMs,
        impulses: impulseStore.impulses,
        interactionCfg,
        interactionEnabled: impulseStore.enabled
      } : null;
      const visible = interactionEnabled ? new Array(grid.particles.length) : null;

      for (let i = 0; i < grid.particles.length; i++) {
        const p = grid.particles[i];
        if (nowMs >= p.appearStartMs) {
          p.appear += (p.targetAppear - p.appear) * GRID_APPEAR_EASE;
        }
        if (p.appear < 0.005 && p.targetAppear <= 0) continue;

        let drawX;
        let drawY;

        const home = homeForGridIndex(i, grid, box);
        let targetFigmaX = home.x;
        let targetFigmaY = home.y;

        if (grid.morphing) {
          const nx = p.fromNX + (p.toNX - p.fromNX) * morphT;
          const ny = p.fromNY + (p.toNY - p.fromNY) * morphT;
          targetFigmaX = box.x + nx * box.w;
          targetFigmaY = box.y + ny * box.h;
          p.rx = targetFigmaX;
          p.ry = targetFigmaY;
        }

        if (interactionEnabled) {
          const target = figmaToCanvas(targetFigmaX, targetFigmaY);
          if (p.posX == null) {
            p.posX = target.x;
            p.posY = target.y;
            p.velX = 0;
            p.velY = 0;
          }
          stepCtx.tx = target.x;
          stepCtx.ty = target.y;
          stepVisualizerPlayParticle(p, stepCtx);
          syncParticleFigmaFromCanvas(p);
          drawX = p.posX;
          drawY = p.posY;
          visible[i] = true;
        } else if (grid.morphing) {
          const draw = figmaToCanvas(targetFigmaX, targetFigmaY);
          p.posX = draw.x;
          p.posY = draw.y;
          p.velX = 0;
          p.velY = 0;
          drawX = draw.x;
          drawY = draw.y;
        } else {
          p.rx += (home.x - p.rx) * GRID_POSITION_EASE;
          p.ry += (home.y - p.ry) * GRID_POSITION_EASE;
          resetVizParticlePhysics(p);
          const swayScale = p.appear;
          const swayX = Math.sin(t * 1.8 + p.swaySeed) * swayAmpFigma * swayScale;
          const swayY = Math.cos(t * 1.5 + p.swaySeed * 1.3) * swayAmpFigma * swayScale;
          const draw = figmaToCanvas(p.rx + swayX, p.ry + swayY);
          drawX = draw.x;
          drawY = draw.y;
        }

        const varied = applyColorVariance(grid.baseHsb, GRID_COLOR_VAR, p.colorSeed + t * 0.4);
        const rgb = hsbToRgb(varied.h, varied.s, varied.b);
        const alpha = 0.88 * p.appear;
        const radius = baseRadiusPx * (0.35 + 0.65 * p.appear);

        ctx.beginPath();
        ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
        ctx.arc(drawX, drawY, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      if (interactionEnabled) {
        applyVizParticleSeparation(grid.particles, visible);
      }

      if (grid.morphing && nowMs - grid.morphStart >= grid.morphDur) {
        grid.morphing = false;
        for (const p of grid.particles) {
          p.velX = 0;
          p.velY = 0;
        }
      }
    }
  }

  function loop(nowMs) {
    if (!running) return;
    step(nowMs);
    rafId = requestAnimationFrame(loop);
  }

  function startLoop() {
    if (running) return;
    running = true;
    rafId = requestAnimationFrame(loop);
  }

  function attach(newScreen) {
    setInteractionEnabled(false);
    ensureCanvas();
    screen = newScreen;
    resizeCanvas();
    requestAnimationFrame(resizeCanvas);
    if (canvas.parentNode !== screen) {
      if (window.stageTransitions) stageTransitions.markStageTier(canvas, 'none');
      screen.insertBefore(canvas, screen.firstChild);
    }
    for (const grid of grids.values()) {
      grid.claimed = false;
    }
    startLoop();
  }

  function boxIsValid(box) {
    return Number.isFinite(box?.x) && Number.isFinite(box?.y)
      && Number.isFinite(box?.w) && Number.isFinite(box?.h)
      && box.w > 0 && box.h > 0;
  }

  function showGrid(id, opts = {}) {
    const { x, y, w, h, value, colorHex, immediate } = opts;
    let grid = grids.get(id);

    if (grid) {
      grid.claimed = true;
      if (colorHex) {
        const baseRgb = hexToRgb(colorHex);
        grid.baseHsb = rgbToHsb(baseRgb.r, baseRgb.g, baseRgb.b);
      }
      return grid;
    }

    if (x == null || y == null || w == null || h == null) return null;

    const baseRgb = hexToRgb(colorHex || PARTICLE_PALETTE.lime);
    grid = {
      claimed: true,
      ready: false,
      targetCount: 0,
      tier: -1,
      cols: null,
      rows: 1,
      morphing: false,
      morphStart: 0,
      morphDur: 0,
      baseHsb: rgbToHsb(baseRgb.r, baseRgb.g, baseRgb.b),
      box: createBox(x, y, w, h),
      particles: []
    };
    grids.set(id, grid);
    setGridValue(grid, value ?? 0, { immediate: !!immediate });
    return grid;
  }

  function setValue(id, value, options = {}) {
    const grid = grids.get(id);
    if (!grid) return;
    setGridValue(grid, value, options);
  }

  function moveGrid(id, bounds, options = {}) {
    const grid = grids.get(id);
    if (!grid) return;
    const { x, y, w, h } = bounds;
    grid.box.target = { x, y, w, h };
    if (options.immediate) {
      grid.box.cur = { x, y, w, h };
    }
  }

  function setDensityValue(id, layoutValue) {
    const grid = grids.get(id);
    if (!grid || !grid.ready) return;
    const nowMs = performance.now();
    const newTier = Math.max(0, Math.floor(layoutValue / GRID_TIER_STEP));
    if (newTier === grid.tier) return;
    grid.tier = newTier;
    applyGridLayout(grid, grid.tier, grid.box.cur);
    startMorph(grid, nowMs);
  }

  function resetGrid(id, opts = {}) {
    const { bounds, value, colorHex } = opts;
    const grid = grids.get(id);

    if (!grid || !boxIsValid(grid.box.cur)) {
      if (grid) grids.delete(id);
      if (!bounds) return;
      showGrid(id, {
        x: bounds.x,
        y: bounds.y,
        w: bounds.w,
        h: bounds.h,
        value: value ?? 0,
        colorHex,
        immediate: true
      });
      return;
    }

    grid.claimed = true;
    if (colorHex) {
      const baseRgb = hexToRgb(colorHex);
      grid.baseHsb = rgbToHsb(baseRgb.r, baseRgb.g, baseRgb.b);
    }
    if (bounds) {
      if (!boxIsValid(grid.box.target)) {
        grid.box.cur = { ...bounds };
        grid.box.target = { ...bounds };
      } else {
        moveGrid(id, bounds);
      }
    }
    if (value != null) {
      setValue(id, value);
    }
  }

  function commit() {
    for (const [id, grid] of grids) {
      if (!grid.claimed) grids.delete(id);
    }
  }

  return {
    attach,
    detach,
    showGrid,
    setValue,
    moveGrid,
    setDensityValue,
    resetGrid,
    commit,
    setInteractionEnabled,
    enableInteractionAfterStageEnter
  };
})();

window.particleField = particleField;

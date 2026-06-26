// Trail fade/cull tuned to match the idle particle line (topParticleLine.js).
const IDLE_PARTICLE_TRAIL = {
  fade: 3,
  trailCull: 15,
  cullEvery: 4
};

// Mirrors Generator USER_STAGE_BASE + USER_STAGE_PRESETS[0] (user mode defaults).
const USER_MODE_DEFAULTS = {
  size: 3,
  speed: 0.05,
  fade: IDLE_PARTICLE_TRAIL.fade,
  grav: 1,
  colorVar: 20,
  trailCull: IDLE_PARTICLE_TRAIL.trailCull,
  jitter: 0.01,
  strokeAlpha: 45,
  count: 1
};

// Figma boards crop the visualizer so one cluster fills most of the card region.
const FIGMA_BLOB_STROKE_RATIO = 0.45;

const MAP_MARKER_DRAW = {
  outline: '#1a1a1a',
  userFill: '#ffffff',
  radiusRatio: 0.38,
  outlineRatio: 0.14
};
if (typeof window !== 'undefined') window.MAP_MARKER_DRAW = MAP_MARKER_DRAW;

const MOTION_PRESETS = {
  default: {
    wanderRatio: 0.12,
    speedMul: 1,
    jitterMul: 1,
    velLerp: 0.06,
    renderEase: 0.12,
    flowFreq: 0.55,
    strokeRatio: FIGMA_BLOB_STROKE_RATIO,
    smoothNoise: false
  },
  pinned: {
    wanderRatio: 0.03,
    speedMul: 0.2,
    jitterMul: 0,
    velLerp: 0.18,
    renderEase: 0.35,
    flowFreq: 0.25,
    noiseForce: 0.12,
    pullMul: 0.4,
    gravMul: 2.5,
    returnForce: 0.08,
    strokeRatio: FIGMA_BLOB_STROKE_RATIO,
    smoothNoise: true,
    timeScale: 0.00003
  },
  float: {
    wanderRatio: 0.2,
    speed: 0.04,
    speedMul: 1,
    gravMul: 0.5,
    pullMul: 0.12,
    noiseForce: 2.2,
    returnForce: 0.025,
    velLerp: 0.06,
    renderEase: 0.12,
    flowFreq: 0.55,
    timeScale: 0.00004,
    strokeRatio: 0.62,
    jitterMul: 0,
    smoothNoise: false
  }
};

const COLOR_CLASS_HEX = {
  'figma-placeholder--lime': PARTICLE_PALETTE.lime,
  'figma-placeholder--orange': PARTICLE_PALETTE.orange,
  'figma-placeholder--red': PARTICLE_PALETTE.orange,
  'figma-placeholder--blue': PARTICLE_PALETTE.skyBlue,
  'figma-placeholder--yellow': PARTICLE_PALETTE.paleLime,
  'figma-placeholder--purple': PARTICLE_PALETTE.purple,
  'figma-placeholder--green': PARTICLE_PALETTE.mediumBlue
};

function colorClassToHex(colorClass = '') {
  const key = String(colorClass).trim();
  return COLOR_CLASS_HEX[key] || PARTICLE_PALETTE.skyBlue;
}

function hexToRgb(hex) {
  const n = String(hex).replace('#', '');
  if (n.length < 6) return { r: 21, g: 101, b: 192 };
  return {
    r: parseInt(n.slice(0, 2), 16),
    g: parseInt(n.slice(2, 4), 16),
    b: parseInt(n.slice(4, 6), 16)
  };
}

function rgbToHsb(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  const s = max === 0 ? 0 : (d / max) * 100;
  const v = max * 100;
  if (d !== 0) {
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      default: h = ((r - g) / d + 4) / 6;
    }
    h *= 360;
  }
  return { h, s, b: v };
}

function hsbToRgb(h, s, b) {
  s /= 100;
  b /= 100;
  const c = b * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = b - c;
  let rp = 0;
  let gp = 0;
  let bp = 0;
  if (h < 60) { rp = c; gp = x; }
  else if (h < 120) { rp = x; gp = c; }
  else if (h < 180) { gp = c; bp = x; }
  else if (h < 240) { gp = x; bp = c; }
  else if (h < 300) { rp = x; bp = c; }
  else { rp = c; bp = x; }
  return {
    r: Math.round((rp + m) * 255),
    g: Math.round((gp + m) * 255),
    b: Math.round((bp + m) * 255)
  };
}

function applyColorVariance(hsb, variancePct, seed) {
  const v = variancePct / 100;
  const hOff = (Math.sin(seed * 12.9898) * 7) * v;
  const sOff = (Math.sin(seed * 78.233) * 10) * v;
  const bOff = (Math.cos(seed * 43.758) * 12) * v;
  return {
    h: (hsb.h + hOff + 360) % 360,
    s: Math.max(0, Math.min(100, hsb.s + sOff)),
    b: Math.max(0, Math.min(100, hsb.b + bOff))
  };
}

function fadeTrails(ctx, w, h, fade) {
  const a = Math.max(0, Math.min(1, fade / 100));
  if (a <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = `rgba(0, 0, 0, ${a})`;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function cullFaintTrails(ctx, w, h, trailCull) {
  if (!ctx?.getImageData || trailCull <= 0) return;
  const th = Math.max(0, Math.min(255, trailCull | 0));
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

function createParticleRegion(screen, x, y, w, h, colorHex, options = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'figma-particle-region';
  if (options.fullscreen) wrap.classList.add('figma-particle-region--fullscreen');
  if (!options.skipStageAnim) {
    if (window.stageTransitions) {
      stageTransitions.markStageTier(wrap, 'content');
    } else {
      wrap.setAttribute('data-stage-tier', 'content');
      wrap.classList.add('stage-enter-pending');
    }
  }
  const parent = options.parent || screen;

  if (options.anchorNorm) {
    wrap.style.position = 'absolute';
    wrap.style.left = `${options.anchorNorm.x * 100}%`;
    wrap.style.top = `${options.anchorNorm.y * 100}%`;
    wrap.style.width = `calc(${w} * 100vw / var(--figma-canvas-width))`;
    wrap.style.height = `calc(${h} * 100vw / var(--figma-canvas-width))`;
    wrap.style.transform = 'translate(-50%, -50%)';
  } else {
    applyPos(wrap, x, y, w, h);
  }

  // Optional fade/grow-in, matching the appear animation of grid particles.
  const APPEAR_EASE = 0.1;
  let appear = options.spawnAnimation ? 0 : 1;

  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  wrap.appendChild(canvas);
  parent.appendChild(wrap);

  const baseRgb = hexToRgb(colorHex);
  const baseHsb = rgbToHsb(baseRgb.r, baseRgb.g, baseRgb.b);
  const seed = Math.random() * 1000;

  let running = true;
  let rafId = 0;
  let pxW = 0;
  let pxH = 0;
  let dpr = 1;
  let frameCount = 0;

  const pos = { x: 0, y: 0 };
  const prev = { x: 0, y: 0 };
  const vel = { x: 0, y: 0 };
  // Eased render position: smooths out the per-frame jitter of the simulation.
  const render = { x: 0, y: 0 };
  const prevRender = { x: 0, y: 0 };
  let started = false;
  let simulationLocked = false;

  const positionCbs = [];

  const ctx = canvas.getContext('2d', { alpha: true });

  function figmaPointToPx(fx, fy) {
    return {
      x: ((fx - x) / w) * pxW,
      y: ((fy - y) / h) * pxH
    };
  }

  function wanderRadiusPx() {
    if (options.wanderRadius == null) return null;
    const p = figmaPointToPx(x + options.wanderRadius, y + options.wanderRadius);
    const o = figmaPointToPx(x, y);
    return Math.hypot(p.x - o.x, p.y - o.y);
  }

  function resizeCanvas() {
    const rect = wrap.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const nextW = Math.max(1, Math.round(rect.width * dpr));
    const nextH = Math.max(1, Math.round(rect.height * dpr));
    const sizeChanged = nextW !== pxW || nextH !== pxH;
    pxW = nextW;
    pxH = nextH;
    if (sizeChanged) {
      canvas.width = pxW;
      canvas.height = pxH;
    }
    if (!started) {
      if (options.startX != null && options.startY != null) {
        const start = figmaPointToPx(options.startX, options.startY);
        pos.x = start.x;
        pos.y = start.y;
      } else {
        pos.x = pxW * 0.5;
        pos.y = pxH * 0.5;
      }
      prev.x = pos.x;
      prev.y = pos.y;
      render.x = pos.x;
      render.y = pos.y;
      prevRender.x = pos.x;
      prevRender.y = pos.y;
      started = true;
    }
  }

  const resizeObserver = typeof ResizeObserver !== 'undefined'
    ? new ResizeObserver(() => resizeCanvas())
    : null;
  resizeCanvas();
  if (resizeObserver) resizeObserver.observe(wrap);
  else window.addEventListener('resize', resizeCanvas);

  function resetParticleCenter() {
    const cx = pxW * 0.5;
    const cy = pxH * 0.5;
    pos.x = cx;
    pos.y = cy;
    prev.x = cx;
    prev.y = cy;
    render.x = cx;
    render.y = cy;
    prevRender.x = cx;
    prevRender.y = cy;
    vel.x = 0;
    vel.y = 0;
  }

  function drawMapMarker(style) {
    const cx = pxW * 0.5;
    const cy = pxH * 0.5;
    const radius = Math.min(pxW, pxH) * MAP_MARKER_DRAW.radiusRatio * appear;
    const lineW = Math.max(2, radius * MAP_MARKER_DRAW.outlineRatio);

    ctx.clearRect(0, 0, pxW, pxH);

    if (style === 'user') {
      ctx.fillStyle = MAP_MARKER_DRAW.userFill;
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(0, radius - lineW * 0.55), 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.strokeStyle = MAP_MARKER_DRAW.outline;
    ctx.lineWidth = lineW;
    const outlineRadius = Math.max(0, radius - lineW * 0.5);
    ctx.beginPath();
    ctx.arc(cx, cy, outlineRadius, 0, Math.PI * 2);
    ctx.stroke();

    if (style === 'correct') {
      const innerLineW = Math.max(2, lineW * 0.55);
      const innerRadius = Math.max(0, outlineRadius - lineW * 0.45 - innerLineW * 0.5);
      ctx.strokeStyle = MAP_MARKER_DRAW.userFill;
      ctx.lineWidth = innerLineW;
      ctx.beginPath();
      ctx.arc(cx, cy, innerRadius, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawLockedBlob() {
    const motion = MOTION_PRESETS.pinned;
    const cx = pxW * 0.5;
    const cy = pxH * 0.5;
    const strokeBase = Math.min(pxW, pxH);
    const strokeAlpha = options.strokeAlpha ?? USER_MODE_DEFAULTS.strokeAlpha;
    const varied = applyColorVariance(baseHsb, USER_MODE_DEFAULTS.colorVar, seed);
    const rgb = hsbToRgb(varied.h, varied.s, varied.b);
    ctx.clearRect(0, 0, pxW, pxH);
    ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${strokeAlpha / 100})`;
    ctx.lineWidth = strokeBase * motion.strokeRatio;
    ctx.lineCap = 'round';
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2 + seed * 0.01;
      const radius = strokeBase * 0.1;
      ctx.beginPath();
      ctx.moveTo(cx - Math.cos(angle) * radius, cy - Math.sin(angle) * radius);
      ctx.lineTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
      ctx.stroke();
    }
  }

  function setSimulationLocked(locked) {
    simulationLocked = !!locked;
    if (simulationLocked && ctx && pxW > 0 && pxH > 0) {
      resetParticleCenter();
      drawLockedBlob();
    }
  }

  function step(nowMs) {
    if (!running || !ctx || pxW < 1 || pxH < 1) return;

    if (options.mapMarkerStyle) {
      if (appear < 1) appear += (1 - appear) * APPEAR_EASE;
      drawMapMarker(options.mapMarkerStyle);
      return;
    }

    if (simulationLocked) {
      drawLockedBlob();
      return;
    }

    const motion = MOTION_PRESETS[options.motionProfile] || MOTION_PRESETS.default;
    const t = nowMs * (motion.timeScale ?? 0.00008);
    let cx = pxW * 0.5;
    let cy = pxH * 0.5;

    if (options.anchorX != null) {
      const anchor = figmaPointToPx(options.anchorX, options.anchorY);
      cx = anchor.x;
      cy = anchor.y;
    }

    const wanderR = wanderRadiusPx() ?? Math.min(pxW, pxH) * motion.wanderRatio;
    const { speed, grav, jitter, fade, colorVar, trailCull } = USER_MODE_DEFAULTS;
    const strokeAlpha = options.strokeAlpha ?? USER_MODE_DEFAULTS.strokeAlpha;
    const velLerp = motion.velLerp;
    const renderEase = motion.renderEase;
    let strokeBase;
    if (options.strokeBaseFigma != null && options.wanderRadius) {
      strokeBase = wanderR * (options.strokeBaseFigma / options.wanderRadius);
    } else {
      strokeBase = options.strokeBasePx ?? Math.min(pxW, pxH);
    }

    const flowAngle = Math.sin(t * motion.flowFreq + seed) * Math.PI * 2
      + Math.cos(t * motion.flowFreq * 0.55 + seed * 1.7) * 1.4;
    const flowMag = motion.noiseForce ?? (grav * (motion.gravMul ?? 1) * 0.35);
    const flowX = Math.cos(flowAngle) * flowMag;
    const flowY = Math.sin(flowAngle) * flowMag;

    const dx = cx - pos.x;
    const dy = cy - pos.y;
    const dist = Math.hypot(dx, dy) || 0.001;
    const pullGrav = motion.gravMul ?? grav;
    const pull = pullGrav * Math.min(1, dist / wanderR) * (motion.pullMul ?? 0.12);

    vel.x = vel.x * (1 - velLerp) + (flowX + (dx / dist) * pull) * velLerp;
    vel.y = vel.y * (1 - velLerp) + (flowY + (dy / dist) * pull) * velLerp;

    const baseSpeed = motion.speed ?? speed;
    const speedScale = baseSpeed * (motion.speedMul ?? 1) * Math.min(pxW, pxH) * 0.015;
    const jitterScale = jitter * (motion.jitterMul ?? 1);
    let driftX = 0;
    let driftY = 0;
    if (jitterScale > 0) {
      if (motion.smoothNoise) {
        const driftScale = options.anchorX != null ? wanderR : Math.min(pxW, pxH);
        driftX = (
          Math.sin(t * 0.72 + seed)
          + Math.sin(t * 1.18 + seed * 2.1) * 0.55
          + Math.cos(t * 0.41 + seed * 0.6) * 0.35
        ) * jitterScale * driftScale * 0.22;
        driftY = (
          Math.cos(t * 0.58 + seed * 1.4)
          + Math.cos(t * 1.02 + seed * 0.85) * 0.55
          + Math.sin(t * 0.47 + seed * 1.9) * 0.35
        ) * jitterScale * driftScale * 0.22;
      } else {
        const driftScale = options.anchorX != null ? wanderR : Math.min(pxW, pxH);
        driftX = (Math.random() - 0.5) * jitterScale * driftScale;
        driftY = (Math.random() - 0.5) * jitterScale * driftScale;
      }
    }

    prev.x = pos.x;
    prev.y = pos.y;
    pos.x += vel.x * speedScale + driftX;
    pos.y += vel.y * speedScale + driftY;

    if (dist > wanderR) {
      const excess = (dist - wanderR) / wanderR;
      const returnForce = motion.returnForce ?? 0.025;
      vel.x += (dx / dist) * excess * returnForce;
      vel.y += (dy / dist) * excess * returnForce;
    }

    prevRender.x = render.x;
    prevRender.y = render.y;
    render.x += (pos.x - render.x) * renderEase;
    render.y += (pos.y - render.y) * renderEase;

    fadeTrails(ctx, pxW, pxH, fade);
    // cullFaintTrails runs getImageData over the whole canvas, which is very
    // expensive. Throttle it (same approach as the idle particle line) so it
    // doesn't run every frame.
    frameCount++;
    if (trailCull > 0 && frameCount % IDLE_PARTICLE_TRAIL.cullEvery === 0) {
      cullFaintTrails(ctx, pxW, pxH, trailCull);
    }

    if (appear < 1) appear += (1 - appear) * APPEAR_EASE;

    const varied = applyColorVariance(baseHsb, colorVar, t + seed);
    const rgb = hsbToRgb(varied.h, varied.s, varied.b);
    ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${(strokeAlpha / 100) * appear})`;
    ctx.lineWidth = strokeBase * motion.strokeRatio * (0.35 + 0.65 * appear);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(prevRender.x, prevRender.y);
    ctx.lineTo(render.x, render.y);
    ctx.stroke();

    if (positionCbs.length) {
      const nx = render.x / pxW;
      const ny = render.y / pxH;
      for (const cb of positionCbs) cb(nx, ny);
    }
  }

  function loop(nowMs) {
    if (!running) return;
    step(nowMs);
    rafId = requestAnimationFrame(loop);
  }

  rafId = requestAnimationFrame(loop);

  function cleanup() {
    running = false;
    positionCbs.length = 0;
    if (rafId) cancelAnimationFrame(rafId);
    if (resizeObserver) resizeObserver.disconnect();
    else window.removeEventListener('resize', resizeCanvas);
    wrap.remove();
  }

  return {
    el: wrap,
    bounds: { x, y, w, h },
    onPosition(fn) { if (typeof fn === 'function') positionCbs.push(fn); },
    setSimulationLocked,
    cleanup
  };
}

// A single shared canvas that draws ALL anchored "choice" particles for a stage,
// using the same approach as the idle particle line (one canvas, one animation
// loop, one trail fade + throttled cull per frame). Giving each particle its own
// full-canvas region was the cause of the heavy framerate drops, since the
// per-frame fillRect + getImageData ran once per particle. Each particle wanders
// around its own anchor point and is pulled back so it stays near its text.
// Diameter of the selection highlight relative to the particle blob (canvas-drawn).
const ANCHORED_SELECTION_DOT_RATIO = 0.5;

function createAnchoredParticleField(screen) {
  const wrap = document.createElement('div');
  wrap.className = 'figma-particle-region figma-particle-region--fullscreen';
  if (window.stageTransitions) {
    stageTransitions.markStageTier(wrap, 'content');
    if (!screen.classList.contains('stage-enter-preparing')) {
      stageTransitions.revealStageElement(wrap);
    }
  } else {
    wrap.setAttribute('data-stage-tier', 'content');
    wrap.classList.add('stage-enter-pending');
  }
  applyPos(wrap, 0, 0, FIGMA_W, FIGMA_H);

  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  wrap.appendChild(canvas);
  screen.appendChild(wrap);

  const ctx = canvas.getContext('2d', { alpha: true });

  // Visual + motion properties shared with the idle particle line.
  const speed = 0.04;
  const grav = 0.5;
  const colorVar = 20;
  const { fade, trailCull, cullEvery } = IDLE_PARTICLE_TRAIL;
  const strokeAlpha = 100;
  const noiseForce = 1.6;
  const velLerp = 0.06;
  const renderEase = 0.12;
  const APPEAR_EASE = 0.1;
  const TRAIL_ERASE_PAD = 1.35;

  function eraseTrailsAt(x, y, radiusPx) {
    if (!ctx || radiusPx <= 0) return;
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'rgba(0, 0, 0, 1)';
    ctx.beginPath();
    ctx.arc(x, y, radiusPx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function trailEraseRadiusFor(p) {
    const sx = pxW / FIGMA_W;
    return p.strokeFigma * sx * TRAIL_ERASE_PAD;
  }

  let running = false;
  let rafId = 0;
  let pxW = 0;
  let pxH = 0;
  let dpr = 1;
  let frame = 0;
  const particles = [];

  function ensureLoop() {
    if (running) return;
    running = true;
    rafId = requestAnimationFrame(loop);
  }

  function stopLoopIfEmpty() {
    if (particles.length > 0 || !running) return;
    running = false;
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
    if (ctx && pxW > 0 && pxH > 0) ctx.clearRect(0, 0, pxW, pxH);
  }

  function initParticle(p) {
    const sx = pxW / FIGMA_W;
    const sy = pxH / FIGMA_H;
    const ax = p.anchorXFigma * sx;
    const ay = p.anchorYFigma * sy;
    const angle = Math.random() * Math.PI * 2;
    const d = p.wanderFigma * sx * (0.15 + Math.random() * 0.35);
    p.pos.x = ax + Math.cos(angle) * d;
    p.pos.y = ay + Math.sin(angle) * d;
    p.render.x = p.pos.x;
    p.render.y = p.pos.y;
    p.prevRender.x = p.pos.x;
    p.prevRender.y = p.pos.y;
    p.vel.x = 0;
    p.vel.y = 0;
    p.seed = Math.random() * 1000;
    p.started = true;
  }

  function resizeCanvas() {
    const rect = wrap.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    pxW = Math.max(1, Math.round(rect.width * dpr));
    pxH = Math.max(1, Math.round(rect.height * dpr));
    canvas.width = pxW;
    canvas.height = pxH;
    for (const p of particles) {
      if (!p.started) initParticle(p);
    }
  }

  const resizeObserver = typeof ResizeObserver !== 'undefined'
    ? new ResizeObserver(() => resizeCanvas())
    : null;
  resizeCanvas();
  if (resizeObserver) resizeObserver.observe(wrap);
  else window.addEventListener('resize', resizeCanvas);

  function step(nowMs) {
    if (!running || !ctx || pxW < 1 || pxH < 1) return;

    const t = nowMs * 0.00004;
    const sx = pxW / FIGMA_W;
    const sy = pxH / FIGMA_H;
    const speedScale = speed * Math.min(pxW, pxH) * 0.015;

    fadeTrails(ctx, pxW, pxH, fade);
    frame++;
    if (trailCull > 0 && frame % cullEvery === 0) cullFaintTrails(ctx, pxW, pxH, trailCull);

    for (const p of particles) {
      if (!p.started || p.removed) continue;
      if (p.appear < 1) p.appear += (1 - p.appear) * APPEAR_EASE;

      const cx = p.anchorXFigma * sx;
      const cy = p.anchorYFigma * sy;
      const wanderR = p.wanderFigma * sx;

      const flowAngle = Math.sin(t * 0.55 + p.seed) * Math.PI * 2
        + Math.cos(t * 0.3 + p.seed * 1.7) * 1.4;
      const flowX = Math.cos(flowAngle) * noiseForce;
      const flowY = Math.sin(flowAngle) * noiseForce;

      const dx = cx - p.pos.x;
      const dy = cy - p.pos.y;
      const dist = Math.hypot(dx, dy) || 0.001;
      const pull = grav * Math.min(1, dist / wanderR) * 0.12;

      p.vel.x = p.vel.x * (1 - velLerp) + (flowX + (dx / dist) * pull) * velLerp;
      p.vel.y = p.vel.y * (1 - velLerp) + (flowY + (dy / dist) * pull) * velLerp;

      p.pos.x += p.vel.x * speedScale;
      p.pos.y += p.vel.y * speedScale;

      // Firmer return force than the idle line so particles hug their anchor.
      if (dist > wanderR) {
        const excess = (dist - wanderR) / wanderR;
        p.vel.x += (dx / dist) * excess * 0.08;
        p.vel.y += (dy / dist) * excess * 0.08;
      }

      p.prevRender.x = p.render.x;
      p.prevRender.y = p.render.y;
      p.render.x += (p.pos.x - p.render.x) * renderEase;
      p.render.y += (p.pos.y - p.render.y) * renderEase;

      const varied = applyColorVariance(p.baseHsb, colorVar, t + p.seed);
      const rgb = hsbToRgb(varied.h, varied.s, varied.b);
      const alpha = (strokeAlpha / 100) * p.appear * p.fade;
      ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
      ctx.lineWidth = p.strokeFigma * sx * (0.35 + 0.65 * p.appear);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(p.prevRender.x, p.prevRender.y);
      ctx.lineTo(p.render.x, p.render.y);
      ctx.stroke();

      if (p.selected) {
        const dotR = p.strokeFigma * sx * ANCHORED_SELECTION_DOT_RATIO * 0.5;
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.beginPath();
        ctx.arc(p.render.x, p.render.y, dotR, 0, Math.PI * 2);
        ctx.fill();
      }

      if (p.positionCbs.length) {
        const nx = p.render.x / pxW;
        const ny = p.render.y / pxH;
        for (const cb of p.positionCbs) cb(nx, ny);
      }
    }
  }

  function loop(nowMs) {
    if (!running) return;
    step(nowMs);
    rafId = requestAnimationFrame(loop);
  }

  function addParticle(anchorXFigma, anchorYFigma, colorHex, opts = {}) {
    const baseRgb = hexToRgb(colorHex);
    const p = {
      anchorXFigma,
      anchorYFigma,
      wanderFigma: opts.wanderFigma ?? 150,
      strokeFigma: opts.strokeFigma ?? 360,
      baseHsb: rgbToHsb(baseRgb.r, baseRgb.g, baseRgb.b),
      seed: Math.random() * 1000,
      pos: { x: 0, y: 0 },
      vel: { x: 0, y: 0 },
      render: { x: 0, y: 0 },
      prevRender: { x: 0, y: 0 },
      appear: opts.instantAppear ? 1 : 0,
      fade: 1,
      selected: false,
      started: false,
      removed: false,
      positionCbs: []
    };
    particles.push(p);
    if (pxW > 0) initParticle(p);
    ensureLoop();

    const half = p.wanderFigma + p.strokeFigma * 0.5;
    const handle = {
      bounds: { x: 0, y: 0, w: FIGMA_W, h: FIGMA_H },
      interactionBounds: {
        x: anchorXFigma - half,
        y: anchorYFigma - half,
        w: half * 2,
        h: half * 2
      },
      onPosition(fn) { if (typeof fn === 'function') p.positionCbs.push(fn); },
      strokeFigma: p.strokeFigma,
      setSelected(selected) { p.selected = !!selected; },
      setAnchor(nextX, nextY) {
        if (p.removed) return;
        if (p.started) {
          eraseTrailsAt(p.render.x, p.render.y, trailEraseRadiusFor(p));
        }
        p.anchorXFigma = nextX;
        p.anchorYFigma = nextY;
        const nextHalf = p.wanderFigma + p.strokeFigma * 0.5;
        handle.interactionBounds.x = nextX - nextHalf;
        handle.interactionBounds.y = nextY - nextHalf;
        handle.interactionBounds.w = nextHalf * 2;
        handle.interactionBounds.h = nextHalf * 2;
        if (pxW > 0) initParticle(p);
        p.appear = 0;
      },
      remove() {
        if (p.removed) return;
        if (p.started) {
          eraseTrailsAt(p.render.x, p.render.y, trailEraseRadiusFor(p));
        }
        p.removed = true;
        const i = particles.indexOf(p);
        if (i >= 0) particles.splice(i, 1);
        stopLoopIfEmpty();
      }
    };
    return handle;
  }

  function cleanup() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    if (resizeObserver) resizeObserver.disconnect();
    else window.removeEventListener('resize', resizeCanvas);
    wrap.remove();
  }

  return { el: wrap, addParticle, cleanup };
}

const GRID_TIER_STEP = 200_000_000;
const GRID_PARTICLES_PER_TIER = 200;
const GRID_MAX_FILL = 0.82;
const GRID_PER_ROW_DELAY_MS = 28;
const GRID_LAYOUT_ROW_DELAY_MS = 32;
const GRID_LAYOUT_DURATION_MS = 520;
const GRID_POSITION_EASE = 0.1;
const GRID_LAYOUT_EASE = 0.055;
const GRID_APPEAR_EASE = 0.1;
const GRID_COLOR_VAR = 20;

function computeGridCapacity(tier) {
  return Math.ceil((tier + 1) * GRID_PARTICLES_PER_TIER / GRID_MAX_FILL);
}

function computeGridLayout(capacity, aspect) {
  const cols = Math.max(1, Math.round(Math.sqrt(capacity * aspect)));
  const rows = Math.max(1, Math.ceil(capacity / cols));
  return { cols, rows, capacity: cols * rows };
}

function particleGridSeed(index) {
  return index * 17.341 + 0.73;
}

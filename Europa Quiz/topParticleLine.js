// A line of wandering particles that runs around the whole screen.
//
// Exit: white mask canvas on top punches shrinking holes (destination-out)
// that follow each particle while it keeps moving.

const TOP_LINE_DEFAULT_COLORS = PARTICLE_PALETTE_ALL;

const TOP_LINE_BLOB_FIGMA = 480;

const TOP_LINE_MASK_SHRINK_MS = 1300;
const TOP_LINE_MASK_STAGGER_MS = 420;
const TOP_LINE_TEXT_EXIT_DELAY_MS = 320;
const TOP_LINE_TEXT_EXIT_MS = 680;
const TOP_LINE_MASK_BG = '#ffffff';

const TOP_LINE_APPEAR_EASE = 0.1;
const TOP_LINE_APPEAR_STAGGER_MS = 60;

function topLineColors() {
  const palette = (typeof getAvailableParticles === 'function'
    ? getAvailableParticles()
    : []
  ).map((p) => p?.color).filter(Boolean);
  return palette.length ? palette : TOP_LINE_DEFAULT_COLORS;
}

function maskShrinkEase(t) {
  const x = Math.max(0, Math.min(1, t));
  // Cosine ease-in-out — slow start and end, no abrupt acceleration.
  return 0.5 - Math.cos(x * Math.PI) / 2;
}

function perimeterPoint(n, w, h) {
  const perim = 2 * (w + h);
  let s = ((n % 1) + 1) % 1 * perim;
  if (s < w) return { x: s, y: 0 };
  s -= w;
  if (s < h) return { x: w, y: s };
  s -= h;
  if (s < w) return { x: w - s, y: h };
  s -= w;
  return { x: 0, y: h - s };
}

function createTopParticleLine(screen, options = {}) {
  const colors = options.colors ?? PARTICLE_PALETTE_ALL;
  const count = options.count ?? Math.max(20, colors.length);

  const wrap = document.createElement('div');
  wrap.className = 'figma-particle-line';
  wrap.setAttribute('data-stage-transition-exempt', '');
  applyPos(wrap, 0, 0, FIGMA_W, FIGMA_H);

  const drawCanvas = document.createElement('canvas');
  drawCanvas.className = 'figma-particle-line__draw';
  drawCanvas.setAttribute('aria-hidden', 'true');

  const maskCanvas = document.createElement('canvas');
  maskCanvas.className = 'figma-particle-line__mask';
  maskCanvas.setAttribute('aria-hidden', 'true');

  wrap.appendChild(drawCanvas);
  wrap.appendChild(maskCanvas);
  screen.appendChild(wrap);

  const ctx = drawCanvas.getContext('2d', { alpha: true });
  const maskCtx = maskCanvas.getContext('2d', { alpha: true });
  const speed = 0.04;
  const fade = IDLE_PARTICLE_TRAIL.fade;
  const grav = 0.5;
  const colorVar = 20;
  const trailCull = IDLE_PARTICLE_TRAIL.trailCull;
  const trailCullEvery = IDLE_PARTICLE_TRAIL.cullEvery;
  const jitter = 0;
  const strokeAlpha = 100;
  const noiseForce = 2.2;

  const impulseStore = createImpulseStore();
  let interactionCfg = scaleInteractionForWidth(1);

  let running = true;
  let rafId = 0;
  let pxW = 0;
  let pxH = 0;
  let dpr = 1;
  let frame = 0;
  let proceeding = false;
  let fadingOut = false;
  let fadeOutStart = 0;
  let onProceedComplete = null;
  let maxFadeDelay = 0;
  let maxMaskRadius = 0;

  const createdAt = performance.now();
  const appearOrder = Array.from({ length: count }, (_, i) => i);
  for (let i = appearOrder.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [appearOrder[i], appearOrder[j]] = [appearOrder[j], appearOrder[i]];
  }
  const particles = [];
  for (let i = 0; i < count; i++) {
    const baseRgb = hexToRgb(colors[i % colors.length]);
    particles.push({
      baseHsb: rgbToHsb(baseRgb.r, baseRgb.g, baseRgb.b),
      seed: Math.random() * 1000,
      homeN: (i + 0.5) / count,
      pos: { x: 0, y: 0 },
      vel: { x: 0, y: 0 },
      render: { x: 0, y: 0 },
      prevRender: { x: 0, y: 0 },
      appear: 0,
      appearDelay: appearOrder[i] * TOP_LINE_APPEAR_STAGGER_MS,
      fadeOutDelay: 0,
      started: false
    });
  }

  function computeMaxMaskRadius() {
    const lineWidth = TOP_LINE_BLOB_FIGMA * (pxW / FIGMA_W);
    return lineWidth * 2.4 + 110;
  }

  function resizeCanvas() {
    if (fadingOut) return;

    const rect = wrap.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    pxW = Math.max(1, Math.round(rect.width * dpr));
    pxH = Math.max(1, Math.round(rect.height * dpr));
    drawCanvas.width = pxW;
    drawCanvas.height = pxH;
    maskCanvas.width = pxW;
    maskCanvas.height = pxH;
    interactionCfg = scaleInteractionForWidth(pxW);
    maxMaskRadius = computeMaxMaskRadius();

    for (const p of particles) {
      if (p.started) continue;
      const home = perimeterPoint(p.homeN, pxW, pxH);
      const spread = 0.1 + Math.random() * 0.25;
      const sx = home.x + (pxW * 0.5 - home.x) * spread;
      const sy = home.y + (pxH * 0.5 - home.y) * spread;
      p.pos.x = sx;
      p.pos.y = sy;
      p.render.x = sx;
      p.render.y = sy;
      p.prevRender.x = sx;
      p.prevRender.y = sy;
      p.started = true;
    }
  }

  const resizeObserver = typeof ResizeObserver !== 'undefined'
    ? new ResizeObserver(() => resizeCanvas())
    : null;
  resizeCanvas();
  if (resizeObserver) resizeObserver.observe(wrap);
  else window.addEventListener('resize', resizeCanvas);

  function beginMaskFadeOut(nowMs) {
    maxMaskRadius = computeMaxMaskRadius();
    fadingOut = true;
    fadeOutStart = nowMs;
    maxFadeDelay = 0;
    maskCanvas.style.display = 'block';

    for (const p of particles) {
      p.fadeOutDelay = Math.random() * TOP_LINE_MASK_STAGGER_MS;
      if (p.fadeOutDelay > maxFadeDelay) maxFadeDelay = p.fadeOutDelay;
    }
  }

  function drawMaskLayer(nowMs) {
    const fadeElapsed = nowMs - fadeOutStart;
    let maskedCount = 0;
    let doneCount = 0;

    maskCtx.setTransform(1, 0, 0, 1, 0, 0);
    maskCtx.globalCompositeOperation = 'source-over';
    maskCtx.fillStyle = TOP_LINE_MASK_BG;
    maskCtx.fillRect(0, 0, pxW, pxH);
    maskCtx.globalCompositeOperation = 'destination-out';

    for (const p of particles) {
      const appeared = nowMs - createdAt >= p.appearDelay;
      if (!appeared) continue;
      maskedCount++;

      const maskElapsed = fadeElapsed - p.fadeOutDelay;
      let holeR = maxMaskRadius;
      if (maskElapsed > 0) {
        const maskT = Math.min(1, maskElapsed / TOP_LINE_MASK_SHRINK_MS);
        if (maskT >= 1) doneCount++;
        holeR = maxMaskRadius * (1 - maskShrinkEase(maskT));
      }

      if (holeR <= 0.5) continue;

      maskCtx.beginPath();
      maskCtx.arc(p.render.x, p.render.y, holeR, 0, Math.PI * 2);
      maskCtx.fill();
    }

    maskCtx.globalCompositeOperation = 'source-over';

    const minElapsed = maxFadeDelay + TOP_LINE_MASK_SHRINK_MS;
    const allMaskedOut = maskedCount === 0
      ? fadeElapsed >= minElapsed
      : doneCount === maskedCount && fadeElapsed >= minElapsed;

    return { allMaskedOut, fadeElapsed };
  }

  function step(nowMs) {
    if (!running || !ctx || pxW < 1 || pxH < 1) return;

    pruneInteractionImpulses(nowMs, impulseStore.impulses, interactionCfg);

    const t = nowMs * 0.00004;
    const wanderR = Math.min(pxW, pxH) * 0.3;
    const velLerp = 0.06;
    const renderEase = 0.12;
    const speedScale = speed * Math.min(pxW, pxH) * 0.015;
    const lineWidth = TOP_LINE_BLOB_FIGMA * (pxW / FIGMA_W);

    fadeTrails(ctx, pxW, pxH, fade);
    if (trailCull > 0 && frame % trailCullEvery === 0) cullFaintTrails(ctx, pxW, pxH, trailCull);
    frame++;

    for (const p of particles) {
      const appeared = nowMs - createdAt >= p.appearDelay;
      if (appeared && p.appear < 1) {
        p.appear += (1 - p.appear) * TOP_LINE_APPEAR_EASE;
      }

      if (!appeared) continue;

      const home = perimeterPoint(p.homeN, pxW, pxH);
      const cx = home.x;
      const cy = home.y;

      const flowAngle = Math.sin(t * 0.55 + p.seed) * Math.PI * 2
        + Math.cos(t * 0.3 + p.seed * 1.7) * 1.4;
      const flowX = Math.cos(flowAngle) * noiseForce;
      const flowY = Math.sin(flowAngle) * noiseForce;

      const dx = cx - p.pos.x;
      const dy = cy - p.pos.y;
      const dist = Math.hypot(dx, dy) || 0.001;
      const pull = grav * Math.min(1, dist / wanderR) * 0.12;

      const force = {
        x: flowX + (dx / dist) * pull,
        y: flowY + (dy / dist) * pull
      };
      addGeneratorInteractionForce(
        force, p.pos.x, p.pos.y, nowMs,
        impulseStore.impulses, interactionCfg, impulseStore.enabled
      );
      p.vel.x = p.vel.x * (1 - velLerp) + force.x * velLerp;
      p.vel.y = p.vel.y * (1 - velLerp) + force.y * velLerp;

      p.pos.x += p.vel.x * speedScale + (Math.random() - 0.5) * jitter * pxW;
      p.pos.y += p.vel.y * speedScale + (Math.random() - 0.5) * jitter * pxH;

      if (dist > wanderR) {
        const excess = (dist - wanderR) / wanderR;
        p.vel.x += (dx / dist) * excess * 0.025;
        p.vel.y += (dy / dist) * excess * 0.025;
      }

      p.prevRender.x = p.render.x;
      p.prevRender.y = p.render.y;
      p.render.x += (p.pos.x - p.render.x) * renderEase;
      p.render.y += (p.pos.y - p.render.y) * renderEase;

      const varied = applyColorVariance(p.baseHsb, colorVar, t + p.seed);
      const rgb = hsbToRgb(varied.h, varied.s, varied.b);
      const sizeScale = 0.35 + 0.65 * p.appear;
      ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${(strokeAlpha / 100) * p.appear})`;
      ctx.lineWidth = lineWidth * sizeScale;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(p.prevRender.x, p.prevRender.y);
      ctx.lineTo(p.render.x, p.render.y);
      ctx.stroke();
    }

    if (fadingOut) {
      const { allMaskedOut } = drawMaskLayer(nowMs);
      if (allMaskedOut && onProceedComplete) {
        const cb = onProceedComplete;
        onProceedComplete = null;
        cb();
      }
    }
  }

  function loop(nowMs) {
    if (!running) return;
    step(nowMs);
    rafId = requestAnimationFrame(loop);
  }
  rafId = requestAnimationFrame(loop);

  function proceedWithImpulse(origin, onComplete) {
    if (typeof origin === 'function') {
      onComplete = origin;
      origin = null;
    }
    if (proceeding) return;
    proceeding = true;
    const nowMs = performance.now();
    onProceedComplete = typeof onComplete === 'function' ? onComplete : null;

    let cx = pxW * 0.5;
    let cy = pxH * 0.5;
    if (origin && origin.clientX != null && origin.clientY != null) {
      const local = clientToLocalPx(wrap, origin.clientX, origin.clientY, dpr);
      cx = local.x;
      cy = local.y;
    }

    impulseStore.impulses.length = 0;
    pushImpulse(impulseStore, cx, cy, nowMs, 1);
    beginMaskFadeOut(nowMs);
  }

  function cleanup() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    if (resizeObserver) resizeObserver.disconnect();
    else window.removeEventListener('resize', resizeCanvas);
    wrap.remove();
  }

  return { el: wrap, proceedWithImpulse, cleanup };
}

function addTopParticleLine(screen, options = {}) {
  const line = createTopParticleLine(screen, options);
  if (!screen._particleCleanups) screen._particleCleanups = [];
  screen._particleCleanups.push(line.cleanup);
  return line;
}

window.TOP_LINE_TEXT_EXIT_DELAY_MS = TOP_LINE_TEXT_EXIT_DELAY_MS;
window.TOP_LINE_TEXT_EXIT_MS = TOP_LINE_TEXT_EXIT_MS;

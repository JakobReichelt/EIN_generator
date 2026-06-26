const QUIZ_INTERACTION = {
  durationMs: 2000,
  radius: 170,
  maxForce: 15.0,
  maxImpulses: 10
};

function _smoothstep01(t) {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

function scaleInteractionForWidth(widthPx) {
  return {
    ...QUIZ_INTERACTION,
    radius: QUIZ_INTERACTION.radius * (widthPx / 1920)
  };
}

function createImpulseStore() {
  return { impulses: [], enabled: true };
}

function pushImpulse(store, x, y, nowMs, maxImpulses) {
  if (!store?.enabled) return;
  if (!Array.isArray(store.impulses)) store.impulses = [];
  store.impulses.push({ x, y, startMs: nowMs });
  const cap = Math.max(1, (maxImpulses ?? QUIZ_INTERACTION.maxImpulses) | 0);
  if (store.impulses.length > cap) {
    store.impulses.splice(0, store.impulses.length - cap);
  }
}

function pruneInteractionImpulses(nowMs, impulses, cfg) {
  if (!impulses?.length) return;
  const dur = Math.max(1, (cfg?.durationMs ?? QUIZ_INTERACTION.durationMs) | 0);
  let write = 0;
  for (let i = 0; i < impulses.length; i++) {
    const imp = impulses[i];
    const age = nowMs - (+imp.startMs || 0);
    if (age >= 0 && age < dur) impulses[write++] = imp;
  }
  impulses.length = write;
}

// Ported from Generator/particle.js addInteractionForce
function addGeneratorInteractionForce(out, x, y, nowMs, impulses, cfg, enabled) {
  if (!out) return;
  try {
    if (!enabled) return;
    if (!Array.isArray(impulses) || impulses.length === 0) return;

    const dur = Math.max(1, (cfg?.durationMs ?? 2000) | 0);
    const radius = Math.max(1e-3, +(cfg?.radius) || 170);
    const maxForce = Math.max(0, +(cfg?.maxForce) || 0);
    if (maxForce <= 0) return;

    let fx = 0;
    let fy = 0;

    for (let i = 0; i < impulses.length; i++) {
      const imp = impulses[i];
      if (!imp) continue;

      const age = nowMs - (+imp.startMs || 0);
      if (age < 0 || age >= dur) continue;

      const t = age / dur;
      const remaining = 1 - t;
      const timeAmp = _smoothstep01(remaining);

      let dx = x - (+imp.x || 0);
      let dy = y - (+imp.y || 0);
      let d2 = dx * dx + dy * dy;

      if (d2 < 1e-10) {
        const a = Math.random() * Math.PI * 2;
        dx = Math.cos(a);
        dy = Math.sin(a);
        d2 = 1;
      }

      const d = Math.sqrt(d2);
      if (d >= radius) continue;
      const u = d / radius;
      const distAmp = 1 - _smoothstep01(u);
      const mag = maxForce * timeAmp * distAmp;

      const invD = 1 / d;
      fx += dx * invD * mag;
      fy += dy * invD * mag;
    }

    if (fx !== 0 || fy !== 0) {
      out.x += fx;
      out.y += fy;
    }
  } catch { /* ignore */ }
}

// Ported from Visualizer/particle.js addInteractionForceTo
function addVisualizerInteractionForce(out, x, y, nowMs, impulses, cfg, enabled) {
  if (!out) return;
  try {
    if (!enabled) return;
    if (!Array.isArray(impulses) || impulses.length === 0) return;
    const dur = Math.max(1, (cfg?.durationMs ?? 2000) | 0);
    const radius = Math.max(1e-3, +(cfg?.radius) || 170);
    const maxForce = Math.max(0, +(cfg?.maxForce) || 0);
    if (maxForce <= 0) return;
    let fx = 0;
    let fy = 0;
    for (let i = 0; i < impulses.length; i++) {
      const imp = impulses[i];
      if (!imp) continue;
      const age = nowMs - (+imp.startMs || 0);
      if (age < 0 || age >= dur) continue;
      const remaining = 1 - age / dur;
      const timeAmp = _smoothstep01(remaining);
      let dx = x - (+imp.x || 0);
      let dy = y - (+imp.y || 0);
      let d2 = dx * dx + dy * dy;
      if (d2 < 1e-10) {
        const ang = Math.random() * Math.PI * 2;
        dx = Math.cos(ang);
        dy = Math.sin(ang);
        d2 = 1;
      }
      const d = Math.sqrt(d2);
      if (d >= radius) continue;
      const mag = maxForce * timeAmp * (1 - _smoothstep01(d / radius));
      fx += (dx / d) * mag;
      fy += (dy / d) * mag;
    }
    out.x += fx;
    out.y += fy;
  } catch { /* ignore */ }
}

function clientToLocalPx(element, clientX, clientY, dpr) {
  const rect = element.getBoundingClientRect();
  const scale = dpr ?? Math.min(window.devicePixelRatio || 1, 2);
  if (rect.width <= 0 || rect.height <= 0) return { x: 0, y: 0 };
  return {
    x: ((clientX - rect.left) / rect.width) * rect.width * scale,
    y: ((clientY - rect.top) / rect.height) * rect.height * scale
  };
}

function clientToFigma(screen, clientX, clientY) {
  const rect = screen.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return { x: 0, y: 0 };
  const figmaW = typeof FIGMA_W !== 'undefined' ? FIGMA_W : 3840;
  const figmaH = typeof FIGMA_H !== 'undefined' ? FIGMA_H : 2160;
  return {
    x: ((clientX - rect.left) / rect.width) * figmaW,
    y: ((clientY - rect.top) / rect.height) * figmaH
  };
}

// Visualizer play-mode physics (Visualizer/config.js + VizParticle.step).
const VIZ_PLAY = {
  flow: { scale: 0.0022, timeScale: 0.00016, strength: 0.35, curl: 0.6 },
  particles: { speed: 0.2, jitter: 0.008 },
  visualizer: { springStrength: 0.14, swayAmplitude: 0.55, swayFrequency: 0.0018 },
  separation: { enabled: true, minDist: 2.0, maxPush: 0.5 },
  velLerp: 0.22
};

const _vizFlowScratch = { x: 0, y: 0 };

function vizNoise(x, y, z) {
  if (typeof noise === 'function') return noise(x, y, z ?? 0);
  const s = Math.sin(x * 12.9898 + y * 78.233 + (z ?? 0) * 37.719) * 43758.5453;
  return s - Math.floor(s);
}

// Ported from Visualizer/particle.js flowVectorInto
function flowVectorInto(out, x, y, tMs, biasAngle) {
  const s = VIZ_PLAY.flow.scale;
  const tt = tMs * VIZ_PLAY.flow.timeScale;
  const e = 0.55;
  const nx = x * s;
  const ny = y * s;
  const dx = vizNoise(nx + e * s, ny, tt) - vizNoise(nx - e * s, ny, tt);
  const dy = vizNoise(nx, ny + e * s, tt) - vizNoise(nx, ny - e * s, tt);
  let vx = -dy;
  let vy = dx;
  const m = VIZ_PLAY.flow.strength * 3.0;
  const magSq = vx * vx + vy * vy;
  if (magSq > 0.000001) {
    const mag = m / Math.sqrt(magSq);
    vx *= mag;
    vy *= mag;
  }
  const a = Math.PI * 2 * vizNoise(nx * 0.75, ny * 0.75, tt) + biasAngle;
  const curlMix = 0.28 * VIZ_PLAY.flow.curl;
  const ax = Math.cos(a) * m * 0.5;
  const ay = Math.sin(a) * m * 0.5;
  out.x = vx + (ax - vx) * curlMix;
  out.y = vy + (ay - vy) * curlMix;
}

// Ported from Visualizer/particle.js VizParticle.step
function stepVisualizerPlayParticle(p, ctx) {
  flowVectorInto(_vizFlowScratch, p.posX, p.posY, ctx.tNow, p.biasAngle);
  let vx = _vizFlowScratch.x;
  let vy = _vizFlowScratch.y;

  _vizFlowScratch.x = vx;
  _vizFlowScratch.y = vy;
  addVisualizerInteractionForce(
    _vizFlowScratch, p.posX, p.posY, ctx.tNow,
    ctx.impulses, ctx.interactionCfg, ctx.interactionEnabled
  );
  vx = _vizFlowScratch.x;
  vy = _vizFlowScratch.y;

  vx += (ctx.tx - p.posX) * VIZ_PLAY.visualizer.springStrength;
  vy += (ctx.ty - p.posY) * VIZ_PLAY.visualizer.springStrength;

  const swayT = ctx.tNow * VIZ_PLAY.visualizer.swayFrequency + p.swaySeed;
  vx += Math.sin(swayT) * VIZ_PLAY.visualizer.swayAmplitude;
  vy += Math.cos(swayT * 0.93 + p.swaySeed * 1.7) * VIZ_PLAY.visualizer.swayAmplitude;

  p.velX += (vx - p.velX) * VIZ_PLAY.velLerp;
  p.velY += (vy - p.velY) * VIZ_PLAY.velLerp;

  const sp = VIZ_PLAY.particles.speed;
  const jit = VIZ_PLAY.particles.jitter;
  p.posX += p.velX * sp + (Math.random() * 2 - 1) * jit;
  p.posY += p.velY * sp + (Math.random() * 2 - 1) * jit;
}

// Ported from Visualizer/particle.js applyParticleSeparation (simplified for flat arrays).
function applyVizParticleSeparation(particles, visible) {
  const sepCfg = VIZ_PLAY.separation;
  if (!sepCfg?.enabled) return;
  const minDist = Math.max(0.1, +sepCfg.minDist || 0);
  const maxPush = Math.max(0, +sepCfg.maxPush || 0);
  const minDistSq = minDist * minDist;
  const cellSize = minDist;

  const active = [];
  for (let i = 0; i < particles.length; i++) {
    if (visible[i]) active.push(i);
  }
  if (active.length < 2) return;

  let maxX = 0;
  let maxY = 0;
  for (const i of active) {
    const p = particles[i];
    if (p.posX > maxX) maxX = p.posX;
    if (p.posY > maxY) maxY = p.posY;
  }
  const cols = Math.max(1, Math.ceil((maxX + cellSize) / cellSize));
  const rows = Math.max(1, Math.ceil((maxY + cellSize) / cellSize));
  const head = new Int32Array(cols * rows);
  const next = new Int32Array(active.length);
  head.fill(-1);

  for (let ai = 0; ai < active.length; ai++) {
    const p = particles[active[ai]];
    const cx = Math.min(cols - 1, Math.max(0, Math.floor(p.posX / cellSize)));
    const cy = Math.min(rows - 1, Math.max(0, Math.floor(p.posY / cellSize)));
    const idx = cy * cols + cx;
    next[ai] = head[idx];
    head[idx] = ai;
  }

  for (let ai = 0; ai < active.length; ai++) {
    const pi = particles[active[ai]];
    const cx = Math.min(cols - 1, Math.max(0, Math.floor(pi.posX / cellSize)));
    const cy = Math.min(rows - 1, Math.max(0, Math.floor(pi.posY / cellSize)));
    for (let oy = -1; oy <= 1; oy++) {
      const ny = cy + oy;
      if (ny < 0 || ny >= rows) continue;
      for (let ox = -1; ox <= 1; ox++) {
        const nx = cx + ox;
        if (nx < 0 || nx >= cols) continue;
        let j = head[ny * cols + nx];
        while (j !== -1) {
          if (j > ai) {
            const pj = particles[active[j]];
            const dx = pi.posX - pj.posX;
            const dy = pi.posY - pj.posY;
            const d2 = dx * dx + dy * dy;
            if (d2 > 0 && d2 < minDistSq) {
              const d = Math.sqrt(d2);
              const push = Math.min(maxPush, (minDist - d) * 0.5) / d;
              pi.posX += dx * push;
              pi.posY += dy * push;
              pj.posX -= dx * push;
              pj.posY -= dy * push;
            }
          }
          j = next[j];
        }
      }
    }
  }
}

function resetVizParticlePhysics(p) {
  p.posX = null;
  p.posY = null;
  p.velX = 0;
  p.velY = 0;
}

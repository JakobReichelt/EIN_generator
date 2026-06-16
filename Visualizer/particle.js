const _flowScratch = { x: 0, y: 0 };
const _pullScratch = { x: 0, y: 0 };

function flowVectorInto(out, x, y, tMs, biasAngle) {
  const s = CONFIG.flow.scale;
  const tt = tMs * CONFIG.flow.timeScale;
  const e = 0.55;
  const nx = x * s;
  const ny = y * s;
  const dx = noise(nx + e * s, ny, tt) - noise(nx - e * s, ny, tt);
  const dy = noise(nx, ny + e * s, tt) - noise(nx, ny - e * s, tt);
  let vx = -dy;
  let vy = dx;
  const m = CONFIG.flow.strength * 3.0;
  const magSq = vx * vx + vy * vy;
  if (magSq > 0.000001) {
    const mag = m / Math.sqrt(magSq);
    vx *= mag;
    vy *= mag;
  }
  const a = TWO_PI * noise(nx * 0.75, ny * 0.75, tt) + biasAngle;
  const curlMix = 0.28 * CONFIG.flow.curl;
  const ax = Math.cos(a) * m * 0.5;
  const ay = Math.sin(a) * m * 0.5;
  out.x = vx + (ax - vx) * curlMix;
  out.y = vy + (ay - vy) * curlMix;
}

function _smoothstep01(t) {
  const x = constrain(t, 0, 1);
  return x * x * (3 - 2 * x);
}

function addInteractionForceTo(out, x, y, nowMs) {
  if (!out) return;
  try {
    if (!interactionEnabled) return;
    if (!Array.isArray(interactionImpulses) || interactionImpulses.length === 0) return;
    const cfg = CONFIG.interaction;
    const dur = Math.max(1, cfg.durationMs | 0);
    const radius = Math.max(1e-3, +cfg.radius || 170);
    const maxForce = Math.max(0, +cfg.maxForce || 0);
    if (maxForce <= 0) return;
    let fx = 0;
    let fy = 0;
    for (let i = 0; i < interactionImpulses.length; i++) {
      const imp = interactionImpulses[i];
      if (!imp) continue;
      const age = nowMs - (+imp.startMs || 0);
      if (age < 0 || age >= dur) continue;
      const remaining = 1 - age / dur;
      const timeAmp = _smoothstep01(remaining);
      let dx = x - (+imp.x || 0);
      let dy = y - (+imp.y || 0);
      let d2 = dx * dx + dy * dy;
      if (d2 < 1e-10) {
        const ang = random(TWO_PI);
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

function buildPlayStepContext(blendT, transitioning, nowMs) {
  const attractor = getBlendedAttractorField(blendT);
  const targetByCluster = ensureClusterTargetCache(blendT);
  return {
    tNow: nowMs,
    springK: CONFIG.visualizer.springStrength * (transitioning ? 1.35 : 1),
    speed: getParticleSpeed(),
    grav: getGravitationStrength(),
    jitter: CONFIG.particles.jitter,
    swayAmp: CONFIG.visualizer.swayAmplitude,
    swayFreq: CONFIG.visualizer.swayFrequency,
    attractor,
    targetByCluster
  };
}

function buildPlayDrawContext() {
  return {
    sa: getParticleStackAlpha(),
    sw: getParticleStrokeWeight(),
    cv: getColorVariance(),
    mix: getParticleMix(),
    trailMix: getTrailToBackgroundMix(),
    palette: colorTool?.particlePaletteHSB ?? null,
    bg: colorTool?.backgroundHSB ?? { h: 0, s: 0, b: 100 }
  };
}

class VizParticle {
  constructor(cluster, unitIndex, worldPos) {
    this.clusterId = cluster.id;
    this.unitIndex = unitIndex;
    this.zLayer = random();
    this.biasAngle = random(-0.12, 0.12);
    this.swaySeed = random(TWO_PI);
    this.h = random(205, 228);
    this.s = random(65, 100);
    this.b = random(30, 65);
    this.hOff = random(-7, 7);
    this.sOff = random(-10, 10);
    this.bOff = random(-12, 12);
    this.paletteSlot = -1;
    this.pos = createVector(worldPos.x, worldPos.y);
    this.prev = this.pos.copy();
    this.vel = createVector(0, 0);
    this.age = 0;
    this.pickPaletteSlot();
  }

  pickPaletteSlot() {
    try {
      const palette = colorTool?.particlePaletteHSB ?? null;
      if (!palette) {
        this.paletteSlot = -1;
        return;
      }
      const active = [];
      for (let i = 0; i < palette.length; i++) if (palette[i]) active.push(i);
      if (active.length === 0) {
        this.paletteSlot = -1;
        return;
      }
      this.paletteSlot = active[(random(active.length)) | 0];
    } catch {
      this.paletteSlot = -1;
    }
  }

  step(ctx) {
    this.prev.set(this.pos);
    const targets = ctx.targetByCluster.get(this.clusterId);
    let tx = this.pos.x;
    let ty = this.pos.y;
    if (targets) {
      const ti = this.unitIndex * 2;
      tx = targets[ti];
      ty = targets[ti + 1];
    }

    flowVectorInto(_flowScratch, this.pos.x, this.pos.y, ctx.tNow, this.biasAngle);
    let vx = _flowScratch.x;
    let vy = _flowScratch.y;

    if (sampleAttractorInto(ctx.attractor, this.pos.x, this.pos.y, _pullScratch)) {
      const g = ctx.grav;
      vx += _pullScratch.x * g;
      vy += _pullScratch.y * g;
    }

    _flowScratch.x = vx;
    _flowScratch.y = vy;
    addInteractionForceTo(_flowScratch, this.pos.x, this.pos.y, ctx.tNow);
    vx = _flowScratch.x;
    vy = _flowScratch.y;

    vx += (tx - this.pos.x) * ctx.springK;
    vy += (ty - this.pos.y) * ctx.springK;

    const swayT = ctx.tNow * ctx.swayFreq + this.swaySeed;
    vx += Math.sin(swayT) * ctx.swayAmp;
    vy += Math.cos(swayT * 0.93 + this.swaySeed * 1.7) * ctx.swayAmp;

    this.vel.x += (vx - this.vel.x) * 0.22;
    this.vel.y += (vy - this.vel.y) * 0.22;

    const sp = ctx.speed;
    this.pos.x += this.vel.x * sp + random(-1, 1) * ctx.jitter;
    this.pos.y += this.vel.y * sp + random(-1, 1) * ctx.jitter;
    this.age++;
  }

  snapToBlend(blendT) {
    const targets = ensureClusterTargetCache(blendT).get(this.clusterId);
    if (targets) {
      const ti = this.unitIndex * 2;
      this.pos.set(targets[ti], targets[ti + 1]);
    }
    this.prev.set(this.pos.x, this.pos.y);
    this.vel.set(0, 0);
  }

  draw(drawCtx, surf, visibility = 1) {
    if (visibility <= 0.001) return;
    let selected = null;
    try {
      const palette = drawCtx.palette;
      if (palette) {
        if (this.paletteSlot >= 0 && this.paletteSlot < palette.length) selected = palette[this.paletteSlot] ?? null;
        if (!selected) for (let i = 0; i < palette.length; i++) if (palette[i]) { selected = palette[i]; break; }
      }
    } catch { selected = null; }

    let h = this.h;
    let s = this.s;
    let b = this.b;
    if (selected) {
      const cv = drawCtx.cv;
      const th = (selected.h + this.hOff * cv + 360) % 360;
      const ts = constrain(selected.s + this.sOff * cv, 0, 100);
      const tb = constrain(selected.b + this.bOff * cv, 0, 100);
      ({ h, s, b } = mixHsbShortest({ h, s, b }, { h: th, s: ts, b: tb }, drawCtx.mix));
    }
    const trailMix = drawCtx.trailMix;
    if (trailMix > 0) {
      ({ h, s, b } = mixHsbShortest({ h, s, b }, drawCtx.bg, trailMix));
    }

    const drawAlpha = drawCtx.sa * visibility;

    if (surf) {
      surf.stroke(h, s, b, drawAlpha);
      surf.line(this.prev.x, this.prev.y, this.pos.x, this.pos.y);
    } else {
      stroke(h, s, b, drawAlpha);
      line(this.prev.x, this.prev.y, this.pos.x, this.pos.y);
    }
  }
}

function getParticleStackAlpha() {
  const baseAlpha = constrain(+CONFIG.particles.strokeAlpha || 0, 0, 100);
  const visibility = typeof getParticleOverlapVisibility === 'function'
    ? constrain(+getParticleOverlapVisibility() || 0, 0, 100)
    : constrain(+CONFIG.particles.overlapVisibility || 100, 0, 100);
  const t = visibility / 100;
  return 100 + (baseAlpha - 100) * t;
}

function applyParticleSeparation(ps, blendT = getSituationBlendT()) {
  const sepCfg = CONFIG.particles.separation;
  if (!sepCfg?.enabled) return;
  const maxParticles = CONFIG.visualizer.separationMaxParticles ?? 3000;
  if (ps.length > maxParticles) return;

  const minDist = Math.max(0.1, +sepCfg.minDist || 0);
  const maxPush = Math.max(0, +sepCfg.maxPush || 0);
  const cellSize = minDist;
  const cols = Math.max(1, Math.ceil(width / cellSize));
  const rows = Math.max(1, Math.ceil(height / cellSize));
  if (!separationGrid || separationGrid.cellSize !== cellSize || separationGrid.cols !== cols || separationGrid.rows !== rows || separationGrid.next.length < ps.length) {
    separationGrid = { cellSize, cols, rows, head: new Int32Array(cols * rows), next: new Int32Array(ps.length) };
  }
  const { head, next } = separationGrid;
  head.fill(-1);
  for (let i = 0; i < ps.length; i++) {
    if (getPlayParticleVisibility(ps[i], blendT) <= 0.001) continue;
    const p = ps[i];
    const cx = Math.min(cols - 1, Math.max(0, Math.floor(p.pos.x / cellSize)));
    const cy = Math.min(rows - 1, Math.max(0, Math.floor(p.pos.y / cellSize)));
    const idx = cy * cols + cx;
    next[i] = head[idx];
    head[idx] = i;
  }
  const minDistSq = minDist * minDist;
  for (let i = 0; i < ps.length; i++) {
    if (getPlayParticleVisibility(ps[i], blendT) <= 0.001) continue;
    const pi = ps[i];
    const cx = Math.min(cols - 1, Math.max(0, Math.floor(pi.pos.x / cellSize)));
    const cy = Math.min(rows - 1, Math.max(0, Math.floor(pi.pos.y / cellSize)));
    for (let oy = -1; oy <= 1; oy++) {
      const ny = cy + oy;
      if (ny < 0 || ny >= rows) continue;
      for (let ox = -1; ox <= 1; ox++) {
        const nx = cx + ox;
        if (nx < 0 || nx >= cols) continue;
        let j = head[ny * cols + nx];
        while (j !== -1) {
          if (j > i) {
            if (getPlayParticleVisibility(ps[j], blendT) <= 0.001) {
              j = next[j];
              continue;
            }
            const pj = ps[j];
            const dx = pi.pos.x - pj.pos.x;
            const dy = pi.pos.y - pj.pos.y;
            const d2 = dx * dx + dy * dy;
            if (d2 > 0 && d2 < minDistSq) {
              const d = Math.sqrt(d2);
              const push = Math.min(maxPush, (minDist - d) * 0.5) / d;
              pi.pos.x += dx * push;
              pi.pos.y += dy * push;
              pj.pos.x -= dx * push;
              pj.pos.y -= dy * push;
            }
          }
          j = next[j];
        }
      }
    }
  }
}

function getTotalClusterParticleCount() {
  let n = 0;
  for (const c of clusters) n += getClusterMaxParticleCount(c);
  return n;
}

function getPlayParticleVisibility(p, blendT) {
  const cluster = getClusterById(p.clusterId);
  if (!cluster) return 1;
  return getParticleSituationVisibility(cluster, p.unitIndex, blendT);
}

/** Stub for Generator ui.js dev sliders — visualizer particles come from clusters, not adaptive count. */
function getAdaptiveParticleCount(strokeWeight = getParticleStrokeWeight()) {
  const current = Array.isArray(particles) && particles.length
    ? particles.length
    : getTotalClusterParticleCount();
  return Math.max(1, current);
}

function syncParticleCountToSize() {
  // Visualizer manages particles via clusters / rebuildPlayParticles.
}

function syncParticleCountGradual(maxDelta = 100) {
  return true;
}

function syncPlayParticlePool(blendT) {
  const t = constrain(blendT ?? getSituationBlendT(), 0, 1);
  const targetCache = ensureClusterTargetCache(t);
  const byCluster = new Map();
  for (const p of particles) {
    if (!byCluster.has(p.clusterId)) byCluster.set(p.clusterId, []);
    byCluster.get(p.clusterId).push(p);
  }
  const next = [];
  for (const cluster of clusters) {
    const maxN = getClusterMaxParticleCount(cluster);
    const list = (byCluster.get(cluster.id) || []).sort((a, b) => a.unitIndex - b.unitIndex);
    const byIndex = new Map(list.map((p) => [p.unitIndex, p]));
    const targets = targetCache.get(cluster.id);
    for (let unitIndex = 0; unitIndex < maxN; unitIndex++) {
      let p = byIndex.get(unitIndex);
      if (!p) {
        const ti = unitIndex * 2;
        const x = targets ? targets[ti] : 0;
        const y = targets ? targets[ti + 1] : 0;
        p = new VizParticle(cluster, unitIndex, { x, y });
      }
      next.push(p);
    }
  }
  particles = next;
  markVizSimDirty();
}

function rebuildPlayParticles(blendT) {
  const t = constrain(blendT ?? getSituationBlendT(), 0, 1);
  const targetCache = ensureClusterTargetCache(t);
  particles = [];
  for (const cluster of clusters) {
    const maxN = getClusterMaxParticleCount(cluster);
    const targets = targetCache.get(cluster.id);
    for (let unitIndex = 0; unitIndex < maxN; unitIndex++) {
      const ti = unitIndex * 2;
      const x = targets ? targets[ti] : 0;
      const y = targets ? targets[ti + 1] : 0;
      particles.push(new VizParticle(cluster, unitIndex, { x, y }));
    }
  }
  markVizSimDirty();
}

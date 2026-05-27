function flowVector(x, y, tMs, biasAngle) {
  const s = CONFIG.flow.scale, tt = tMs * CONFIG.flow.timeScale, e = 0.55;
  const nx = x * s, ny = y * s;
  
  const dx = noise(nx + e * s, ny, tt) - noise(nx - e * s, ny, tt);
  const dy = noise(nx, ny + e * s, tt) - noise(nx, ny - e * s, tt);
  const v = createVector(-dy, dx);
  const m = CONFIG.flow.strength * 3.0;

  if (v.magSq() > 0.000001) v.setMag(m);
  const a = TWO_PI * noise(nx * 0.75, ny * 0.75, tt) + biasAngle;
  return v.lerp(createVector(cos(a), sin(a)).mult(m * 0.5), 0.28 * CONFIG.flow.curl);
}

function _smoothstep01(t) {
  const x = constrain(t, 0, 1);
  return x * x * (3 - 2 * x);
}

function addInteractionForce(v, x, y, nowMs) {
  if (!v) return;
  try {
    if (typeof interactionEnabled === 'undefined' || !interactionEnabled) return;
    if (!Array.isArray(interactionImpulses) || interactionImpulses.length === 0) return;

    const cfg = CONFIG?.interaction;
    const dur = Math.max(1, (cfg?.durationMs ?? 2000) | 0);
    const radius = Math.max(1e-3, +cfg?.radius || 170);
    const maxForce = Math.max(0, +cfg?.maxForce || 0);
    if (maxForce <= 0) return;

    let fx = 0, fy = 0;

    for (let i = 0; i < interactionImpulses.length; i++) {
      const imp = interactionImpulses[i];
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
        const a = random(TWO_PI);
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
      v.x += fx;
      v.y += fy;
    }
  } catch { /* ignore */ }
}

class Particle {
  constructor(spawnPointsRef) {
    this.spawnPointsRef = spawnPointsRef;
    this.zLayer = random();
    this.biasAngle = random(-0.15, 0.15);
    this.h = random(205, 228); this.s = random(65, 100); this.b = random(30, 65);
    this.hOff = random(-7, 7); this.sOff = random(-10, 10); this.bOff = random(-12, 12);
    this.paletteSlot = -1;
    this.respawn();
  }

  pickPaletteSlot() {
    try {
      const palette = (typeof colorTool !== 'undefined' && colorTool && Array.isArray(colorTool.particlePaletteHSB)) ? colorTool.particlePaletteHSB : null;
      if (!palette) { this.paletteSlot = -1; return; }
      const active = [];
      for (let i = 0; i < palette.length; i++) if (palette[i]) active.push(i);
      if (active.length === 0) { this.paletteSlot = -1; return; }
      this.paletteSlot = active[(random(active.length)) | 0];
    } catch {
      this.paletteSlot = -1;
    }
  }

  respawn() {
    const p = this.spawnPointsRef[random(this.spawnPointsRef.length) | 0];
    this.pos = createVector(p.x, p.y);
    this.prev = this.pos.copy();
    this.vel = createVector(0, 0);
    this.age = 0;
    this.maxAge = CONFIG.particles.maxAge * (0.6 + random(0.8));
    this.pickPaletteSlot();
  }

  step() {
    this.prev.set(this.pos);
    const v = flowVector(this.pos.x, this.pos.y, millis(), this.biasAngle);

    if (attractor) {
      const pull = sampleAttractor(attractor, this.pos.x, this.pos.y);
      if (pull !== null) {
        if (pull.magSq() > 1e-10) v.add(pull.mult(getGravitationStrength()));
      } else {
        const c = getMapCenter(), toC = createVector(c.x - this.pos.x, c.y - this.pos.y);
        const outside = mapPlacement ? this.pos.x < mapPlacement.x || this.pos.y < mapPlacement.y || this.pos.x > mapPlacement.x + mapPlacement.w || this.pos.y > mapPlacement.y + mapPlacement.h : false;
        const k = CONFIG.centerPull.strength * (outside ? CONFIG.centerPull.outsideBoost : 1);
        if (toC.magSq() > 1e-6) toC.setMag(k);
        v.add(toC);
      }
    }

    addInteractionForce(v, this.pos.x, this.pos.y, millis());

    this.vel.lerp(v, 0.22);
    this.pos.add(this.vel.copy().mult(getParticleSpeed())).add(random(-1, 1) * CONFIG.particles.jitter, random(-1, 1) * CONFIG.particles.jitter);
    if (++this.age > this.maxAge || !inBounds(this.pos.x, this.pos.y)) this.respawn();
  }

  draw() {
    let selected = null;
    try {
      const palette = (typeof colorTool !== 'undefined' && colorTool && Array.isArray(colorTool.particlePaletteHSB)) ? colorTool.particlePaletteHSB : null;
      if (palette) {
        if (this.paletteSlot >= 0 && this.paletteSlot < palette.length) selected = palette[this.paletteSlot] ?? null;
        if (!selected) for (let i = 0; i < palette.length; i++) if (palette[i]) { selected = palette[i]; break; }
      }
    } catch { selected = null; }

    let h = this.h, s = this.s, b = this.b;

    if (selected) {
      const cv = typeof getColorVariance === 'function' ? getColorVariance() : 1;
      const th = (selected.h + this.hOff * cv + 360) % 360, ts = constrain(selected.s + this.sOff * cv, 0, 100), tb = constrain(selected.b + this.bOff * cv, 0, 100);
      ({ h, s, b } = mixHsbShortest({ h, s, b }, { h: th, s: ts, b: tb }, getParticleMix()));
    }
    const mix = getTrailToBackgroundMix();
    if (mix > 0) ({ h, s, b } = mixHsbShortest({ h, s, b }, colorTool?.backgroundHSB ?? { h: 0, s: 0, b: 100 }, mix));

    const surf = typeof getTrailDrawSurface === 'function' ? getTrailDrawSurface() : null;
    const sa = getParticleStackAlpha();
    const sw = getParticleStrokeWeight();
    if (surf) {
      surf.stroke(h, s, b, sa);
      surf.strokeWeight(sw);
      surf.line(this.prev.x, this.prev.y, this.pos.x, this.pos.y);
    } else {
      stroke(h, s, b, sa);
      strokeWeight(sw);
      line(this.prev.x, this.prev.y, this.pos.x, this.pos.y);
    }
  }
}

function getParticleStackAlpha() {
  const baseAlpha = constrain(+CONFIG?.particles?.strokeAlpha || 0, 0, 100);
  const visibility = typeof getParticleOverlapVisibility === 'function'
    ? constrain(+getParticleOverlapVisibility() || 0, 0, 100)
    : constrain(+CONFIG?.particles?.overlapVisibility || 100, 0, 100);
  const t = visibility / 100;
  return 100 + (baseAlpha - 100) * t;
}

function applyParticleSeparation(ps) {
  const sepCfg = CONFIG.particles?.separation;
  if (!sepCfg?.enabled) return;

  const minDist = Math.max(0.1, +sepCfg.minDist || 0), maxPush = Math.max(0, +sepCfg.maxPush || 0);
  const cellSize = minDist, cols = Math.max(1, Math.ceil(width / cellSize)), rows = Math.max(1, Math.ceil(height / cellSize));

  if (!separationGrid || separationGrid.cellSize !== cellSize || separationGrid.cols !== cols || separationGrid.rows !== rows || separationGrid.next.length < ps.length) {
    separationGrid = { cellSize, cols, rows, head: new Int32Array(cols * rows), next: new Int32Array(ps.length) };
  }
  const { head, next } = separationGrid;
  head.fill(-1);

  for (let i = 0; i < ps.length; i++) {
    const p = ps[i], cx = Math.min(cols - 1, Math.max(0, Math.floor(p.pos.x / cellSize))), cy = Math.min(rows - 1, Math.max(0, Math.floor(p.pos.y / cellSize)));
    const idx = cy * cols + cx;
    next[i] = head[idx]; head[idx] = i;
  }

  const minDistSq = minDist * minDist;
  for (let i = 0; i < ps.length; i++) {
    const pi = ps[i], cx = Math.min(cols - 1, Math.max(0, Math.floor(pi.pos.x / cellSize))), cy = Math.min(rows - 1, Math.max(0, Math.floor(pi.pos.y / cellSize)));

    for (let oy = -1; oy <= 1; oy++) {
      const ny = cy + oy;
      if (ny < 0 || ny >= rows) continue;
      for (let ox = -1; ox <= 1; ox++) {
        const nx = cx + ox;
        if (nx < 0 || nx >= cols) continue;

        let j = head[ny * cols + nx];
        while (j !== -1) {
          if (j > i) {
            const pj = ps[j], dx = pi.pos.x - pj.pos.x, dy = pi.pos.y - pj.pos.y, d2 = dx * dx + dy * dy;
            if (d2 > 0 && d2 < minDistSq) {
              const d = Math.sqrt(d2), push = Math.min(maxPush, (minDist - d) * 0.5) / d;
              pi.pos.x += dx * push; pi.pos.y += dy * push; pj.pos.x -= dx * push; pj.pos.y -= dy * push;
            } else if (d2 === 0) {
              const a = random(TWO_PI), px = Math.cos(a) * maxPush * 0.5, py = Math.sin(a) * maxPush * 0.5;
              pi.pos.x += px; pi.pos.y += py; pj.pos.x -= px; pj.pos.y -= py;
            }
          }
          j = next[j];
        }
      }
    }
  }
}

function getAdaptiveParticleCount(strokeWeight = getParticleStrokeWeight()) {
  const baseCount = Math.max(0, Math.floor(+CONFIG.particles.count || 0));
  if (baseCount <= 0) return 0;
  const ref = Math.max(0.05, +CONFIG.particles.strokeWeight || 1);
  const w = Math.max(0.05, +strokeWeight || ref);
  return Math.max(Math.min(baseCount, Math.max(1, Math.round(baseCount * 0.01))), Math.min(baseCount, Math.round(baseCount * (ref / w))));
}

function syncParticleCountToSize() {
  if (!Array.isArray(particles) || !spawnPoints?.length) return;
  const target = getAdaptiveParticleCount(), current = particles.length;
  if (current === target) return;
  if (current > target) particles.length = target;
  else for (let i = 0, addNow = Math.min(target - current, 600); i < addNow; i++) particles.push(new Particle(spawnPoints));
}

/** Adds/removes particles in small steps; returns true when count matches target. */
function syncParticleCountGradual(maxDelta = 100) {
  if (!Array.isArray(particles) || !spawnPoints?.length) return true;
  const target = getAdaptiveParticleCount(), current = particles.length;
  if (current === target) return true;
  if (current > target) {
    particles.length = Math.max(target, current - maxDelta);
  } else {
    const addNow = Math.min(target - current, maxDelta);
    for (let i = 0; i < addNow; i++) particles.push(new Particle(spawnPoints));
  }
  return particles.length === target;
}

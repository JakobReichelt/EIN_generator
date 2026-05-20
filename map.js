function setActiveMapImage(path) {
  const candidate = typeof path === 'string' ? path : null;
  if (!candidate || candidate === activeMapImagePath) return;
  activeMapImagePath = candidate;
  const entry = mapImageRegistry.get(candidate);

  if (entry?.ok && entry.img) {
    mapImg = entry.img;
    resetSketch();
    return;
  }
  loadImage(candidate, (img) => {
    mapImageRegistry.set(candidate, { img, ok: true });
    if (candidate !== activeMapImagePath) return;
    mapImg = img;
    resetSketch();
  }, () => {
    mapImageRegistry.set(candidate, { img: null, ok: false });
    if (candidate !== activeMapImagePath) return;
    mapImg = null;
    resetSketch();
  });
}

function getMapCenter() {
  if (mapPlacement) return { x: mapPlacement.x + mapPlacement.w * 0.5, y: mapPlacement.y + mapPlacement.h * 0.5 };
  return { x: width * 0.5, y: height * 0.5 };
}

function drawMapOverlay(polylines, pg) {
  if (pg) {
    pg.push();
    if (mapImg && mapPlacement) {
      pg.tint(0, 0, 0, 22);
      pg.image(mapImg, mapPlacement.x, mapPlacement.y, mapPlacement.w, mapPlacement.h);
    } else {
      pg.noFill();
      pg.stroke(255, 210, 120, CONFIG.map.strokeAlpha);
      pg.strokeWeight(CONFIG.map.strokeWeight / (camera?.zoom ?? 1));
      for (const poly of polylines) {
        pg.beginShape();
        for (const p of poly) pg.vertex(p.x, p.y);
        pg.endShape();
      }
    }
    pg.pop();
  } else {
    push();
    if (mapImg && mapPlacement) {
      tint(0, 0, 0, 22);
      image(mapImg, mapPlacement.x, mapPlacement.y, mapPlacement.w, mapPlacement.h);
    } else {
      noFill();
      stroke(255, 210, 120, CONFIG.map.strokeAlpha);
      strokeWeight(CONFIG.map.strokeWeight / (camera?.zoom ?? 1));
      for (const poly of polylines) {
        beginShape();
        for (const p of poly) vertex(p.x, p.y);
        endShape();
      }
    }
    pop();
  }
}

function extractSpawnPointsFromMapImage(img, canvasW, canvasH, mapCfg) {
  const margin = mapCfg.margin, boxW = canvasW - margin * 2, boxH = canvasH - margin * 2;
  const scale = Math.min(boxW / img.width, boxH / img.height);
  const dw = Math.max(1, Math.floor(img.width * scale)), dh = Math.max(1, Math.floor(img.height * scale));
  const dx = Math.floor((canvasW - dw) * 0.5), dy = Math.floor((canvasH - dh) * 0.5);

  const pgSpawn = createGraphics(dw, dh);
  pgSpawn.pixelDensity(1);
  pgSpawn.smooth();
  pgSpawn.background(255);
  pgSpawn.image(img, 0, 0, dw, dh);
  if ((mapCfg.spawnBlurPx | 0) > 0) pgSpawn.filter(BLUR, mapCfg.spawnBlurPx | 0);
  pgSpawn.loadPixels();

  // Sharp mask for attractor: blurred luminance gradients collapse to a "ridge" inside strokes;
  // distance-to-black pulls toward any dark pixel, including fill and thin lines.
  const pgMask = createGraphics(dw, dh);
  pgMask.pixelDensity(1);
  pgMask.smooth();
  pgMask.background(255);
  pgMask.image(img, 0, 0, dw, dh);
  pgMask.loadPixels();

  const stride = Math.max(1, mapCfg.pixelStride | 0), thr = mapCfg.darknessThreshold;
  const maxPts = mapCfg.maxSpawnPoints | 0, edgeIgnorePx = Math.max(0, mapCfg.edgeIgnorePx | 0);
  const points = [];
  let seen = 0;

  for (let y = 0; y < dh; y += stride) {
    for (let x = 0; x < dw; x += stride) {
      if (edgeIgnorePx > 0 && (x < edgeIgnorePx || y < edgeIgnorePx || x >= dw - edgeIgnorePx || y >= dh - edgeIgnorePx)) continue;
      if (mapCfg.ignoreWatermark && x > dw * 0.78 && y > dh * 0.86) continue;

      const idx = 4 * (y * dw + x);
      const a = pgSpawn.pixels[idx + 3];
      if (a < 10) continue;
      if ((pgSpawn.pixels[idx] + pgSpawn.pixels[idx + 1] + pgSpawn.pixels[idx + 2]) / 3 > thr) continue;

      const pt = { x: dx + x + random(-0.5, 0.5) * stride, y: dy + y + random(-0.5, 0.5) * stride };
      if (points.length < maxPts) points.push(pt);
      else {
        const j = random(++seen) | 0;
        if (j < maxPts) points[j] = pt;
      }
    }
  }
  if (!points.length) for (let i = 0; i < 2000; i++) points.push({ x: random(canvasW), y: random(canvasH) });

  return {
    points,
    placement: { x: dx, y: dy, w: dw, h: dh },
    attractor: buildAttractorField(pgMask, {
      placement: { x: dx, y: dy, w: dw, h: dh },
      edgeIgnorePx,
      cellSize: Math.max(2, CONFIG.magnet?.fieldCellSize | 0),
      maxForce: CONFIG.magnet?.maxForce ?? 2.0,
      darknessThreshold: thr
    })
  };
}

function buildAttractorField(pg, opts) {
  const w = pg.width, h = pg.height, cell = opts.cellSize;
  const cols = Math.max(1, Math.floor(w / cell)), rows = Math.max(1, Math.floor(h / cell));
  const vecs = new Float32Array(cols * rows * 2);
  const thr = opts.darknessThreshold ?? 135;
  const px = pg.pixels;

  const luminanceAt = (ix, iy) => {
    const x = constrain(ix | 0, 0, w - 1), y = constrain(iy | 0, 0, h - 1);
    const idx = 4 * (y * w + x);
    if (px[idx + 3] < 10) return 255;
    return (px[idx] + px[idx + 1] + px[idx + 2]) / 3;
  };

  /** True if any sampled pixel in the cell is dark enough (matches spawn semantics). */
  const cellHasBlack = (gx, gy) => {
    const x0 = gx * cell, y0 = gy * cell;
    const x1 = Math.min(w - 1, x0 + cell - 1), y1 = Math.min(h - 1, y0 + cell - 1);
    const step = cell <= 4 ? 1 : Math.max(1, (cell / 4) | 0);
    for (let yy = y0; yy <= y1; yy += step)
      for (let xx = x0; xx <= x1; xx += step)
        if (luminanceAt(xx, yy) <= thr) return true;
    return false;
  };

  const N = cols * rows;
  const INF = 0x3fffffff;
  const dist = new Int32Array(N);
  dist.fill(INF);
  const q = [];
  for (let gy = 0; gy < rows; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      const i = gy * cols + gx;
      if (cellHasBlack(gx, gy)) {
        dist[i] = 0;
        q.push(i);
      }
    }
  }

  const edgeIgnore = opts.edgeIgnorePx | 0;
  const maxForce = opts.maxForce || 2.0;
  const inBoundsCell = (gx, gy) => gx >= 0 && gy >= 0 && gx < cols && gy < rows;
  const cellCenterOk = (gx, gy) => {
    const cx = Math.floor((gx + 0.5) * cell), cy = Math.floor((gy + 0.5) * cell);
    if (edgeIgnore <= 0) return true;
    return cx >= edgeIgnore && cy >= edgeIgnore && cx < w - edgeIgnore && cy < h - edgeIgnore;
  };

  for (let qh = 0; qh < q.length; qh++) {
    const i = q[qh];
    const d0 = dist[i], nd = d0 + 1;
    if (nd >= INF) continue;
    const gy = (i / cols) | 0, gx = i - gy * cols;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = gx + dx, ny = gy + dy;
        if (!inBoundsCell(nx, ny)) continue;
        const j = ny * cols + nx;
        if (dist[j] > nd) {
          dist[j] = nd;
          q.push(j);
        }
      }
    }
  }

  let maxDist = 1;
  for (let i = 0; i < N; i++) if (dist[i] < INF && dist[i] > maxDist) maxDist = dist[i];

  let k = 0;
  for (let gy = 0; gy < rows; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      if (!cellCenterOk(gx, gy)) {
        vecs[k++] = 0;
        vecs[k++] = 0;
        continue;
      }
      const i = gy * cols + gx;
      if (dist[i] >= INF) {
        vecs[k++] = 0;
        vecs[k++] = 0;
        continue;
      }

      const gxm = Math.max(0, gx - 1), gxp = Math.min(cols - 1, gx + 1);
      const gym = Math.max(0, gy - 1), gyp = Math.min(rows - 1, gy + 1);
      const dL = dist[gy * cols + gxm], dR = dist[gy * cols + gxp];
      const dU = dist[gym * cols + gx], dD = dist[gyp * cols + gx];
      let vx = dL - dR;
      let vy = dU - dD;
      const magSq = vx * vx + vy * vy;

      if (magSq < 1e-8) {
        vecs[k++] = 0;
        vecs[k++] = 0;
        continue;
      }
      const invMag = 1 / Math.sqrt(magSq);
      const t = dist[i] / maxDist;
      const amp = constrain(0.2 + 0.8 * (t * t), 0.15, 1);
      const force = amp * maxForce;
      vecs[k++] = vx * invMag * force;
      vecs[k++] = vy * invMag * force;
    }
  }
  return { placement: opts.placement, cellSize: cell, cols, rows, vecs };
}

function sampleAttractor(field, x, y) {
  const p = field.placement, lx = x - p.x, ly = y - p.y;
  if (lx < 0 || ly < 0 || lx >= p.w || ly >= p.h) return null;
  const gx = Math.floor(lx / field.cellSize), gy = Math.floor(ly / field.cellSize);
  if (gx < 0 || gy < 0 || gx >= field.cols || gy >= field.rows) return null;

  const idx = (gy * field.cols + gx) * 2;
  const vx = field.vecs[idx], vy = field.vecs[idx + 1];
  return createVector(vx, vy);
}

function samplePolylines(polylines, samplesPerSegment) {
  const points = [];
  for (const poly of polylines)
    for (let i = 0; i < poly.length - 1; i++)
      for (let s = 0; s <= samplesPerSegment; s++)
        points.push({ x: lerp(poly[i].x, poly[i + 1].x, s / samplesPerSegment), y: lerp(poly[i].y, poly[i + 1].y, s / samplesPerSegment) });
  return points;
}

function buildEuropePoliticalLines(w, h, margin) {
  const box = { x: margin, y: margin, w: w - margin * 2, h: h - margin * 2 }, targetAspect = 1.55;
  let mw = box.w, mh = box.h;
  if (mw / mh > targetAspect) mw = mh * targetAspect; else mh = mw / targetAspect;
  const ox = box.x + (box.w - mw) * 0.5, oy = box.y + (box.h - mh) * 0.5;
  const P = (u, v) => ({ x: ox + u * mw, y: oy + v * mh });

  return [
    [P(0.1, 0.66), P(0.14, 0.6), P(0.18, 0.57), P(0.22, 0.53), P(0.26, 0.52), P(0.29, 0.54), P(0.31, 0.58), P(0.34, 0.61), P(0.33, 0.66), P(0.31, 0.72), P(0.27, 0.77), P(0.23, 0.83), P(0.26, 0.9), P(0.33, 0.93), P(0.41, 0.92), P(0.46, 0.89), P(0.49, 0.84), P(0.52, 0.8), P(0.55, 0.82), P(0.58, 0.86), P(0.62, 0.88), P(0.66, 0.86), P(0.7, 0.82), P(0.75, 0.79), P(0.8, 0.73), P(0.83, 0.66), P(0.84, 0.6), P(0.83, 0.53), P(0.78, 0.49), P(0.73, 0.45), P(0.68, 0.4), P(0.64, 0.35), P(0.6, 0.3), P(0.56, 0.26), P(0.52, 0.22), P(0.47, 0.19), P(0.42, 0.18), P(0.38, 0.2), P(0.34, 0.24), P(0.31, 0.28), P(0.28, 0.33), P(0.25, 0.39), P(0.22, 0.45), P(0.18, 0.52), P(0.14, 0.6)],
    [P(0.39, 0.24), P(0.41, 0.27), P(0.43, 0.31), P(0.46, 0.35), P(0.49, 0.39), P(0.52, 0.44), P(0.54, 0.5), P(0.55, 0.56)],
    [P(0.25, 0.8), P(0.26, 0.86), P(0.28, 0.9), P(0.29, 0.88), P(0.29, 0.82), P(0.28, 0.79)],
    [P(0.3, 0.84), P(0.33, 0.83), P(0.36, 0.82), P(0.39, 0.81), P(0.41, 0.81)],
    [P(0.41, 0.78), P(0.44, 0.76), P(0.47, 0.75), P(0.5, 0.74), P(0.53, 0.74), P(0.56, 0.75)],
    [P(0.48, 0.8), P(0.49, 0.84), P(0.5, 0.88), P(0.5, 0.92)],
    [P(0.35, 0.7), P(0.38, 0.68), P(0.41, 0.66), P(0.44, 0.64), P(0.46, 0.62)],
    [P(0.48, 0.6), P(0.51, 0.59), P(0.54, 0.58), P(0.57, 0.58), P(0.6, 0.59)],
    [P(0.5, 0.69), P(0.53, 0.67), P(0.56, 0.66), P(0.59, 0.66), P(0.62, 0.67)],
    [P(0.58, 0.74), P(0.6, 0.76), P(0.62, 0.78), P(0.64, 0.8), P(0.66, 0.82)],
    [P(0.62, 0.55), P(0.65, 0.57), P(0.68, 0.6), P(0.71, 0.63), P(0.74, 0.66)],
    [P(0.18, 0.55), P(0.2, 0.5), P(0.23, 0.48), P(0.25, 0.5), P(0.26, 0.54), P(0.25, 0.58), P(0.22, 0.6), P(0.2, 0.59), P(0.18, 0.55)],
    [P(0.12, 0.58), P(0.13, 0.55), P(0.15, 0.55), P(0.16, 0.58), P(0.15, 0.61), P(0.13, 0.61), P(0.12, 0.58)],
    [P(0.44, 0.56), P(0.45, 0.53), P(0.47, 0.52), P(0.49, 0.53), P(0.49, 0.55)]
  ];
}

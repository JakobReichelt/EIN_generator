function markVizSimDirty() {
  vizSimDirty = true;
}

let vizSimDirty = true;
let blendedAttractorCache = { t: NaN, field: null };
let clusterTargetCache = { t: NaN, map: null };
const polygonGridCache = new Map();

function invalidatePolygonGridCache(cluster) {
  if (!cluster) {
    polygonGridCache.clear();
    return;
  }
  for (const key of polygonGridCache.keys()) {
    if (key.startsWith(`${cluster.id}:`)) polygonGridCache.delete(key);
  }
}

function polygonGridKey(clusterId, sitIndex, n, polyPoints) {
  let sig = '';
  for (const p of polyPoints) sig += `${p.x.toFixed(2)},${p.y.toFixed(2)};`;
  return `${clusterId}:${sitIndex}:${n}:${sig}`;
}

function polygonCentroid(points) {
  if (!points?.length) return { x: 0, y: 0 };
  let x = 0;
  let y = 0;
  for (const p of points) {
    x += p.x;
    y += p.y;
  }
  return { x: x / points.length, y: y / points.length };
}

function collectPolygonInteriorCells(polyPoints, n = 120) {
  const b = polygonBBox(polyPoints);
  const need = Math.max(1, Math.floor(+n || 1));
  let allCells = [];
  let targetCells = Math.max(64, Math.ceil(need * (4 / Math.PI)));
  for (let pass = 0; pass < 16 && allCells.length < need; pass++) {
    const { cols, rows } = bestRectGridDims(targetCells, b.w, b.h);
    allCells = [];
    for (let row = rows - 1; row >= 0; row--) {
      const py = b.y + ((row + 0.5) / rows) * b.h;
      for (let col = 0; col < cols; col++) {
        const px = b.x + ((col + 0.5) / cols) * b.w;
        if (!pointInPolygon(px, py, polyPoints)) continue;
        allCells.push({ px, py });
      }
    }
    if (allCells.length < need) targetCells = Math.ceil(targetCells * 1.6);
  }
  allCells.sort((a, b) => {
    if (Math.abs(b.py - a.py) > 1e-4) return b.py - a.py;
    return a.px - b.px;
  });
  return allCells;
}

function sampleInteriorCellsEvenly(allCells, n) {
  if (!allCells.length) return [];
  if (n === 1) return [{ x: allCells[0].px, y: allCells[0].py }];
  const out = [];
  const m = allCells.length;
  for (let i = 0; i < n; i++) {
    const idx = m === 1 ? 0 : Math.min(m - 1, Math.floor((i * m) / n));
    out.push({ x: allCells[idx].px, y: allCells[idx].py });
  }
  return out;
}

function fillPolygonInteriorSpiral(polyPoints, n) {
  const b = polygonBBox(polyPoints);
  const c = polygonCentroid(polyPoints);
  const out = [];
  const maxR = Math.max(b.w, b.h) * 0.5;
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let k = 0; k < n; k++) {
    let placed = false;
    const ang = k * golden;
    for (let step = 0; step <= 64; step++) {
      const r = maxR * Math.sqrt((step + 0.5) / 65);
      const px = c.x + Math.cos(ang) * r;
      const py = c.y + Math.sin(ang) * r;
      if (!pointInPolygon(px, py, polyPoints)) continue;
      out.push({ x: px, y: py });
      placed = true;
      break;
    }
    if (!placed) out.push({ x: c.x, y: c.y });
  }
  return out;
}

function computePolygonInteriorWorldPoints(polyPoints, n) {
  if (!polyPoints?.length || n < 1) return [{ x: 0, y: 0 }];
  const allCells = collectPolygonInteriorCells(polyPoints, n);
  if (allCells.length >= n) return sampleInteriorCellsEvenly(allCells, n);
  if (allCells.length > 0) {
    const seeded = sampleInteriorCellsEvenly(allCells, Math.min(n, allCells.length));
    if (seeded.length >= n) return seeded.slice(0, n);
    return seeded.concat(fillPolygonInteriorSpiral(polyPoints, n - seeded.length));
  }
  return fillPolygonInteriorSpiral(polyPoints, n);
}

function getPolygonWorldGrid(cluster, sitIndex, n) {
  const count = Math.max(1, Math.floor(+n || 1));
  const poly = getPolygonPoints(cluster, sitIndex);
  const key = polygonGridKey(cluster.id, sitIndex, count, poly);
  const cached = polygonGridCache.get(key);
  if (cached) return cached;
  const worldPts = computePolygonInteriorWorldPoints(poly, count);
  const buf = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    buf[i * 2] = worldPts[i].x;
    buf[i * 2 + 1] = worldPts[i].y;
  }
  polygonGridCache.set(key, buf);
  return buf;
}

function makePolygonUnitSlots(n) {
  const count = Math.max(1, Math.floor(+n || 1));
  return Array.from({ length: count }, () => ({ u: 0, v: 0 }));
}

function copyUnitPoints(points) {
  return (points || []).map((p) => ({ u: p.u, v: p.v }));
}

function ensureClusterMigrated(cluster) {
  if (!cluster?.situations?.length) return;
  if (cluster.situations[0].unitPoints) return;
  const legacyPts = copyUnitPoints(cluster.unitPoints);
  const legacyN = Math.max(1, cluster.particleCount || legacyPts.length || CONFIG.visualizer.defaultClusterCount);
  for (let i = 0; i < 2; i++) {
    const sit = cluster.situations[i];
    let pts = legacyPts;
    if (!pts.length) {
      pts = generateClusterUnitPoints(cluster, i, legacyN);
    }
    if (cluster.type === 'polygon') {
      sit.unitPoints = makePolygonUnitSlots(legacyN);
    } else {
      sit.unitPoints = copyUnitPoints(pts);
    }
    sit.particleCount = sit.unitPoints.length;
  }
  delete cluster.unitPoints;
  delete cluster.particleCount;
}

function getSituationUnitPoints(cluster, sitIndex) {
  ensureClusterMigrated(cluster);
  const i = sitIndex === 1 ? 1 : 0;
  return cluster.situations[i].unitPoints;
}

function getClusterParticleCount(cluster, sitIndex) {
  ensureClusterMigrated(cluster);
  const i = sitIndex === 1 ? 1 : 0;
  return cluster.situations[i].particleCount ?? cluster.situations[i].unitPoints?.length ?? 0;
}

function getClusterMaxParticleCount(cluster) {
  return Math.max(getClusterParticleCount(cluster, 0), getClusterParticleCount(cluster, 1));
}

function getParticleCountSituation() {
  return vizMode === 'edit' ? activeSituation : playSituation;
}

function getParticleSituationVisibility(cluster, unitIndex, blendT) {
  const n0 = getClusterParticleCount(cluster, 0);
  const n1 = getClusterParticleCount(cluster, 1);
  const exact = lerp(n0, n1, constrain(blendT, 0, 1));
  return constrain(exact - unitIndex, 0, 1);
}

function clusterAspectForSituation(cluster, sitIndex) {
  if (cluster.type === 'polygon') {
    const b = polygonBBox(getPolygonPoints(cluster, sitIndex));
    return {
      w: Math.max(CONFIG.visualizer.minClusterSize, b.w),
      h: Math.max(CONFIG.visualizer.minClusterSize, b.h)
    };
  }
  const g = getClusterGeom(cluster, sitIndex);
  return {
    w: Math.max(CONFIG.visualizer.minClusterSize, g.w),
    h: Math.max(CONFIG.visualizer.minClusterSize, g.h)
  };
}

function generateClusterUnitPoints(cluster, sitIndex, count) {
  const n = Math.max(1, Math.floor(+count || 1));
  if (cluster.type === 'polygon') return makePolygonUnitSlots(n);
  const { w, h } = clusterAspectForSituation(cluster, sitIndex);
  return generateUnitGridPoints(cluster.type, n, w, h);
}

function makeRectSituation(geom, unitPoints) {
  const g = normalizeGeom(geom);
  const pts = copyUnitPoints(unitPoints);
  return { ...g, unitPoints: pts, particleCount: pts.length };
}

function makePolygonSituation(points, unitPoints) {
  const pts = copyUnitPoints(unitPoints);
  const poly = points.map((p) => ({ x: p.x, y: p.y }));
  return { points: poly, unitPoints: pts, particleCount: pts.length };
}

function createCluster(type, geom, particleCount) {
  const count = Math.max(1, Math.floor(+particleCount || CONFIG.visualizer.defaultClusterCount));
  const g = normalizeGeom(geom);
  const clusterType = type === 'circle' ? 'circle' : 'square';
  const unitPoints = generateUnitGridPoints(clusterType, count, g.w, g.h);
  const cluster = {
    id: nextClusterId++,
    type: clusterType,
    situations: [makeRectSituation(g, unitPoints), makeRectSituation(g, unitPoints)]
  };
  clusters.push(cluster);
  attractorDirty = true;
  markVizSimDirty();
  return cluster;
}

function normalizeGeom(geom) {
  const x = +geom.x || 0;
  const y = +geom.y || 0;
  let w = Math.abs(+geom.w || CONFIG.visualizer.minClusterSize);
  let h = Math.abs(+geom.h || CONFIG.visualizer.minClusterSize);
  w = Math.max(CONFIG.visualizer.minClusterSize, w);
  h = Math.max(CONFIG.visualizer.minClusterSize, h);
  return { x, y, w, h };
}

function geomFromDrag(ax, ay, bx, by) {
  const x = Math.min(ax, bx);
  const y = Math.min(ay, by);
  const w = Math.max(CONFIG.visualizer.minClusterSize, Math.abs(bx - ax));
  const h = Math.max(CONFIG.visualizer.minClusterSize, Math.abs(by - ay));
  return { x, y, w, h };
}

function polygonBBox(points) {
  if (!points?.length) {
    return { x: 0, y: 0, w: CONFIG.visualizer.minClusterSize, h: CONFIG.visualizer.minClusterSize };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  const w = Math.max(CONFIG.visualizer.minClusterSize, maxX - minX);
  const h = Math.max(CONFIG.visualizer.minClusterSize, maxY - minY);
  return { x: minX, y: minY, w, h };
}

function pointInPolygon(x, y, points) {
  if (!points || points.length < 3) return false;
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const xi = points[i].x;
    const yi = points[i].y;
    const xj = points[j].x;
    const yj = points[j].y;
    const intersect = ((yi > y) !== (yj > y))
      && (x < (xj - xi) * (y - yi) / ((yj - yi) || 1e-12) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function _cross(ax, ay, bx, by, cx, cy) {
  return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
}

function segmentIntersection(ax, ay, bx, by, cx, cy, dx, dy) {
  const d1 = _cross(cx, cy, dx, dy, ax, ay);
  const d2 = _cross(cx, cy, dx, dy, bx, by);
  const d3 = _cross(ax, ay, bx, by, cx, cy);
  const d4 = _cross(ax, ay, bx, by, dx, dy);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    const denom = (ax - bx) * (cy - dy) - (ay - by) * (cx - dx);
    if (Math.abs(denom) < 1e-12) return null;
    const t = ((ax - cx) * (cy - dy) - (ay - cy) * (cx - dx)) / denom;
    return { x: ax + t * (bx - ax), y: ay + t * (by - ay) };
  }
  return null;
}

function getDrawCloseSnapWorld() {
  const snap = CONFIG.visualizer.drawCloseSnap ?? 18;
  return snap / Math.max(0.25, camera?.zoom ?? 1);
}

function tryCloseDrawPath(points) {
  const minPts = CONFIG.visualizer.drawMinPoints ?? 3;
  if (!points || points.length < minPts) return null;

  const n = points.length;
  const bx = points[n - 1].x;
  const by = points[n - 1].y;
  const snap = getDrawCloseSnapWorld();
  const sx = points[0].x;
  const sy = points[0].y;
  if (Math.hypot(bx - sx, by - sy) <= snap) {
    return points.map((p) => ({ x: p.x, y: p.y }));
  }

  if (n < 3) return null;
  const ax = points[n - 2].x;
  const ay = points[n - 2].y;
  for (let i = 0; i < n - 3; i++) {
    const hit = segmentIntersection(
      ax, ay, bx, by,
      points[i].x, points[i].y, points[i + 1].x, points[i + 1].y
    );
    if (!hit) continue;
    const closed = points.slice(0, i + 1).map((p) => ({ x: p.x, y: p.y }));
    closed.push({ x: hit.x, y: hit.y });
    if (closed.length >= minPts) return closed;
  }
  return null;
}

function appendDrawPathPoint(path, x, y) {
  const minSeg = (CONFIG.visualizer.drawMinSegment ?? 8) / Math.max(0.25, camera?.zoom ?? 1);
  const pts = path.points;
  const last = pts[pts.length - 1];
  if (Math.hypot(x - last.x, y - last.y) < minSeg) return null;
  pts.push({ x, y });
  return tryCloseDrawPath(pts);
}

function getPolygonPoints(cluster, sitIndex) {
  const i = sitIndex === 1 ? 1 : 0;
  return cluster.situations[i]?.points ?? [];
}

function getPolygonPointsLerped(cluster, blendT) {
  const p0 = getPolygonPoints(cluster, 0);
  const p1 = getPolygonPoints(cluster, 1);
  if (!p0.length) return p1;
  if (!p1.length) return p0;
  if (p0.length !== p1.length) return blendT < 0.5 ? p0 : p1;
  const t = constrain(blendT, 0, 1);
  return p0.map((p, i) => ({
    x: lerp(p.x, p1[i].x, t),
    y: lerp(p.y, p1[i].y, t)
  }));
}

function setPolygonPoints(cluster, sitIndex, points) {
  const i = sitIndex === 1 ? 1 : 0;
  ensureClusterMigrated(cluster);
  cluster.situations[i].points = points.map((p) => ({ x: p.x, y: p.y }));
  invalidatePolygonGridCache(cluster);
  attractorDirty = true;
  markVizSimDirty();
}

function scalePolygonPoints(points, fromBox, toBox) {
  const ow = Math.max(1e-6, fromBox.w);
  const oh = Math.max(1e-6, fromBox.h);
  return points.map((p) => ({
    x: toBox.x + ((p.x - fromBox.x) / ow) * toBox.w,
    y: toBox.y + ((p.y - fromBox.y) / oh) * toBox.h
  }));
}

function createPolygonCluster(worldPoints, particleCount) {
  const count = Math.max(1, Math.floor(+particleCount || CONFIG.visualizer.defaultClusterCount));
  const closed = worldPoints.map((p) => ({ x: p.x, y: p.y }));
  const unitPoints = makePolygonUnitSlots(count);
  const cluster = {
    id: nextClusterId++,
    type: 'polygon',
    situations: [makePolygonSituation(closed, unitPoints), makePolygonSituation(closed, unitPoints)]
  };
  clusters.push(cluster);
  attractorDirty = true;
  markVizSimDirty();
  return cluster;
}

function finishDrawPath(closedPoints) {
  const b = polygonBBox(closedPoints);
  if (b.w < CONFIG.visualizer.minClusterSize * 0.5 && b.h < CONFIG.visualizer.minClusterSize * 0.5) {
    activeDrawPath = null;
    return null;
  }

  if (polygonRedrawTarget) {
    const target = polygonRedrawTarget;
    polygonRedrawTarget = null;
    activeDrawPath = null;
    const cluster = getClusterById(target.clusterId);
    if (cluster?.type === 'polygon') {
      setPolygonPoints(cluster, target.sitIndex, closedPoints);
      refreshClusterUnitPoints(cluster, target.sitIndex);
      selectedClusterId = cluster.id;
      if (vizMode === 'play' && typeof syncPlayParticlePool === 'function') {
        syncPlayParticlePool(getSituationBlendT());
      }
      refreshVisualizerUI();
      return cluster;
    }
    refreshVisualizerUI();
    return null;
  }

  const cluster = createPolygonCluster(closedPoints, newClusterParticleCount);
  selectedClusterId = cluster.id;
  activeDrawPath = null;
  refreshVisualizerUI();
  return cluster;
}

function startPolygonRedraw() {
  if (vizMode !== 'edit' || selectedClusterId == null) return false;
  const cluster = getClusterById(selectedClusterId);
  if (!cluster || cluster.type !== 'polygon') return false;
  polygonRedrawTarget = { clusterId: cluster.id, sitIndex: activeSituation };
  shapeTool = 'draw';
  activeDrawPath = null;
  editDrag = null;
  refreshVisualizerUI();
  return true;
}

function cancelPolygonRedraw() {
  if (!polygonRedrawTarget && !activeDrawPath) return;
  polygonRedrawTarget = null;
  activeDrawPath = null;
  refreshVisualizerUI();
}

function isPolygonRedrawActive() {
  return polygonRedrawTarget != null;
}

function clusterAspectForGrid(cluster) {
  if (cluster.type === 'polygon') {
    const b0 = polygonBBox(getPolygonPoints(cluster, 0));
    const b1 = polygonBBox(getPolygonPoints(cluster, 1));
    return {
      w: Math.max(CONFIG.visualizer.minClusterSize, (b0.w + b1.w) * 0.5),
      h: Math.max(CONFIG.visualizer.minClusterSize, (b0.h + b1.h) * 0.5)
    };
  }
  const g0 = getClusterGeom(cluster, 0);
  const g1 = getClusterGeom(cluster, 1);
  return {
    w: Math.max(CONFIG.visualizer.minClusterSize, (g0.w + g1.w) * 0.5),
    h: Math.max(CONFIG.visualizer.minClusterSize, (g0.h + g1.h) * 0.5)
  };
}

function refreshClusterUnitPoints(cluster, sitIndex = activeSituation) {
  const i = sitIndex === 1 ? 1 : 0;
  const n = Math.max(1, getClusterParticleCount(cluster, i) || 1);
  const unitPoints = generateClusterUnitPoints(cluster, i, n);
  cluster.situations[i].unitPoints = unitPoints;
  cluster.situations[i].particleCount = unitPoints.length;
  if (cluster.type === 'polygon') invalidatePolygonGridCache(cluster);
  markVizSimDirty();
}

/** Pick cols/rows so world-space spacing along x and y is as equal as possible. */
function bestRectGridDims(n, w, h) {
  const ww = Math.max(CONFIG.visualizer.minClusterSize, +w || 1);
  const hh = Math.max(CONFIG.visualizer.minClusterSize, +h || 1);
  const aspect = ww / hh;
  let bestCols = 1;
  let bestRows = n;
  let bestScore = Infinity;

  const estCols = Math.max(1, Math.round(Math.sqrt(n * aspect)));
  const spread = Math.max(4, Math.ceil(estCols * 0.85));
  const minCols = Math.max(1, estCols - spread);
  const maxCols = Math.max(minCols, estCols + spread);

  for (let cols = minCols; cols <= maxCols; cols++) {
    const rows = Math.ceil(n / cols);
    const worldDx = ww / cols;
    const worldDy = hh / rows;
    const spacingScore = Math.abs(worldDx - worldDy);
    const waste = cols * rows - n;
    const score = spacingScore + waste * 1e-4;
    if (score < bestScore) {
      bestScore = score;
      bestCols = cols;
      bestRows = rows;
    }
  }
  return { cols: bestCols, rows: bestRows };
}

/** Fill a rect grid bottom-to-top so low indices sit low and new slots grow upward. */
function appendBottomUpGridPoints(points, n, w, h, includeFn, gridCount = n) {
  const ww = Math.max(CONFIG.visualizer.minClusterSize, +w || 1);
  const hh = Math.max(CONFIG.visualizer.minClusterSize, +h || 1);
  const { cols, rows } = bestRectGridDims(Math.max(n, Math.floor(gridCount)), ww, hh);
  for (let rowFromBottom = 0; rowFromBottom < rows && points.length < n; rowFromBottom++) {
    const rowTop = rows - 1 - rowFromBottom;
    const v = (rowTop + 0.5) / rows;
    for (let col = 0; col < cols && points.length < n; col++) {
      const u = (col + 0.5) / cols;
      if (!includeFn(u, v)) continue;
      points.push({ u, v });
    }
  }
  return points;
}

function generateSquareUnitPoints(n, w, h) {
  const points = [];
  appendBottomUpGridPoints(points, n, w, h, () => true);
  while (points.length < n) points.push({ u: 0.5, v: 0.5 });
  return points.slice(0, n);
}

function generateCircleUnitPointsVogel(n) {
  if (n <= 0) return [];
  if (n === 1) return [{ u: 0.5, v: 0.5 }];
  const points = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let k = 1; k <= n; k++) {
    const r = 0.5 * Math.sqrt(k / n);
    const theta = k * golden;
    points.push({ u: 0.5 + r * Math.cos(theta), v: 0.5 + r * Math.sin(theta) });
  }
  return points;
}

function generateCircleUnitPoints(n, w, h) {
  return generateCircleUnitPointsVogel(n);
}

function generateUnitGridPoints(type, targetCount, w, h) {
  const n = Math.max(1, Math.floor(targetCount));
  const ww = Math.max(CONFIG.visualizer.minClusterSize, +w || CONFIG.visualizer.minClusterSize);
  const hh = Math.max(CONFIG.visualizer.minClusterSize, +h || CONFIG.visualizer.minClusterSize);
  if (type === 'circle') return generateCircleUnitPoints(n, ww, hh);
  return generateSquareUnitPoints(n, ww, hh);
}

function getClusterGeom(cluster, sitIndex) {
  const i = sitIndex === 1 ? 1 : 0;
  if (cluster.type === 'polygon') {
    return polygonBBox(getPolygonPoints(cluster, sitIndex));
  }
  return cluster.situations[i];
}

function setClusterGeom(cluster, sitIndex, geom) {
  if (cluster.type === 'polygon') return;
  const i = sitIndex === 1 ? 1 : 0;
  ensureClusterMigrated(cluster);
  const g = normalizeGeom(geom);
  const sit = cluster.situations[i];
  sit.x = g.x;
  sit.y = g.y;
  sit.w = g.w;
  sit.h = g.h;
  attractorDirty = true;
  markVizSimDirty();
}

function unitToWorld(cluster, sitIndex, unitPoint, unitIndex = 0) {
  if (cluster.type === 'polygon') {
    const n = getClusterParticleCount(cluster, sitIndex);
    const grid = getPolygonWorldGrid(cluster, sitIndex, n);
    const idx = Math.max(0, Math.min(n - 1, unitIndex | 0));
    return { x: grid[idx * 2], y: grid[idx * 2 + 1] };
  }
  const g = getClusterGeom(cluster, sitIndex);
  return {
    x: g.x + unitPoint.u * g.w,
    y: g.y + unitPoint.v * g.h
  };
}

function lerpGeom(a, b, t) {
  const tt = constrain(t, 0, 1);
  return {
    x: lerp(a.x, b.x, tt),
    y: lerp(a.y, b.y, tt),
    w: lerp(a.w, b.w, tt),
    h: lerp(a.h, b.h, tt)
  };
}

function unitToWorldLerped(cluster, blendT) {
  if (cluster.type === 'polygon') {
    const t = constrain(blendT, 0, 1);
    return (unitPoint, unitIndex = 0) => {
      const p0 = unitToWorld(cluster, 0, unitPoint, unitIndex);
      const p1 = unitToWorld(cluster, 1, unitPoint, unitIndex);
      return { x: lerp(p0.x, p1.x, t), y: lerp(p0.y, p1.y, t) };
    };
  }
  const g = lerpGeom(getClusterGeom(cluster, 0), getClusterGeom(cluster, 1), blendT);
  return (unitPoint) => ({
    x: g.x + unitPoint.u * g.w,
    y: g.y + unitPoint.v * g.h
  });
}

function getClusterById(id) {
  return clusters.find((c) => c.id === id) ?? null;
}

function deleteCluster(id) {
  const cluster = getClusterById(id);
  if (polygonRedrawTarget?.clusterId === id) cancelPolygonRedraw();
  clusters = clusters.filter((c) => c.id !== id);
  if (selectedClusterId === id) selectedClusterId = null;
  if (cluster) invalidatePolygonGridCache(cluster);
  attractorDirty = true;
  markVizSimDirty();
}

function updateClusterParticleCount(cluster, count, sitIndex = getParticleCountSituation()) {
  const i = sitIndex === 1 ? 1 : 0;
  const n = Math.max(1, Math.floor(+count || 1));
  const unitPoints = generateClusterUnitPoints(cluster, i, n);
  cluster.situations[i].unitPoints = unitPoints;
  cluster.situations[i].particleCount = unitPoints.length;
  if (cluster.type === 'polygon') invalidatePolygonGridCache(cluster);
  attractorDirty = true;
  markVizSimDirty();
}

function pointInCluster(cluster, sitIndex, wx, wy) {
  if (cluster.type === 'polygon') {
    return pointInPolygon(wx, wy, getPolygonPoints(cluster, sitIndex));
  }
  const g = getClusterGeom(cluster, sitIndex);
  if (cluster.type === 'circle') {
    const cx = g.x + g.w * 0.5;
    const cy = g.y + g.h * 0.5;
    const rx = g.w * 0.5;
    const ry = g.h * 0.5;
    const dx = (wx - cx) / rx;
    const dy = (wy - cy) / ry;
    return dx * dx + dy * dy <= 1;
  }
  return wx >= g.x && wy >= g.y && wx <= g.x + g.w && wy <= g.y + g.h;
}

function getClusterHandles(cluster, sitIndex) {
  const g = getClusterGeom(cluster, sitIndex);
  return {
    nw: { x: g.x, y: g.y, corner: 'nw' },
    ne: { x: g.x + g.w, y: g.y, corner: 'ne' },
    se: { x: g.x + g.w, y: g.y + g.h, corner: 'se' },
    sw: { x: g.x, y: g.y + g.h, corner: 'sw' }
  };
}

function hitTestHandle(cluster, sitIndex, wx, wy, radiusWorld) {
  const handles = getClusterHandles(cluster, sitIndex);
  const r2 = radiusWorld * radiusWorld;
  for (const key of Object.keys(handles)) {
    const h = handles[key];
    const dx = wx - h.x;
    const dy = wy - h.y;
    if (dx * dx + dy * dy <= r2) return h.corner;
  }
  return null;
}

function hitTestCluster(wx, wy, sitIndex) {
  for (let i = clusters.length - 1; i >= 0; i--) {
    const c = clusters[i];
    if (pointInCluster(c, sitIndex, wx, wy)) return c;
  }
  return null;
}

function drawGeomOutline(type, g, opts = {}) {
  const alpha = opts.alpha ?? CONFIG.visualizer.outlineAlpha;
  stroke(0, 0, 0, alpha);
  strokeWeight((opts.strokeWeight ?? 1.5) / (camera?.zoom ?? 1));
  noFill();
  if (type === 'polygon' && Array.isArray(g.points)) {
    drawPolygonPath(g.points, true);
    return;
  }
  if (type === 'circle') {
    ellipse(g.x + g.w * 0.5, g.y + g.h * 0.5, g.w, g.h);
  } else {
    rect(g.x, g.y, g.w, g.h);
  }
}

function drawPolygonPath(points, closed) {
  if (!points?.length) return;
  beginShape();
  for (const p of points) vertex(p.x, p.y);
  if (closed && points.length >= 3) endShape(CLOSE);
  else endShape();
}

function drawClusterOutline(cluster, sitIndex, opts = {}) {
  const selected = cluster.id === selectedClusterId;
  const alpha = opts.alpha ?? (vizMode === 'edit' ? CONFIG.visualizer.outlineAlpha : CONFIG.visualizer.playOutlineAlpha);
  stroke(0, 0, 0, alpha);
  strokeWeight((opts.strokeWeight ?? 1.5) / (camera?.zoom ?? 1));
  noFill();
  if (cluster.type === 'polygon') {
    drawPolygonPath(getPolygonPoints(cluster, sitIndex), true);
  } else {
    const g = getClusterGeom(cluster, sitIndex);
    if (cluster.type === 'circle') {
      ellipse(g.x + g.w * 0.5, g.y + g.h * 0.5, g.w, g.h);
    } else {
      rect(g.x, g.y, g.w, g.h);
    }
  }
  if (selected && vizMode === 'edit' && sitIndex === activeSituation) {
    drawClusterHandles(cluster, sitIndex);
  }
}

function drawClusterHandles(cluster, sitIndex) {
  const handles = getClusterHandles(cluster, sitIndex);
  const r = 6 / (camera?.zoom ?? 1);
  fill(255, 0, 100);
  stroke(0, 0, 0, 200);
  strokeWeight(1 / (camera?.zoom ?? 1));
  for (const key of Object.keys(handles)) {
    const h = handles[key];
    circle(h.x, h.y, r * 2);
  }
}

function drawClusterGrid(cluster, sitIndex, opts = {}) {
  const sw = (opts.strokeWeight ?? CONFIG.visualizer.editGridStroke) / (camera?.zoom ?? 1);
  stroke(0, 0, 0, opts.alpha ?? 100);
  strokeWeight(sw);
  noFill();
  const pts = getSituationUnitPoints(cluster, sitIndex);
  const maxPts = CONFIG.visualizer.maxEditGridPoints ?? 500;
  const step = pts.length > maxPts ? Math.ceil(pts.length / maxPts) : 1;
  for (let i = 0; i < pts.length; i += step) {
    const p = cluster.type === 'polygon'
      ? unitToWorld(cluster, sitIndex, pts[i], i)
      : (typeof opts.mapWorld === 'function' ? opts.mapWorld : (unitPoint) => unitToWorld(cluster, sitIndex, unitPoint))(pts[i]);
    point(p.x, p.y);
  }
}

function buildSituationAttractor(sitIndex) {
  const w = width;
  const h = height;
  const pg = createGraphics(w, h);
  pg.pixelDensity(1);
  pg.background(255);
  pg.stroke(0);
  pg.strokeWeight(CONFIG.visualizer.attractorStroke);
  pg.noFill();

  for (const cluster of clusters) {
    if (cluster.type === 'polygon') {
      const pts = getPolygonPoints(cluster, sitIndex);
      if (pts.length >= 3) {
        pg.beginShape();
        for (const p of pts) pg.vertex(p.x, p.y);
        pg.endShape(pg.CLOSE);
      }
    } else {
      const g = getClusterGeom(cluster, sitIndex);
      if (cluster.type === 'circle') {
        pg.ellipse(g.x + g.w * 0.5, g.y + g.h * 0.5, g.w, g.h);
      } else {
        pg.rect(g.x, g.y, g.w, g.h);
      }
    }
  }

  pg.loadPixels();
  return buildAttractorField(pg, {
    placement: { x: 0, y: 0, w, h },
    edgeIgnorePx: 0,
    cellSize: Math.max(2, CONFIG.magnet.fieldCellSize | 0),
    maxForce: CONFIG.magnet.maxForce,
    darknessThreshold: 200
  });
}

function rebuildAttractorFields() {
  if (!clusters.length) {
    attractorFields = [null, null];
    attractorDirty = false;
    return;
  }
  attractorFields = [buildSituationAttractor(0), buildSituationAttractor(1)];
  attractorDirty = false;
  markVizSimDirty();
}

function getBlendedAttractorField(blendT) {
  const t = constrain(blendT, 0, 1);
  if (!vizSimDirty && blendedAttractorCache.field && Math.abs(blendedAttractorCache.t - t) < 1e-5) {
    return blendedAttractorCache.field;
  }
  const f0 = attractorFields[0];
  const f1 = attractorFields[1];
  let field = null;
  if (!f0 && !f1) field = null;
  else if (!f1 || t <= 0) field = f0;
  else if (!f0 || t >= 1) field = f1;
  else {
    const vecs = new Float32Array(f0.vecs.length);
    for (let i = 0; i < vecs.length; i++) {
      vecs[i] = f0.vecs[i] + (f1.vecs[i] - f0.vecs[i]) * t;
    }
    field = { placement: f0.placement, cellSize: f0.cellSize, cols: f0.cols, rows: f0.rows, vecs };
  }
  blendedAttractorCache = { t, field };
  return field;
}

function ensureClusterTargetCache(blendT) {
  const t = constrain(blendT, 0, 1);
  if (!vizSimDirty && clusterTargetCache.map && Math.abs(clusterTargetCache.t - t) < 1e-5) {
    return clusterTargetCache.map;
  }
  const map = new Map();
  for (const cluster of clusters) {
    ensureClusterMigrated(cluster);
    const n0 = getClusterParticleCount(cluster, 0);
    const n1 = getClusterParticleCount(cluster, 1);
    const maxN = Math.max(n0, n1);
    const u0 = getSituationUnitPoints(cluster, 0);
    const u1 = getSituationUnitPoints(cluster, 1);
    const targets = new Float32Array(maxN * 2);
    const grid0 = cluster.type === 'polygon' && n0 > 0 ? getPolygonWorldGrid(cluster, 0, n0) : null;
    const grid1 = cluster.type === 'polygon' && n1 > 0 ? getPolygonWorldGrid(cluster, 1, n1) : null;
    const mapWorld0 = (unitPoint, idx) => unitToWorld(cluster, 0, unitPoint, idx);
    const mapWorld1 = (unitPoint, idx) => unitToWorld(cluster, 1, unitPoint, idx);
    for (let i = 0; i < maxN; i++) {
      let p0;
      let p1;
      if (cluster.type === 'polygon') {
        if (i < n0 && grid0) {
          p0 = { x: grid0[i * 2], y: grid0[i * 2 + 1] };
        } else if (i < n1 && grid1) {
          p0 = { x: grid1[i * 2], y: grid1[i * 2 + 1] };
        } else if (grid0) {
          p0 = { x: grid0[(n0 - 1) * 2], y: grid0[(n0 - 1) * 2 + 1] };
        } else {
          p0 = { x: 0, y: 0 };
        }
        if (i < n1 && grid1) {
          p1 = { x: grid1[i * 2], y: grid1[i * 2 + 1] };
        } else if (i < n0 && grid0) {
          p1 = { x: grid0[i * 2], y: grid0[i * 2 + 1] };
        } else if (grid1) {
          p1 = { x: grid1[(n1 - 1) * 2], y: grid1[(n1 - 1) * 2 + 1] };
        } else {
          p1 = { x: 0, y: 0 };
        }
      } else {
        if (i < n0) p0 = mapWorld0(u0[i], i);
        else if (i < n1) p0 = mapWorld1(u1[i], i);
        else p0 = mapWorld0(u0[Math.max(0, n0 - 1)], Math.max(0, n0 - 1));
        if (i < n1) p1 = mapWorld1(u1[i], i);
        else if (i < n0) p1 = mapWorld0(u0[i], i);
        else p1 = mapWorld1(u1[Math.max(0, n1 - 1)], Math.max(0, n1 - 1));
      }
      targets[i * 2] = lerp(p0.x, p1.x, t);
      targets[i * 2 + 1] = lerp(p0.y, p1.y, t);
    }
    map.set(cluster.id, targets);
  }
  clusterTargetCache = { t, map };
  vizSimDirty = false;
  return map;
}

function sampleAttractorInto(field, x, y, out) {
  if (!field) {
    out.x = 0;
    out.y = 0;
    return false;
  }
  const p = field.placement;
  const lx = x - p.x;
  const ly = y - p.y;
  if (lx < 0 || ly < 0 || lx >= p.w || ly >= p.h) {
    out.x = 0;
    out.y = 0;
    return false;
  }
  const gx = Math.floor(lx / field.cellSize);
  const gy = Math.floor(ly / field.cellSize);
  if (gx < 0 || gy < 0 || gx >= field.cols || gy >= field.rows) {
    out.x = 0;
    out.y = 0;
    return false;
  }
  const idx = (gy * field.cols + gx) * 2;
  out.x = field.vecs[idx];
  out.y = field.vecs[idx + 1];
  return out.x !== 0 || out.y !== 0;
}

function sampleAttractorBlend(wx, wy, blendT) {
  const field = getBlendedAttractorField(blendT);
  const out = { x: 0, y: 0 };
  sampleAttractorInto(field, wx, wy, out);
  return createVector(out.x, out.y);
}

function getSituationBlendT() {
  if (!situationTransition.active) return playSituation === 1 ? 1 : 0;
  return situationTransition.blendT;
}

function startSituationTransition(toSit) {
  const target = toSit === 1 ? 1 : 0;
  if (vizMode !== 'play') {
    playSituation = target;
    situationTransition.active = false;
    situationTransition.blendT = target;
    return;
  }
  if (target === playSituation && !situationTransition.active) return;
  situationTransition.active = true;
  situationTransition.startMs = millis();
  situationTransition.fromSit = getSituationBlendT() < 0.5 ? 0 : 1;
  situationTransition.toSit = target;
  playSituation = target;
}

function updateSituationTransition(nowMs) {
  if (!situationTransition.active) {
    situationTransition.blendT = playSituation === 1 ? 1 : 0;
    return;
  }
  const dur = Math.max(1, CONFIG.visualizer.transitionDurationMs);
  const elapsed = nowMs - situationTransition.startMs;
  const raw = constrain(elapsed / dur, 0, 1);
  const eased = raw < 0.5 ? 4 * raw * raw * raw : 1 - Math.pow(-2 * raw + 2, 3) / 2;
  const fromT = situationTransition.fromSit === 1 ? 1 : 0;
  const toT = situationTransition.toSit === 1 ? 1 : 0;
  situationTransition.blendT = lerp(fromT, toT, eased);
  if (raw >= 1) {
    situationTransition.active = false;
    situationTransition.blendT = toT;
  }
}

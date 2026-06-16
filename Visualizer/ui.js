let vizUi = null;

function shouldBlockCanvasForTextInput() {
  if (typeof isEditingTextInput !== 'function' || !isEditingTextInput()) return false;
  return isPointerOverUI();
}

function blurVizTextInputs() {
  const active = document.activeElement;
  if (!active || (active.tagName !== 'INPUT' && active.tagName !== 'TEXTAREA')) return;
  const vizRoot = document.getElementById('viz-ui-root');
  if (vizRoot?.contains(active)) active.blur();
}

function finalizeClusterParticleCountInput() {
  if (!vizUi?.countInput) return;
  const raw = vizUi.countInput.value.trim();
  const count = Math.max(1, Math.floor(+raw || newClusterParticleCount || 1));
  newClusterParticleCount = count;
  if (selectedClusterId != null) {
    const c = getClusterById(selectedClusterId);
    if (c) {
      updateClusterParticleCount(c, count);
      if (vizMode === 'play') syncPlayParticlePool(getSituationBlendT());
    }
  }
  vizUi.countInput.value = String(
    selectedClusterId != null
      ? (getClusterParticleCount(getClusterById(selectedClusterId), getParticleCountSituation()) ?? count)
      : count
  );
}

function section(parent, title) {
  const sec = document.createElement('div');
  sec.className = 'ui-section';
  const t = document.createElement('div');
  t.className = 'ui-section-title';
  t.textContent = title;
  sec.appendChild(t);
  parent.appendChild(sec);
  return sec;
}

function row(parent) {
  const r = document.createElement('div');
  r.className = 'ui-row';
  parent.appendChild(r);
  return r;
}

function label(parent, text) {
  const s = document.createElement('span');
  s.textContent = text;
  parent.appendChild(s);
  return s;
}

function button(parent, text, onClick) {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = text;
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    onClick();
  });
  parent.appendChild(b);
  return b;
}

function initVisualizerUI() {
  const root = document.getElementById('viz-ui-root');
  if (!root || root.dataset.initialized === '1') return;
  root.dataset.initialized = '1';

  const modeSec = section(root, 'Mode');
  const modeRow = row(modeSec);
  const editBtn = button(modeRow, 'Edit', () => setVizMode('edit'));
  const playBtn = button(modeRow, 'Play', () => setVizMode('play'));

  const sitSec = section(root, 'Situation');
  const sitRow = row(sitSec);
  const sit1Btn = button(sitRow, 'Situation 1', () => selectSituation(0));
  const sit2Btn = button(sitRow, 'Situation 2', () => selectSituation(1));

  const toolSec = section(root, 'Shape tool');
  const toolRow = row(toolSec);
  const squareBtn = button(toolRow, 'Square', () => setShapeTool('square'));
  const circleBtn = button(toolRow, 'Circle', () => setShapeTool('circle'));
  const drawBtn = button(toolRow, 'Draw', () => setShapeTool('draw'));

  const clusterSec = section(root, 'Cluster');
  const countRow = row(clusterSec);
  const countLabel = label(countRow, 'Particles');
  const countInput = document.createElement('input');
  countInput.type = 'number';
  countInput.min = '1';
  countInput.max = '2000';
  countInput.step = '1';
  countInput.value = String(newClusterParticleCount);
  countInput.className = 'viz-count-input';
  countInput.setAttribute('aria-label', 'Particle count');
  const stopCanvas = (e) => e.stopPropagation();
  countInput.addEventListener('pointerdown', stopCanvas);
  countInput.addEventListener('mousedown', stopCanvas);
  countInput.addEventListener('click', stopCanvas);
  countInput.addEventListener('input', () => {
    const raw = countInput.value.trim();
    if (raw === '' || raw === '-') return;
    const count = Math.max(1, Math.floor(+raw || 1));
    newClusterParticleCount = count;
    if (selectedClusterId != null) {
      const c = getClusterById(selectedClusterId);
      if (c) {
        updateClusterParticleCount(c, count);
        if (vizMode === 'play') syncPlayParticlePool(getSituationBlendT());
      }
    }
  });
  countInput.addEventListener('change', finalizeClusterParticleCountInput);
  countInput.addEventListener('blur', finalizeClusterParticleCountInput);
  countRow.appendChild(countInput);

  const actionRow = row(clusterSec);
  const redrawBtn = button(actionRow, 'Redraw shape', () => startPolygonRedraw());
  const deleteBtn = button(actionRow, 'Delete selected', () => {
    if (selectedClusterId != null) {
      deleteCluster(selectedClusterId);
      if (vizMode === 'play') rebuildPlayParticles(getSituationBlendT());
      refreshVisualizerUI();
    }
  });

  vizUi = {
    root,
    editBtn,
    playBtn,
    sit1Btn,
    sit2Btn,
    toolSec,
    clusterSec,
    squareBtn,
    circleBtn,
    drawBtn,
    countLabel,
    countInput,
    redrawBtn,
    deleteBtn
  };
  refreshVisualizerUI();
}

function bringOverlayPanelsToFront() {
  for (const id of ['viz-ui-root', 'user-controls-root', 'record-indicator']) {
    const el = document.getElementById(id);
    if (el) document.body.appendChild(el);
  }
}

function wireUserControlsPointerIsolation() {
  const root = document.getElementById('user-controls-root');
  if (!root || root.dataset.pointerIso === '1') return;
  root.dataset.pointerIso = '1';
  const stop = (e) => e.stopPropagation();
  for (const type of ['pointerdown', 'pointermove', 'pointerup', 'mousedown', 'mousemove', 'mouseup', 'click', 'touchstart', 'touchmove', 'touchend']) {
    root.addEventListener(type, stop);
  }
  if (userStageSlider) {
    userStageSlider.addEventListener('mousedown', stop);
    userStageSlider.addEventListener('touchstart', stop, { passive: true });
  }
}

function initVisualizerTrailDefaults() {
  const cull = Math.max(0, Math.round(CONFIG.visualizer?.trailLowAlphaCull ?? CONFIG.trailLowAlphaCull ?? 15));
  CONFIG.trailLowAlphaCull = cull;
  if (typeof USER_STAGE_BASE !== 'undefined') USER_STAGE_BASE.zoom = 1;
  if (typeof USER_STAGE_PRESETS !== 'undefined') {
    for (const p of USER_STAGE_PRESETS) {
      p.trailCull = cull;
      p.zoom = 1;
    }
  }
  if (typeof setSliderValue === 'function' && colorTool?.trailLowAlphaCullSlider) {
    setSliderValue(colorTool.trailLowAlphaCullSlider, cull);
  }
}

function showUserPlayControls() {
  if (typeof setUiMode === 'function') {
    setUiMode('user');
  } else {
    const userControlsRoot = document.getElementById('user-controls-root');
    if (userControlsRoot) userControlsRoot.style.display = 'flex';
  }
  requestAnimationFrame(() => {
    if (typeof layoutUserControlsWidth === 'function') layoutUserControlsWidth();
    if (typeof applyUserStageAt === 'function' && userStageSlider) {
      applyUserStageAt(parseFloat(userStageSlider.value) || 0);
    }
  });
}

function hideUserPlayControls() {
  if (typeof setUiMode === 'function') {
    setUiMode('dev');
    const timelineRoot = document.getElementById('timeline-root');
    if (timelineRoot) timelineRoot.style.display = 'none';
    const devRoot = document.getElementById('ui-root');
    if (devRoot) devRoot.style.display = 'none';
    return;
  }
  const userControlsRoot = document.getElementById('user-controls-root');
  if (userControlsRoot) userControlsRoot.style.display = 'none';
}

function setVizMode(mode) {
  const next = mode === 'play' ? 'play' : 'edit';
  if (next === vizMode) return;
  vizMode = next;
  editDrag = null;
  activeDrawPath = null;
  cancelPolygonRedraw();

  if (vizMode === 'play') {
    playSituation = activeSituation;
    situationTransition.active = false;
    situationTransition.blendT = activeSituation === 1 ? 1 : 0;
    if (attractorDirty) rebuildAttractorFields();
    rebuildPlayParticles(getSituationBlendT());
    if (trailLayer) trailLayer.clear();
    hardClearMainCanvas();
    showUserPlayControls();
  } else {
    particles = [];
    if (trailLayer) trailLayer.clear();
    hardClearMainCanvas();
    situationTransition.active = false;
    situationTransition.blendT = activeSituation === 1 ? 1 : 0;
    playSituation = activeSituation;
    hideUserPlayControls();
  }
  refreshVisualizerUI();
}

function setShapeTool(tool) {
  if (tool === 'circle' || tool === 'square' || tool === 'draw') shapeTool = tool;
  else shapeTool = 'square';
  activeDrawPath = null;
  if (tool !== 'draw') cancelPolygonRedraw();
  refreshVisualizerUI();
}

function selectSituation(index) {
  const sit = index === 1 ? 1 : 0;
  if (vizMode === 'edit') {
    if (polygonRedrawTarget && polygonRedrawTarget.sitIndex !== sit) cancelPolygonRedraw();
    activeSituation = sit;
  } else startSituationTransition(sit);
  refreshVisualizerUI();
}

function refreshVisualizerUI() {
  if (!vizUi) return;
  const isPlay = vizMode === 'play';
  vizUi.editBtn.classList.toggle('is-active', vizMode === 'edit');
  vizUi.playBtn.classList.toggle('is-active', isPlay);
  if (vizUi.toolSec) vizUi.toolSec.style.display = isPlay ? 'none' : '';
  if (vizUi.clusterSec) vizUi.clusterSec.style.display = isPlay ? 'none' : '';
  const sit = vizMode === 'edit' ? activeSituation : playSituation;
  vizUi.sit1Btn.classList.toggle('is-active', sit === 0);
  vizUi.sit2Btn.classList.toggle('is-active', sit === 1);
  vizUi.squareBtn.classList.toggle('is-active', shapeTool === 'square');
  vizUi.circleBtn.classList.toggle('is-active', shapeTool === 'circle');
  vizUi.drawBtn.classList.toggle('is-active', shapeTool === 'draw');
  const sitNum = getParticleCountSituation() + 1;
  if (vizUi.countLabel) vizUi.countLabel.textContent = `Particles (S${sitNum})`;
  const sel = selectedClusterId != null ? getClusterById(selectedClusterId) : null;
  const canRedraw = vizMode === 'edit' && sel?.type === 'polygon';
  if (vizUi.redrawBtn) {
    const redrawSit = polygonRedrawTarget?.sitIndex ?? activeSituation;
    vizUi.redrawBtn.textContent = isPolygonRedrawActive()
      ? `Drawing S${redrawSit + 1}… (Esc cancel)`
      : `Redraw shape (S${activeSituation + 1})`;
    vizUi.redrawBtn.disabled = !canRedraw && !isPolygonRedrawActive();
    vizUi.redrawBtn.classList.toggle('is-active', isPolygonRedrawActive());
  }
  if (document.activeElement !== vizUi.countInput) {
    vizUi.countInput.value = String(
      sel ? getClusterParticleCount(sel, getParticleCountSituation()) : newClusterParticleCount
    );
  }
  vizUi.deleteBtn.disabled = selectedClusterId == null;
}

function isPointerOverUI() {
  const x = typeof winMouseX === 'number' ? winMouseX : mouseX;
  const y = typeof winMouseY === 'number' ? winMouseY : mouseY;
  const el = document.elementFromPoint(x, y);
  if (!el) return false;
  const roots = [
    'viz-ui-root',
    'ui-root',
    'timeline-root',
    'user-controls-root',
    'user-color-root',
    'user-stage-root'
  ];
  for (const id of roots) {
    const root = document.getElementById(id);
    if (root && root.contains(el)) return true;
  }
  return false;
}

function preserveVisualizerCamera(callback) {
  const z = camera?.zoom ?? 1;
  const cx = camera?.center?.x ?? (typeof width === 'number' ? width * 0.5 : 0);
  const cy = camera?.center?.y ?? (typeof height === 'number' ? height * 0.5 : 0);
  callback();
  if (camera) {
    camera.zoom = z;
    camera.center.set(cx, cy);
  }
  if (typeof syncCameraZoomUI === 'function') syncCameraZoomUI();
}

// Generator user-stage presets default to zoom: 3; keep edit/play framing identical in the visualizer.
const _generatorApplyUserStageAt = applyUserStageAt;
applyUserStageAt = function visualizerApplyUserStageAt(t) {
  preserveVisualizerCamera(() => _generatorApplyUserStageAt(t));
};
setCameraZoom = function visualizerSetCameraZoom(_nextZoom) {
  // Visualizer uses direct camera.zoom (wheel); block generator stage/dev zoom changes.
};

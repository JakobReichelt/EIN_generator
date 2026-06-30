const SCHENGEN_PARTICLE = { w: 1113 };
const SCHENGEN_SCREEN_CENTER = { x: FIGMA_W / 2, y: FIGMA_H / 2 };
const SCHENGEN_SCREEN_ROAM = 0.3;
const SCHENGEN_ASSEMBLY_DAMP = 0.38;
const SCHENGEN_REVEAL_DELAY_MS = 750;

function applyFigmaCenterSquare(el, cx, cy, size) {
  el.style.position = 'absolute';
  el.style.left = `${((cx - size / 2) / FIGMA_W) * 100}%`;
  el.style.top = `${((cy - size / 2) / FIGMA_H) * 100}%`;
  el.style.width = `calc(${size} * 100vw / var(--figma-canvas-width))`;
  el.style.height = `calc(${size} * 100vw / var(--figma-canvas-width))`;
  el.style.aspectRatio = '1';
}

function applyAssemblyOverlay(el, canvasPad, canvasSize, assemblySize) {
  const padPct = (canvasPad / assemblySize) * 100;
  const sizePct = (canvasSize / assemblySize) * 100;
  el.style.position = 'absolute';
  el.style.left = `${-padPct}%`;
  el.style.top = `${-padPct}%`;
  el.style.width = `${sizePct}%`;
  el.style.height = `${sizePct}%`;
}

function createSchengenStackFollower(stack, canvasScale) {
  const shiftPct = canvasScale * 100;

  function applyTransform(nx, ny) {
    stack.style.transform = `translate(${(nx - 0.5) * shiftPct}%, ${(ny - 0.5) * shiftPct}%)`;
  }

  applyTransform(0.5, 0.5);

  return {
    setPosition(nx, ny) {
      if (!Number.isFinite(nx) || !Number.isFinite(ny)) return;
      applyTransform(nx, ny);
    },
    cleanup() {}
  };
}

function createSchengenAssemblyFollower(assembly, size, home, roamX, roamY) {
  applyFigmaCenterSquare(assembly, home.x, home.y, size);

  return {
    setPosition(nx, ny) {
      if (!Number.isFinite(nx) || !Number.isFinite(ny)) return;
      const sx = 0.5 + (nx - 0.5) * SCHENGEN_ASSEMBLY_DAMP;
      const sy = 0.5 + (ny - 0.5) * SCHENGEN_ASSEMBLY_DAMP;
      const cx = home.x + (sx - 0.5) * 2 * roamX;
      const cy = home.y + (sy - 0.5) * 2 * roamY;
      applyFigmaCenterSquare(assembly, cx, cy, size);
    },
    cleanup() {}
  };
}

function scheduleSchengenReveal(assembly, onReveal) {
  assembly.style.removeProperty('opacity');
  assembly.style.removeProperty('transition');

  let revealTimer = 0;
  const startReveal = () => {
    revealTimer = 0;
    if (typeof onReveal === 'function') onReveal();
    requestAnimationFrame(() => {
      assembly.classList.add('answer2-schengen-assembly--visible');
    });
  };

  revealTimer = window.setTimeout(startReveal, SCHENGEN_REVEAL_DELAY_MS);

  return () => {
    if (revealTimer) window.clearTimeout(revealTimer);
  };
}

function addSchengenMapParticle(screen, topicId) {
  const topicColors = getQuizColorScheme(topicId);
  const { w } = SCHENGEN_PARTICLE;
  const canvasPad = w * 0.9;
  const canvasSize = w + canvasPad * 2;
  const canvasScale = canvasSize / w;
  const roamX = ((FIGMA_W - w) / 2) * SCHENGEN_SCREEN_ROAM;
  const roamY = ((FIGMA_H - w) / 2) * SCHENGEN_SCREEN_ROAM;

  const layer = document.createElement('div');
  layer.className = 'answer2-schengen-layer';
  screen.prepend(layer);

  const assembly = document.createElement('div');
  assembly.className = 'answer2-schengen-assembly';
  markStageExempt(assembly);
  assembly.style.removeProperty('opacity');
  assembly.style.removeProperty('transition');
  layer.appendChild(assembly);

  const region = createParticleRegion(screen, 0, 0, w, w, topicColors.user, {
    parent: assembly,
    spawnAnimation: false,
    startSimulationLocked: true,
    skipStageAnim: true,
    motionProfile: 'schengen',
    strokeAlpha: 100,
    strokeRatio: 1,
    strokeBaseNorm: w / canvasSize,
    anchorX: w / 2,
    anchorY: w / 2,
    startX: w / 2,
    startY: w / 2,
    wanderRadius: w * 0.11,
    softWanderClamp: true,
    edgeClamp: true,
    trailCull: 0,
    fade: 2
  });
  region.el.classList.add('answer2-schengen-region');
  applyAssemblyOverlay(region.el, canvasPad, canvasSize, w);
  markStageExempt(region.el);

  const mask = document.createElement('div');
  mask.className = 'answer2-schengen-mask';
  applyAssemblyOverlay(mask, canvasPad, canvasSize, w);
  markStageExempt(mask);

  const stack = document.createElement('div');
  stack.className = 'answer2-schengen-stack';
  const stackInsetPct = (canvasPad / canvasSize) * 100;
  const stackSizePct = (w / canvasSize) * 100;
  stack.style.left = `${stackInsetPct}%`;
  stack.style.top = `${stackInsetPct}%`;
  stack.style.width = `${stackSizePct}%`;
  stack.style.height = `${stackSizePct}%`;

  const mapLayer = document.createElement('div');
  mapLayer.className = 'answer2-schengen-map';

  const img = document.createElement('img');
  img.src = getSchengenMapAsset(topicId);
  img.alt = '';
  img.setAttribute('aria-hidden', 'true');
  img.draggable = false;
  mapLayer.appendChild(img);

  const ringLayer = document.createElement('div');
  ringLayer.className = 'answer2-schengen-ring';
  ringLayer.style.borderColor = topicColors.user;

  stack.appendChild(mapLayer);
  stack.appendChild(ringLayer);
  mask.appendChild(stack);
  assembly.appendChild(mask);

  const assemblyFollower = createSchengenAssemblyFollower(
    assembly,
    w,
    SCHENGEN_SCREEN_CENTER,
    roamX,
    roamY
  );
  const stackFollower = createSchengenStackFollower(stack, canvasScale);
  region.onPosition((nx, ny) => {
    stackFollower.setPosition(nx, ny);
    assemblyFollower.setPosition(nx, ny);
  });

  const cancelReveal = scheduleSchengenReveal(assembly, () => {
    region.setSimulationLocked(false);
  });

  if (!screen._particleCleanups) screen._particleCleanups = [];
  screen._particleCleanups.push(() => {
    cancelReveal();
    stackFollower.cleanup();
    assemblyFollower.cleanup();
    region.cleanup();
    layer.remove();
  });
}

registerStage({
  id: 'answer2',
  title: 'Answer 2 — Multiple Choice',

  onEnter() {},
  onExit() {},

  mount(container, ctx) {
    const CORRECT_ID = 3;
    const isCorrect = ctx.quizState.answers.q2Choice === CORRECT_ID;

    const { screen } = mountFigmaStage(container);
    addSchengenMapParticle(screen, ctx.quizState.topic);
    addPauseButton(screen, ctx);
    addAnswerHeader(
      screen,
      'Welches dieser Länder ist nicht Teil des Schengenraums?',
      isCorrect
        ? 'deine Antwort war<br>richtig!'
        : 'deine Antwort war<br>leider falsch.'
    );

    const answer = document.createElement('p');
    answer.className = 'figma-choice';
    applyPos(answer, 1338, 1081);
    answer.textContent = 'Irland';
    markStageTier(answer, 'none');
    screen.appendChild(answer);

    const explanation = document.createElement('p');
    explanation.className = 'figma-body-text';
    applyPos(explanation, 2073, 1081, 770);
    explanation.style.transform = 'translateY(-50%)';
    explanation.textContent =
      'Irland ist kein Teil des Schengen-Raums. Bei Reisen zwischen Irland und dem Schengen-Raum finden weiterhin reguläre Grenzkontrollen statt.';
    markStageTier(explanation, 'content');
    screen.appendChild(explanation);

    requestAnimationFrame(() => {
      const screenRect = screen.getBoundingClientRect();
      const answerRect = answer.getBoundingClientRect();
      if (!screenRect.height) return;
      const centerY = answerRect.top + answerRect.height / 2 - screenRect.top;
      explanation.style.top = `${(centerY / screenRect.height) * 100}%`;
    });

    addConfirmParticle(() => ctx.goNext(), { delayMs: 2000 });
  },

  unmount: unmountFigmaStage
});

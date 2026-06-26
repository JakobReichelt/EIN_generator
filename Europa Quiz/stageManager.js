const STAGE_ORDER = [
  'idle',
  'playerCount',
  'topicSelection',
  'difficulty',
  'ready',
  'question1',
  'answer1',
  'question2',
  'answer2',
  'question3Map',
  'answer3Map',
  'question4Timeline',
  'answer4Timeline',
  'results',
  'leaderboard'
];

const stageRegistry = new Map();
let currentStageIndex = 0;
let currentStageId = STAGE_ORDER[0];
let overlayContainer = null;
let stageCtx = null;
let devNavElements = null;
let transitionInProgress = false;
let transitionToken = 0;

const DEV_NAV_OPTIONS = {
  fromDevNav: true,
  skipExitTransition: true,
  skipEnterTransition: true
};

function registerStage(stageDef) {
  if (!stageDef?.id) return;
  stageRegistry.set(stageDef.id, stageDef);
}

function buildStageContext() {
  return {
    quizState: getQuizState(),
    goNext: (opts) => goNext(opts),
    goTo: (id, opts) => goTo(id, opts),
    setAnswer: (key, value) => setAnswer(key, value),
    setQuizMode: (mode) => setQuizMode(mode),
    setParticleId: (id) => setParticleId(id),
    setTopic: (topic) => setTopic(topic),
    setDifficulty: (difficulty) => setDifficulty(difficulty)
  };
}

function getCurrentStage() {
  return stageRegistry.get(currentStageId) ?? null;
}

function getCurrentStageId() {
  return currentStageId;
}

function getCurrentStageIndex() {
  return currentStageIndex;
}

function updateDevNav() {
  if (!devNavElements || !QUIZ_CONFIG.devNav) return;
  const stage = getCurrentStage();
  devNavElements.label.textContent = `Stage ${currentStageIndex + 1}/${STAGE_ORDER.length}: ${currentStageId}`;
  devNavElements.prevBtn.disabled = currentStageIndex <= 0;
  devNavElements.nextBtn.disabled = currentStageIndex >= STAGE_ORDER.length - 1;
  if (stage?.title && devNavElements.stageTitle) {
    devNavElements.stageTitle.textContent = stage.title;
  }
}

function getStageScreen() {
  return overlayContainer?.querySelector('.figma-screen') ?? null;
}

async function runStageEnterAnimation(screen, stageDef, options = {}) {
  if (!screen || !window.stageTransitions) return;

  const enterOpts = stageDef?.enterAnimation || {};
  if (options.skipEnterTransition) {
    stageTransitions.instantStageEnter(screen, enterOpts);
    return;
  }

  stageTransitions.prepareStageEnter(screen, enterOpts);
  try {
    await stageTransitions.animateStageEnter(screen, enterOpts);
  } finally {
    stageTransitions.restoreStageInteractivity(screen);
  }
}

async function transitionToStage(index, options = {}) {
  const nextId = STAGE_ORDER[index];
  if (!nextId) return;

  const { skipExitTransition = false, skipEnterTransition = false, fromDevNav = false } = options;

  if (!fromDevNav) {
    if (nextId === currentStageId) return;
    if (transitionInProgress) return;
  } else if (nextId === currentStageId && !transitionInProgress) {
    return;
  }

  if (fromDevNav && window.stageTransitions) {
    stageTransitions.cancelStageAnimations();
  }

  const token = ++transitionToken;
  transitionInProgress = true;
  const stale = () => token !== transitionToken;

  try {
    const prevStage = getCurrentStage();
    const prevScreen = getStageScreen();

    if (!skipExitTransition && prevScreen && window.stageTransitions) {
      await stageTransitions.animateStageExit(prevScreen);
    }
    if (stale()) return;

    if (prevStage?.onExit) {
      await prevStage.onExit(stageCtx);
    }
    if (stale()) return;

    if (prevStage?.unmount && overlayContainer) {
      prevStage.unmount(overlayContainer, stageCtx);
    }
    if (stale()) return;

    currentStageIndex = index;
    currentStageId = nextId;
    stageCtx = buildStageContext();

    if (overlayContainer) {
      overlayContainer.classList.remove('quiz-overlay--ready');
      overlayContainer.classList.remove('quiz-overlay--player-count');
      overlayContainer.classList.remove('quiz-overlay--figma');
      overlayContainer.innerHTML = '';
    }

    if (window.confirmParticle) window.confirmParticle.update();

    const nextStage = getCurrentStage();
    if (nextStage?.onEnter) {
      await nextStage.onEnter(stageCtx);
    }
    if (stale()) return;

    if (window.stageTransitions) stageTransitions.clearStageEnterDeferred();
    if (nextStage?.mount && overlayContainer) {
      nextStage.mount(overlayContainer, stageCtx);
    }
    if (stale()) return;

    updateDevNav();

    const newScreen = getStageScreen();
    await runStageEnterAnimation(newScreen, nextStage, { skipEnterTransition });
    if (stale()) return;

    if (window.pauseParticle) window.pauseParticle.update(currentStageId);

    if (typeof window.quizSketch?.onStageChange === 'function') {
      window.quizSketch.onStageChange(currentStageId, stageCtx);
    }
  } finally {
    if (!stale()) {
      transitionInProgress = false;
    }
  }
}

function goTo(id, options) {
  const index = STAGE_ORDER.indexOf(id);
  if (index < 0) return;
  transitionToStage(index, options);
}

function goNext(options) {
  if (currentStageIndex >= STAGE_ORDER.length - 1) return;
  transitionToStage(currentStageIndex + 1, options);
}

function goPrev(options) {
  if (currentStageIndex <= 0) return;
  transitionToStage(currentStageIndex - 1, options);
}

function devGoNext() {
  if (currentStageIndex >= STAGE_ORDER.length - 1) return;
  transitionToStage(currentStageIndex + 1, DEV_NAV_OPTIONS);
}

function devGoPrev() {
  if (currentStageIndex <= 0) return;
  transitionToStage(currentStageIndex - 1, DEV_NAV_OPTIONS);
}

function initDevNav() {
  const root = document.getElementById('dev-nav');
  if (!root) return;

  if (!QUIZ_CONFIG.devNav) {
    root.style.display = 'none';
    return;
  }

  root.innerHTML = '';
  root.classList.add('ui-panel');

  const title = document.createElement('div');
  title.className = 'dev-nav-title';
  title.textContent = 'Dev navigation';
  root.appendChild(title);

  const label = document.createElement('div');
  label.className = 'dev-nav-label';
  root.appendChild(label);

  const stageTitle = document.createElement('div');
  stageTitle.className = 'dev-nav-stage-title';
  root.appendChild(stageTitle);

  const btnRow = document.createElement('div');
  btnRow.className = 'ui-row';
  root.appendChild(btnRow);

  const prevBtn = document.createElement('button');
  prevBtn.type = 'button';
  prevBtn.textContent = 'Prev';
  prevBtn.addEventListener('click', () => devGoPrev());
  btnRow.appendChild(prevBtn);

  const nextBtn = document.createElement('button');
  nextBtn.type = 'button';
  nextBtn.textContent = 'Next';
  nextBtn.addEventListener('click', () => devGoNext());
  btnRow.appendChild(nextBtn);

  devNavElements = { label, stageTitle, prevBtn, nextBtn };
}

async function initStageManager() {
  overlayContainer = document.getElementById('quiz-overlay');
  if (!overlayContainer) {
    console.error('quiz-overlay element not found');
    return;
  }

  initDevNav();
  stageCtx = buildStageContext();

  if (window.pauseParticle) {
    window.pauseParticle.init(() => goTo('idle'));
    window.pauseParticle.update(currentStageId);
  }
  if (window.confirmParticle) window.confirmParticle.init();

  const firstStage = getCurrentStage();
  if (firstStage?.onEnter) await firstStage.onEnter(stageCtx);
  if (window.stageTransitions) stageTransitions.clearStageEnterDeferred();
  if (firstStage?.mount) firstStage.mount(overlayContainer, stageCtx);
  updateDevNav();

  const firstScreen = getStageScreen();
  await runStageEnterAnimation(firstScreen, firstStage);

  if (typeof window.quizSketch?.onStageChange === 'function') {
    window.quizSketch.onStageChange(currentStageId, stageCtx);
  }
}

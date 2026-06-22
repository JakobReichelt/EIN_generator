const STAGE_ORDER = [
  'idle',
  'playerCount',
  'particleSelection',
  'topicSelection',
  'difficulty',
  'question1',
  'answer1',
  'question2',
  'answer2',
  'question3Map',
  'answer3Map',
  'question4Timeline',
  'answer4Timeline'
];

const stageRegistry = new Map();
let currentStageIndex = 0;
let currentStageId = STAGE_ORDER[0];
let overlayContainer = null;
let stageCtx = null;
let devNavElements = null;

function registerStage(stageDef) {
  if (!stageDef?.id) return;
  stageRegistry.set(stageDef.id, stageDef);
}

function buildStageContext() {
  return {
    quizState: getQuizState(),
    goNext: () => goNext(),
    goTo: (id) => goTo(id),
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

async function transitionToStage(index) {
  const nextId = STAGE_ORDER[index];
  if (!nextId || nextId === currentStageId) return;

  const prevStage = getCurrentStage();
  if (prevStage?.onExit) {
    await prevStage.onExit(stageCtx);
  }
  if (prevStage?.unmount && overlayContainer) {
    prevStage.unmount(overlayContainer, stageCtx);
  }

  currentStageIndex = index;
  currentStageId = nextId;
  stageCtx = buildStageContext();

  if (overlayContainer) overlayContainer.innerHTML = '';

  const nextStage = getCurrentStage();
  if (nextStage?.onEnter) {
    await nextStage.onEnter(stageCtx);
  }
  if (nextStage?.mount && overlayContainer) {
    nextStage.mount(overlayContainer, stageCtx);
  }

  updateDevNav();

  // Future: trigger particle presets via window.quizSketch hooks per stage.
  if (typeof window.quizSketch?.onStageChange === 'function') {
    window.quizSketch.onStageChange(currentStageId, stageCtx);
  }
}

function goTo(id) {
  const index = STAGE_ORDER.indexOf(id);
  if (index < 0) return;
  transitionToStage(index);
}

function goNext() {
  if (currentStageIndex >= STAGE_ORDER.length - 1) return;
  transitionToStage(currentStageIndex + 1);
}

function goPrev() {
  if (currentStageIndex <= 0) return;
  transitionToStage(currentStageIndex - 1);
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
  prevBtn.addEventListener('click', () => goPrev());
  btnRow.appendChild(prevBtn);

  const nextBtn = document.createElement('button');
  nextBtn.type = 'button';
  nextBtn.textContent = 'Next';
  nextBtn.addEventListener('click', () => goNext());
  btnRow.appendChild(nextBtn);

  devNavElements = { label, stageTitle, prevBtn, nextBtn };
}

function initStageManager() {
  overlayContainer = document.getElementById('quiz-overlay');
  if (!overlayContainer) {
    console.error('quiz-overlay element not found');
    return;
  }

  initDevNav();
  stageCtx = buildStageContext();

  const firstStage = getCurrentStage();
  if (firstStage?.onEnter) firstStage.onEnter(stageCtx);
  if (firstStage?.mount) firstStage.mount(overlayContainer, stageCtx);
  updateDevNav();

  if (typeof window.quizSketch?.onStageChange === 'function') {
    window.quizSketch.onStageChange(currentStageId, stageCtx);
  }
}

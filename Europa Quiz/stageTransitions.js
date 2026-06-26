// Centralized stage enter/exit fade animations for overlay content.

const STAGE_TIER_ORDER = ['heading', 'content', 'interactive'];

const STAGE_EASE = 'cubic-bezier(0.4, 0, 0.2, 1)';
const STAGE_EXIT_MS = 400;
const STAGE_ENTER_MS = 320;
const STAGE_TIER_STAGGER_MS = 90;
const STAGE_SIBLING_STAGGER_MS = 35;

const deferredEnterCallbacks = {
  heading: [],
  content: [],
  interactive: []
};

let animationGeneration = 0;

function cancelStageAnimations() {
  animationGeneration += 1;
}

function isAnimationCancelled(gen) {
  return gen !== animationGeneration;
}

function markStageTier(el, tier) {
  if (!el) return el;
  el.setAttribute('data-stage-tier', tier);
  if (tier === 'none') {
    el.classList.remove('stage-enter-pending', 'stage-enter-active');
    el.style.removeProperty('opacity');
    el.style.removeProperty('transition');
    el.style.removeProperty('transition-delay');
    el.style.removeProperty('pointer-events');
  } else {
    el.classList.add('stage-enter-pending');
    el.classList.remove('stage-enter-active');
  }
  return el;
}

function revealStageElement(el) {
  if (!el) return el;
  el.classList.remove('stage-enter-pending');
  el.classList.add('stage-enter-active');
  el.style.opacity = '1';
  el.style.removeProperty('transition-delay');
  el.style.removeProperty('pointer-events');
  return el;
}

function markStageExempt(el) {
  if (!el) return el;
  el.setAttribute('data-stage-transition-exempt', '');
  revealStageElement(el);
  return el;
}

function clearStageEnterDeferred() {
  for (const tier of STAGE_TIER_ORDER) deferredEnterCallbacks[tier] = [];
}

function onEnterTier(tier, fn) {
  if (typeof fn !== 'function') return;
  if (!deferredEnterCallbacks[tier]) deferredEnterCallbacks[tier] = [];
  deferredEnterCallbacks[tier].push(fn);
}

function flushEnterTierCallbacks(tier) {
  const queue = deferredEnterCallbacks[tier] || [];
  deferredEnterCallbacks[tier] = [];
  for (const fn of queue) fn();
}

function normalizeKeep(keep) {
  if (!keep) return new Set();
  if (keep instanceof Set) return keep;
  if (Array.isArray(keep)) return new Set(keep);
  return new Set([keep]);
}

function isExempt(el) {
  return el.hasAttribute('data-stage-transition-exempt')
    || el.classList.contains('stage-transition-exempt');
}

function getStageAnimTargets(screen, opts = {}) {
  if (!screen) return [];
  const mode = opts.mode || 'exit';
  const skipTiers = new Set(opts.skipTiers || []);
  const keep = normalizeKeep(opts.keep);
  const filterTiers = opts.tiers ? new Set(opts.tiers) : null;

  const nodes = screen.querySelectorAll('[data-stage-tier]');
  const targets = [];

  for (const el of nodes) {
    const tier = el.getAttribute('data-stage-tier');
    if (!tier) continue;
    if (isExempt(el) || keep.has(el)) continue;

    if (mode === 'enter') {
      if (tier === 'none' || skipTiers.has(tier)) continue;
    } else if (filterTiers && !filterTiers.has(tier)) {
      continue;
    }

    targets.push({ el, tier });
  }

  return targets;
}

function applyTransitionStyle(el, durationMs) {
  el.style.transition = `opacity ${durationMs}ms ${STAGE_EASE}`;
}

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

async function fadeElementsOpacity(elements, toOpacity, durationMs) {
  if (!elements?.length) return;

  const gen = animationGeneration;
  const list = [...elements];

  for (const el of list) {
    const current = window.getComputedStyle(el).opacity;
    el.style.transition = 'none';
    el.style.opacity = current;
  }

  await nextFrame();
  if (isAnimationCancelled(gen)) return;

  for (const el of list) {
    applyTransitionStyle(el, durationMs);
    if (toOpacity === 0) el.style.pointerEvents = 'none';
  }

  await nextFrame();
  if (isAnimationCancelled(gen)) return;
  await nextFrame();
  if (isAnimationCancelled(gen)) return;

  for (const el of list) {
    el.style.opacity = String(toOpacity);
  }

  return waitForTransitions(list, durationMs, gen);
}

function waitForTransitions(elements, durationMs, gen = animationGeneration) {
  if (!elements.length) return Promise.resolve();

  return new Promise((resolve) => {
    let remaining = elements.length;
    let settled = false;

    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };

    const timeout = setTimeout(finish, durationMs + 80);

    const onEnd = (event) => {
      if (isAnimationCancelled(gen)) {
        clearTimeout(timeout);
        finish();
        return;
      }
      if (event.propertyName !== 'opacity') return;
      remaining -= 1;
      if (remaining <= 0) {
        clearTimeout(timeout);
        finish();
      }
    };

    for (const el of elements) {
      el.addEventListener('transitionend', onEnd, { once: true });
    }
  });
}

function groupTargetsByTier(targets) {
  const groups = { heading: [], content: [], interactive: [] };
  for (const { el, tier } of targets) {
    if (groups[tier]) groups[tier].push(el);
  }
  return groups;
}

function fadeTapStageText(screen, opts = {}) {
  const exitMs = opts.exitMs ?? STAGE_EXIT_MS;
  const delayMs = opts.delayMs ?? 0;
  const elements = [...(screen?.querySelectorAll('.figma-hero, .figma-hint') ?? [])];

  function runFade() {
    if (!elements.length) return Promise.resolve();
    return fadeElementsOpacity(elements, 0, exitMs);
  }

  if (delayMs > 0) {
    return new Promise((resolve) => {
      setTimeout(() => { runFade().then(resolve); }, delayMs);
    });
  }

  return runFade();
}

function animateStageExit(screen, opts = {}) {
  const exitMs = opts.exitMs ?? STAGE_EXIT_MS;
  const delayMs = opts.delayMs ?? 0;

  function runExit() {
    const targets = getStageAnimTargets(screen, { ...opts, mode: 'exit' });
    const elements = targets.map((t) => t.el);
    if (!elements.length) return Promise.resolve();
    return fadeElementsOpacity(elements, 0, exitMs);
  }

  if (delayMs > 0) {
    return new Promise((resolve) => {
      setTimeout(() => { runExit().then(resolve); }, delayMs);
    });
  }

  return runExit();
}

function restoreStageInteractivity(screen) {
  if (!screen) return;
  for (const el of screen.querySelectorAll('[data-stage-tier="interactive"]')) {
    el.style.removeProperty('pointer-events');
  }
}

function prepareStageEnter(screen, opts = {}) {
  const targets = getStageAnimTargets(screen, { ...opts, mode: 'enter' });
  for (const { el } of targets) {
    el.classList.add('stage-enter-pending');
    el.classList.remove('stage-enter-active');
    el.style.opacity = '0';
  }
  return targets;
}

async function animateStageEnter(screen, opts = {}) {
  if (!screen) return;

  const gen = animationGeneration;
  const targets = getStageAnimTargets(screen, { ...opts, mode: 'enter' });
  if (!targets.length) {
    screen.classList.remove('stage-enter-preparing');
    for (const tier of STAGE_TIER_ORDER) flushEnterTierCallbacks(tier);
    return;
  }

  const groups = groupTargetsByTier(targets);

  for (let ti = 0; ti < STAGE_TIER_ORDER.length; ti++) {
    if (isAnimationCancelled(gen)) return;

    const tier = STAGE_TIER_ORDER[ti];
    const elements = groups[tier];
    if (!elements.length) {
      flushEnterTierCallbacks(tier);
      continue;
    }

    screen.classList.remove('stage-enter-preparing');

    const tierDelay = ti * STAGE_TIER_STAGGER_MS;
    const tierPromises = [];

    for (let index = 0; index < elements.length; index++) {
      const el = elements[index];
      const delay = tierDelay + index * STAGE_SIBLING_STAGGER_MS;
      el.classList.remove('stage-enter-active');
      el.classList.add('stage-enter-pending');
      applyTransitionStyle(el, STAGE_ENTER_MS);
      el.style.transitionDelay = `${delay}ms`;
      el.style.opacity = '0';
    }

    // Two frames so the browser commits transition before the opacity target changes.
    await nextFrame();
    if (isAnimationCancelled(gen)) return;
    await nextFrame();
    if (isAnimationCancelled(gen)) return;

    elements.forEach((el) => {
      el.classList.remove('stage-enter-pending');
      el.classList.add('stage-enter-active');
      el.style.opacity = '1';

      const delay = Number.parseFloat(el.style.transitionDelay) || 0;
      tierPromises.push(waitForTransitions([el], STAGE_ENTER_MS + delay, gen));

      if (tier === 'interactive') {
        // Enable each control when its own fade-in starts, not when siblings finish.
        setTimeout(() => {
          el.style.removeProperty('pointer-events');
        }, delay);
      } else {
        el.style.removeProperty('pointer-events');
      }
    });

    await Promise.all(tierPromises);
    if (isAnimationCancelled(gen)) return;

    for (const el of elements) {
      el.style.transitionDelay = '';
    }

    flushEnterTierCallbacks(tier);
  }

  if (isAnimationCancelled(gen)) return;

  screen.classList.remove('stage-enter-preparing');
  restoreStageInteractivity(screen);
}

function instantStageEnter(screen, opts = {}) {
  if (!screen) return;

  const targets = getStageAnimTargets(screen, { ...opts, mode: 'enter' });
  for (const { el } of targets) {
    revealStageElement(el);
  }

  screen.classList.remove('stage-enter-preparing');
  for (const tier of STAGE_TIER_ORDER) flushEnterTierCallbacks(tier);
  restoreStageInteractivity(screen);
}

window.stageTransitions = {
  STAGE_TIER_ORDER,
  STAGE_EXIT_MS,
  STAGE_ENTER_MS,
  STAGE_EASE,
  markStageTier,
  markStageExempt,
  revealStageElement,
  getStageAnimTargets,
  animateStageExit,
  fadeTapStageText,
  prepareStageEnter,
  animateStageEnter,
  instantStageEnter,
  cancelStageAnimations,
  restoreStageInteractivity,
  onEnterTier,
  clearStageEnterDeferred
};

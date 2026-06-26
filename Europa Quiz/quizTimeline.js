// Interactive timeline placement for question4Timeline and answer4Timeline.

const TIMELINE_MARKER_SIZE = 260;
const TIMELINE_BLOB_RADIUS_RATIO = 0.38;
const TIMELINE_X_MIN = 0.066;
const TIMELINE_X_SPAN = 0.87;
const TIMELINE_LINE_Y_NORM = (1381.97 + 0.62 * 200) / FIGMA_H;
const TIMELINE_FALL_MS_PER_PX = 2.6;
const TIMELINE_FALL_MS_MIN = 700;
const TIMELINE_FALL_MS_MAX = 1600;
const TIMELINE_YEAR_MARKS = [
  { year: 1950, x: 189 },
  { year: 1975, x: 1011 },
  { year: 2000, x: 1835 },
  { year: 2025, x: 2683 },
  { year: 2050, x: 3515 }
];
const TIMELINE_YEAR_REVEAL_MS = 360;
const TIMELINE_CORRECT_YEAR = 1993;

let timelineHandoff = null;
let retainedTimeline = null;

function yearToTimelineT(year) {
  const marks = TIMELINE_YEAR_MARKS;
  if (year <= marks[0].year) return marks[0].x / FIGMA_W;
  for (let i = 1; i < marks.length; i++) {
    if (year <= marks[i].year) {
      const prev = marks[i - 1];
      const next = marks[i];
      const ratio = (year - prev.year) / (next.year - prev.year);
      const x = prev.x + ratio * (next.x - prev.x);
      return x / FIGMA_W;
    }
  }
  return marks[marks.length - 1].x / FIGMA_W;
}

function getCorrectTimelineT() {
  return QUIZ_SCORING?.correct?.q4Timeline ?? yearToTimelineT(TIMELINE_CORRECT_YEAR);
}

function tToNormX(t) {
  return TIMELINE_X_MIN + t * TIMELINE_X_SPAN;
}

function normXToT(x) {
  return clamp((x - TIMELINE_X_MIN) / TIMELINE_X_SPAN, 0, 1);
}

function getTimelineLine(screen) {
  return screen?.querySelector('.figma-timeline-line') ?? null;
}

function getTimelineMarkerRadiusPx() {
  const markerPx = (TIMELINE_MARKER_SIZE / FIGMA_W) * (window.innerWidth || FIGMA_W);
  return (markerPx / 2) * TIMELINE_BLOB_RADIUS_RATIO;
}

function timelineCirclesTouch(elA, elB) {
  if (!elA || !elB) return false;
  const a = elA.getBoundingClientRect();
  const b = elB.getBoundingClientRect();
  const ax = a.left + a.width / 2;
  const ay = a.top + a.height / 2;
  const bx = b.left + b.width / 2;
  const by = b.top + b.height / 2;
  const ra = (Math.min(a.width, a.height) / 2) * TIMELINE_BLOB_RADIUS_RATIO;
  const rb = (Math.min(b.width, b.height) / 2) * TIMELINE_BLOB_RADIUS_RATIO;
  return Math.hypot(ax - bx, ay - by) <= ra + rb;
}

function getTimelineTouchTolerance(lineEl) {
  const line = lineEl || document.querySelector('.figma-timeline-line');
  const width = line?.getBoundingClientRect().width ?? window.innerWidth;
  if (width < 1) return 0;
  return (2 * getTimelineMarkerRadiusPx()) / width;
}

function isTimelineAnswerCorrect(userT, lineEl) {
  if (userT == null || !Number.isFinite(userT)) return false;
  return Math.abs(userT - getCorrectTimelineT()) <= getTimelineTouchTolerance(lineEl);
}

function tToYearLabel(t) {
  const marks = TIMELINE_YEAR_MARKS.map((mark) => ({
    year: mark.year,
    t: mark.x / FIGMA_W
  }));

  if (t <= marks[0].t) return String(marks[0].year);
  for (let i = 1; i < marks.length; i++) {
    if (t <= marks[i].t) {
      const prev = marks[i - 1];
      const next = marks[i];
      const ratio = (t - prev.t) / (next.t - prev.t);
      return String(Math.round(prev.year + ratio * (next.year - prev.year)));
    }
  }
  return String(marks[marks.length - 1].year);
}

function setTimelineHandoff(state) {
  timelineHandoff = state;
}

function consumeTimelineHandoff() {
  const state = timelineHandoff;
  timelineHandoff = null;
  return state;
}

function retainQuizTimeline(controller) {
  if (!controller) return;
  retainedTimeline = controller;
  controller._setRetained(true);
}

function adoptQuizTimeline(screen) {
  if (!retainedTimeline) return null;
  const timeline = retainedTimeline;
  retainedTimeline = null;
  timeline._setRetained(false);
  timeline._attachToScreen(screen);
  return timeline;
}

function isQuizTimelineRetained() {
  return retainedTimeline !== null;
}

function createQuizTimeline(screen, options = {}) {
  let userMarker = null;
  let correctMarker = null;
  let userYearLabel = null;
  let correctYearLabel = null;
  let explanationEl = null;
  let timelineWrap = null;
  let retained = false;
  let interactive = true;
  let hostScreen = screen;

  const placementZone = document.createElement('div');
  placementZone.className = 'figma-timeline-placement-zone';
  markStageTier(placementZone, 'interactive');
  if (window.stageTransitions) markStageExempt(placementZone);

  function attachToScreen(targetScreen) {
    hostScreen = targetScreen;
    targetScreen.appendChild(placementZone);
  }

  function reattachToScreen(el) {
    if (!el || el.parentNode === hostScreen) return;
    hostScreen.appendChild(el);
  }

  function setTimelineWrap(wrap) {
    timelineWrap = wrap;
  }

  function getTimelineWrap() {
    return timelineWrap;
  }

  function _attachToScreen(targetScreen) {
    hostScreen = targetScreen;
    if (timelineWrap) reattachToScreen(timelineWrap);
    reattachToScreen(placementZone);
    reattachToScreen(userMarker?.el);
    reattachToScreen(correctMarker?.el);
    reattachToScreen(userYearLabel);
    reattachToScreen(correctYearLabel);
    reattachToScreen(explanationEl);
  }

  function _setRetained(value) {
    retained = !!value;
  }

  function getScreenRect() {
    return hostScreen.getBoundingClientRect();
  }

  function getLineRect() {
    const line = getTimelineLine(hostScreen);
    return line?.getBoundingClientRect() ?? null;
  }

  function clientToNorm(clientX, clientY) {
    const screenRect = getScreenRect();
    if (screenRect.width < 1 || screenRect.height < 1) {
      return { x: 0.5, y: TIMELINE_LINE_Y_NORM };
    }
    return {
      x: clamp((clientX - screenRect.left) / screenRect.width, 0, 1),
      y: clamp((clientY - screenRect.top) / screenRect.height, 0, 1)
    };
  }

  function getLineYNorm() {
    const lineRect = getLineRect();
    const screenRect = getScreenRect();
    if (!lineRect || screenRect.height < 1) return TIMELINE_LINE_Y_NORM;
    const lineCenterY = lineRect.top + lineRect.height / 2;
    return clamp((lineCenterY - screenRect.top) / screenRect.height, 0, 1);
  }

  function clientXToT(clientX) {
    const rect = getLineRect();
    if (!rect || rect.width < 1) return 0.5;
    return clamp((clientX - rect.left) / rect.width, 0, 1);
  }

  function tToScreenNormX(t) {
    const rect = getLineRect();
    const screenRect = getScreenRect();
    if (!rect || screenRect.width < 1) return tToNormX(t);
    const centerX = rect.left + t * rect.width;
    return clamp((centerX - screenRect.left) / screenRect.width, 0, 1);
  }

  function setMarkerNorm(marker, normX, normY) {
    if (!marker?.el) return;
    marker.el.style.left = `${normX * 100}%`;
    marker.el.style.top = `${normY * 100}%`;
    marker._normX = normX;
    marker._normY = normY;
  }

  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  let fallAnimId = null;

  function cancelSnap() {
    if (fallAnimId) {
      cancelAnimationFrame(fallAnimId);
      fallAnimId = null;
    }
  }

  function fallDurationMs(fromYNorm, toYNorm) {
    const screenRect = getScreenRect();
    const distancePx = Math.abs(fromYNorm - toYNorm) * screenRect.height;
    return clamp(
      distancePx * TIMELINE_FALL_MS_PER_PX,
      TIMELINE_FALL_MS_MIN,
      TIMELINE_FALL_MS_MAX
    );
  }

  function animateMarkerToLine(marker, fromYNorm, toYNorm, durationMs) {
    if (!marker?.el) return Promise.resolve();

    const el = marker.el;
    const normX = marker._normX ?? parseFloat(el.style.left) / 100;
    const startTime = performance.now();

    return new Promise((resolve) => {
      function frame(now) {
        const progress = clamp((now - startTime) / durationMs, 0, 1);
        const eased = easeInOutCubic(progress);
        const y = fromYNorm + (toYNorm - fromYNorm) * eased;
        el.style.left = `${normX * 100}%`;
        el.style.top = `${y * 100}%`;
        el.style.transform = 'translate(-50%, -50%)';
        marker._normX = normX;
        marker._normY = y;

        if (progress < 1) {
          fallAnimId = requestAnimationFrame(frame);
        } else {
          fallAnimId = null;
          setMarkerNorm(marker, normX, toYNorm);
          resolve();
        }
      }
      fallAnimId = requestAnimationFrame(frame);
    });
  }

  function removeYearLabel() {
    if (userYearLabel) {
      userYearLabel.remove();
      userYearLabel = null;
    }
  }

  function positionYearLabel(label, normX, normY) {
    label.style.left = `${normX * 100}%`;
    label.style.top = `${normY * 100}%`;
  }

  function removeCorrectYearLabel() {
    if (correctYearLabel) {
      correctYearLabel.remove();
      correctYearLabel = null;
    }
  }

  function showCorrectYearLabel(t) {
    removeCorrectYearLabel();
    if (t == null || !Number.isFinite(t)) return null;

    const normX = tToScreenNormX(t);
    const lineY = getLineYNorm();
    const label = document.createElement('p');
    label.className = 'figma-timeline-marker-year';
    label.textContent = tToYearLabel(t);
    positionYearLabel(label, normX, lineY);
    markStageTier(label, 'content');
    hostScreen.appendChild(label);
    correctYearLabel = label;
    return label;
  }

  function removeExplanation() {
    if (explanationEl) {
      explanationEl.remove();
      explanationEl = null;
    }
  }

  function addExplanation(t, text) {
    removeExplanation();
    if (t == null || !Number.isFinite(t)) return null;

    const normX = tToScreenNormX(t);
    const lineY = getLineYNorm();
    const el = document.createElement('p');
    el.className = 'figma-body-text figma-timeline-explanation';
    el.textContent = text;
    positionYearLabel(el, normX, lineY);
    markStageTier(el, 'content');
    hostScreen.appendChild(el);
    explanationEl = el;
    return el;
  }

  function showSettledYearLabel(t, normX, normY) {
    removeYearLabel();
    const label = document.createElement('p');
    label.className = 'figma-timeline-marker-year';
    label.textContent = tToYearLabel(t);
    positionYearLabel(label, normX, normY);
    label.setAttribute('data-stage-transition-exempt', '');
    label.style.opacity = '0';
    hostScreen.appendChild(label);
    userYearLabel = label;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!userYearLabel) return;
        userYearLabel.style.transition = `opacity ${TIMELINE_YEAR_REVEAL_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`;
        userYearLabel.style.opacity = '1';
        userYearLabel.removeAttribute('aria-hidden');
      });
    });
  }

  function spawnMarker(normX, normY, t, colorHex, kind, spawnOptions = {}) {
    const region = createParticleRegion(hostScreen, 0, 0, TIMELINE_MARKER_SIZE, TIMELINE_MARKER_SIZE, colorHex, {
      parent: hostScreen,
      anchorNorm: { x: normX, y: normY },
      spawnAnimation: spawnOptions.spawnAnimation !== false,
      skipStageAnim: true,
      motionProfile: 'pinned',
      wanderRadius: 8,
      strokeAlpha: 100
    });
    if (window.stageTransitions) {
      markStageExempt(region.el);
    } else {
      region.el.style.opacity = '1';
    }
    region.el.classList.add('figma-particle-region--timeline-marker');
    region.el.style.zIndex = kind === 'correct' ? '6' : '5';
    if (spawnOptions.hidden) {
      region.el.style.visibility = 'hidden';
      region.el.setAttribute('aria-hidden', 'true');
    }
    region._timelineT = t;
    region._normX = normX;
    region._normY = normY;
    return region;
  }

  function clearUserMarker() {
    cancelSnap();
    removeYearLabel();
    if (userMarker) {
      userMarker.cleanup();
      userMarker = null;
    }
  }

  function clearCorrectMarker() {
    if (correctMarker) {
      correctMarker.cleanup();
      correctMarker = null;
    }
    removeCorrectYearLabel();
  }

  function setUserPoint(t, colorHex, placeOptions = {}) {
    clearUserMarker();
    if (t == null || !Number.isFinite(t)) return null;

    const lineY = getLineYNorm();
    const normX = placeOptions.normX ?? tToScreenNormX(t);
    const fromY = placeOptions.normY ?? placeOptions.fromYNorm ?? lineY;
    const snap = placeOptions.snapToLine !== false;
    const alreadyOnLine = !snap || Math.abs(fromY - lineY) <= 0.001;

    if (snap && !alreadyOnLine) {
      userMarker = spawnMarker(normX, fromY, t, colorHex, 'user', placeOptions);
      const durationMs = fallDurationMs(fromY, lineY);
      animateMarkerToLine(userMarker, fromY, lineY, durationMs).then(() => {
        showSettledYearLabel(t, normX, lineY);
      });
    } else {
      userMarker = spawnMarker(normX, lineY, t, colorHex, 'user', placeOptions);
      setMarkerNorm(userMarker, normX, lineY);
      showSettledYearLabel(t, normX, lineY);
    }

    return userMarker;
  }

  function setCorrectPoint(t, colorHex, pointOptions = {}) {
    clearCorrectMarker();
    if (t == null || !Number.isFinite(t)) return null;
    const lineY = getLineYNorm();
    correctMarker = spawnMarker(tToScreenNormX(t), lineY, t, colorHex, 'correct', pointOptions);
    return correctMarker;
  }

  function checkPlacementCorrect(userT) {
    if (userT == null || !userMarker?.el) return false;

    const correct = getCorrectTimelineT();
    const hadCorrect = correctMarker !== null;
    if (!hadCorrect) {
      setCorrectPoint(correct, getActiveQuizColors().correct, {
        spawnAnimation: false,
        hidden: true
      });
    }

    const touches = timelineCirclesTouch(userMarker.el, correctMarker?.el);

    if (!hadCorrect) {
      clearCorrectMarker();
    }

    return touches;
  }

  function onPointerDown(e) {
    if (!interactive || e.button !== 0) return;
    const norm = clientToNorm(e.clientX, e.clientY);
    const t = clientXToT(e.clientX);
    if (options.onPlace) options.onPlace(t, norm.x, norm.y);
    e.preventDefault();
  }

  placementZone.addEventListener('pointerdown', onPointerDown);
  attachToScreen(screen);

  function setInteractive(enabled) {
    interactive = enabled;
    placementZone.style.pointerEvents = enabled ? 'auto' : 'none';
    placementZone.style.cursor = enabled ? 'crosshair' : 'default';
  }

  function destroy() {
    if (retained) return;
    cancelSnap();
    placementZone.removeEventListener('pointerdown', onPointerDown);
    clearUserMarker();
    clearCorrectMarker();
    removeYearLabel();
    removeExplanation();
    placementZone.remove();
  }

  const controller = {
    placementZone,
    setInteractive,
    setTimelineWrap,
    getTimelineWrap,
    setUserPoint,
    setCorrectPoint,
    showCorrectYearLabel,
    addExplanation,
    clearUserMarker,
    clearCorrectMarker,
    checkPlacementCorrect,
    getUserT: () => userMarker?._timelineT ?? null,
    _attachToScreen,
    _setRetained,
    destroy
  };

  return controller;
}

window.quizTimeline = {
  TIMELINE_MARKER_SIZE,
  TIMELINE_LINE_Y_NORM,
  getCorrectTimelineT,
  tToNormX,
  normXToT,
  tToYearLabel,
  yearToTimelineT,
  isTimelineAnswerCorrect,
  getTimelineTouchTolerance,
  timelineCirclesTouch,
  createQuizTimeline,
  retainQuizTimeline,
  adoptQuizTimeline,
  isQuizTimelineRetained,
  setTimelineHandoff,
  consumeTimelineHandoff
};

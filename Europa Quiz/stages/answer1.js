registerStage({
  id: 'answer1',
  title: 'Answer 1 — Estimate',

  onEnter() {},
  onExit() {},

  mount(container, ctx) {
    const user = ctx.quizState.answers.q1Estimate ?? 200000000;
    const correct = 450000000;
    const isCorrect = user === correct;
    const { screen } = mountFigmaStage(container);
    addPauseButton(screen, ctx);

    const topicColors = getQuizColorScheme(ctx.quizState.topic);
    const userColor = topicColors.user;
    const correctColor = topicColors.correct;

    const QUESTION_BOUNDS = { x: 1495, y: 654, w: 850, h: 1053 };

    // Centers a text element horizontally on a grid box, stacked above its top.
    // `row` lets multiple lines stack (0 = closest to the grid).
    function placeTextAboveBox(el, box, row = 0) {
      const cx = box.x + box.w / 2;
      const y = box.y - 110 - row * 110;
      applyPos(el, cx, y);
      el.style.transform = 'translateX(-50%)';
      el.style.textAlign = 'center';
    }

    particleField.attach(screen);
    markStageTier(screen.querySelector('canvas[data-stage-tier]'), 'none');

    particleField.resetGrid('estimate', {
      bounds: QUESTION_BOUNDS,
      value: user,
      colorHex: userColor
    });

    if (isCorrect) {
      addAnswerHeader(
        screen,
        'Wie viele Menschen wohnen in der EU?',
        'deine Antwort war<br>richtig!'
      );

      const value = document.createElement('p');
      value.className = 'figma-value';
      value.textContent = formatEuNumber(user);
      placeTextAboveBox(value, QUESTION_BOUNDS, 0);
      markStageTier(value, 'content');
      screen.appendChild(value);

      particleField.commit();
      particleField.enableInteractionAfterStageEnter({ preservePositions: true });
      addConfirmParticle(() => ctx.goNext(), { delayMs: 2000 });
      return;
    }

    addAnswerHeader(
      screen,
      'Wie viele Menschen wohnen in der EU?',
      'deine Antwort war<br>leider falsch.'
    );

    // Both grids share identical size and vertical position (matching the
    // question grid, so the estimate slide is purely horizontal); only their
    // horizontal slot differs, so they read as a direct comparison with the
    // same density.
    const GRID_W = QUESTION_BOUNDS.w;
    const GRID_H = QUESTION_BOUNDS.h;
    const GRID_Y = QUESTION_BOUNDS.y;
    const LEFT = { x: 1120 - GRID_W / 2, y: GRID_Y, w: GRID_W, h: GRID_H };
    const RIGHT = { x: 2720 - GRID_W / 2, y: GRID_Y, w: GRID_W, h: GRID_H };

    const userVal = document.createElement('p');
    userVal.className = 'figma-value';
    userVal.textContent = formatEuNumber(user);
    userVal.style.opacity = '0';
    userVal.style.transition = 'opacity 400ms ease';
    placeTextAboveBox(userVal, LEFT, 0);
    markStageTier(userVal, 'none');
    screen.appendChild(userVal);

    const userLbl = document.createElement('p');
    userLbl.className = 'figma-value-label';
    userLbl.textContent = 'deine Antwort';
    userLbl.style.opacity = '0';
    userLbl.style.transition = 'opacity 400ms ease';
    placeTextAboveBox(userLbl, LEFT, 1);
    markStageTier(userLbl, 'none');
    screen.appendChild(userLbl);

    const correctVal = document.createElement('p');
    correctVal.className = 'figma-value';
    correctVal.textContent = formatEuNumber(correct);
    correctVal.style.opacity = '0';
    correctVal.style.transition = 'opacity 400ms ease';
    placeTextAboveBox(correctVal, RIGHT, 0);
    markStageTier(correctVal, 'none');
    screen.appendChild(correctVal);

    const correctLbl = document.createElement('p');
    correctLbl.className = 'figma-value-label';
    correctLbl.textContent = 'richtige Antwort';
    correctLbl.style.opacity = '0';
    correctLbl.style.transition = 'opacity 400ms ease';
    placeTextAboveBox(correctLbl, RIGHT, 1);
    markStageTier(correctLbl, 'none');
    screen.appendChild(correctLbl);

    addConfirmParticle(() => ctx.goNext(), { delayMs: 2000 });

    const timers = [];

    timers.push(setTimeout(() => {
      particleField.moveGrid('estimate', LEFT);
      userVal.style.opacity = '1';
      userLbl.style.opacity = '1';
    }, 500));

    timers.push(setTimeout(() => {
      particleField.setDensityValue('estimate', correct);
    }, 1450));

    timers.push(setTimeout(() => {
      particleField.showGrid('correct', {
        x: RIGHT.x,
        y: RIGHT.y,
        w: RIGHT.w,
        h: RIGHT.h,
        value: correct,
        colorHex: correctColor
      });
      correctVal.style.opacity = '1';
      correctLbl.style.opacity = '1';
    }, 2100));

    particleField.commit();
    particleField.enableInteractionAfterStageEnter({ preservePositions: true });
    screen._answerTimers = timers;
  },

  unmount(container) {
    const screen = container.querySelector('.figma-screen');
    if (screen?._answerTimers) {
      for (const t of screen._answerTimers) clearTimeout(t);
      screen._answerTimers = [];
    }
    unmountFigmaStage(container);
  }
});

function formatEuNumber(n) {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

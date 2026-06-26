registerStage({
  id: 'question1',
  title: 'Question 1 — Estimate',

  onEnter() {},
  onExit() {},

  mount(container, ctx) {
    const { screen } = mountFigmaStage(container);
    addPauseButton(screen, ctx);
    addQuestionHeader(screen, 'Frage 1 von 4', 'Wie viele Menschen wohnen in der EU?');
    addInstruction(screen, 'wähle die richtige Menge aus');

    let value = ctx.quizState.answers.q1Estimate ?? 200000000;
    const valueEl = document.createElement('p');
    valueEl.className = 'figma-value';
    applyPos(valueEl, 1714, 542);
    valueEl.textContent = formatEuNumber(value);
    markStageTier(valueEl, 'content');
    screen.appendChild(valueEl);

    const gridColor = getQuizColorScheme(ctx.quizState.topic).user;
    const QUESTION_BOUNDS = { x: 1495, y: 654, w: 850, h: 1053 };

    particleField.attach(screen);
    const gridCanvas = screen.querySelector('canvas[data-stage-tier]');
    if (gridCanvas) markStageExempt(gridCanvas);

    particleField.resetGrid('estimate', {
      bounds: QUESTION_BOUNDS,
      value,
      colorHex: gridColor
    });
    particleField.commit();
    particleField.enableInteractionAfterStageEnter();

    const minusBtn = document.createElement('button');
    minusBtn.type = 'button';
    minusBtn.className = 'figma-adjust';
    minusBtn.textContent = '-';
    applyPos(minusBtn, 689, 930);
    minusBtn.addEventListener('click', () => {
      value = Math.max(0, value - 50000000);
      valueEl.textContent = formatEuNumber(value);
      particleField.setValue('estimate', value);
    });
    markStageTier(minusBtn, 'interactive');
    screen.appendChild(minusBtn);

    const plusBtn = document.createElement('button');
    plusBtn.type = 'button';
    plusBtn.className = 'figma-adjust';
    plusBtn.textContent = '+';
    applyPos(plusBtn, 2974, 930);
    plusBtn.addEventListener('click', () => {
      value += 50000000;
      valueEl.textContent = formatEuNumber(value);
      particleField.setValue('estimate', value);
    });
    markStageTier(plusBtn, 'interactive');
    screen.appendChild(plusBtn);

    addConfirmParticle(() => {
      ctx.setAnswer('q1Estimate', value);
      ctx.goNext();
    }, { label: 'Antwort bestätigen' });
  },

  unmount: unmountFigmaStage
});

function formatEuNumber(n) {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

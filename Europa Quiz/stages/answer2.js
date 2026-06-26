registerStage({
  id: 'answer2',
  title: 'Answer 2 — Multiple Choice',

  onEnter() {},
  onExit() {},

  mount(container, ctx) {
    const CORRECT_ID = 3;
    const isCorrect = ctx.quizState.answers.q2Choice === CORRECT_ID;

    const { screen } = mountFigmaStage(container);
    addPauseButton(screen, ctx);
    addAnswerHeader(
      screen,
      'Welches dieser Länder ist nicht Teil des Schengenraums?',
      isCorrect
        ? 'deine Antwort war<br>richtig!'
        : 'deine Antwort war<br>leider falsch.'
    );

    // Keep "Irland" exactly where the question stage hands it off (seamless
    // transition), then vertically center the explanation onto its center.
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

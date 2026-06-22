registerStage({
  id: 'answer4Timeline',
  title: 'Answer 4 — Timeline',

  onEnter() {},
  onExit() {},

  mount(container, ctx) {
    const { body } = stageShell(container, 'Answer 4', 'Your answer vs correct time on the timeline.');
    const { bar } = timelineBar(body);

    const userT = ctx.quizState.answers.q4Timeline;
    const correctT = 0.5;

    if (userT != null) {
      const userMarker = document.createElement('div');
      userMarker.className = 'quiz-timeline-marker quiz-timeline-marker-user';
      userMarker.style.left = `${userT * 100}%`;
      userMarker.title = 'Your answer';
      bar.appendChild(userMarker);
    }

    const correctMarker = document.createElement('div');
    correctMarker.className = 'quiz-timeline-marker quiz-timeline-marker-correct';
    correctMarker.style.left = `${correctT * 100}%`;
    correctMarker.title = 'Correct answer';
    bar.appendChild(correctMarker);

    const readouts = document.createElement('div');
    readouts.className = 'quiz-readout-row';
    body.appendChild(readouts);

    const yourVal = readoutBox(readouts, 'Your answer');
    const correctVal = readoutBox(readouts, 'Correct answer');
    yourVal.textContent = userT == null ? '—' : `${Math.round(userT * 100)}%`;
    correctVal.textContent = `${Math.round(correctT * 100)}%`;

    const actions = row(body);
    actions.className = 'ui-row quiz-actions';
    button(actions, 'Finish', () => {
      // End of quiz flow — restart stub for dev testing.
      resetQuizState();
      ctx.goTo('idle');
    });
  },

  unmount() {}
});

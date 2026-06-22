registerStage({
  id: 'answer1',
  title: 'Answer 1 — Estimate',

  onEnter() {},
  onExit() {},

  mount(container, ctx) {
    const { body } = stageShell(container, 'Answer 1', 'Your estimate vs the correct amount.');
    const readouts = document.createElement('div');
    readouts.className = 'quiz-readout-row';
    body.appendChild(readouts);

    const yourVal = readoutBox(readouts, 'Your answer');
    const correctVal = readoutBox(readouts, 'Correct answer');

    const estimate = ctx.quizState.answers.q1Estimate;
    yourVal.textContent = estimate == null ? '—' : String(estimate);
    correctVal.textContent = '—';

    const actions = row(body);
    actions.className = 'ui-row quiz-actions';
    button(actions, 'Continue', () => ctx.goNext());
  },

  unmount() {}
});

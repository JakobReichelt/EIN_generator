registerStage({
  id: 'answer2',
  title: 'Answer 2 — Multiple Choice',

  onEnter() {},
  onExit() {},

  mount(container, ctx) {
    const { body } = stageShell(container, 'Answer 2', 'Selected answer vs correct answer.');
    const readouts = document.createElement('div');
    readouts.className = 'quiz-readout-row';
    body.appendChild(readouts);

    const selectedVal = readoutBox(readouts, 'Your selection');
    const correctVal = readoutBox(readouts, 'Correct answer');

    const choice = ctx.quizState.answers.q2Choice;
    selectedVal.textContent = choice == null ? '—' : `Choice ${choice}`;
    correctVal.textContent = '—';

    const actions = row(body);
    actions.className = 'ui-row quiz-actions';
    button(actions, 'Continue', () => ctx.goNext());
  },

  unmount() {}
});

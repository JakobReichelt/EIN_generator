registerStage({
  id: 'question1',
  title: 'Question 1 — Estimate',

  onEnter() {},
  onExit() {},

  mount(container, ctx) {
    const { body } = stageShell(container, 'Question 1', 'Estimated guess — question content coming soon.');
    placeholderText(body, 'Enter your estimate below.');

    const inputRow = row(body);
    inputRow.className = 'ui-row quiz-input-row';
    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'quiz-number-input';
    input.placeholder = 'Your estimate';
    input.setAttribute('aria-label', 'Your estimate');
    inputRow.appendChild(input);

    const actions = row(body);
    actions.className = 'ui-row quiz-actions';
    button(actions, 'Submit', () => {
      const raw = input.value.trim();
      ctx.setAnswer('q1Estimate', raw === '' ? null : Number(raw));
      ctx.goNext();
    });
  },

  unmount() {}
});

registerStage({
  id: 'question2',
  title: 'Question 2 — Multiple Choice',

  onEnter() {},
  onExit() {},

  mount(container, ctx) {
    const { body } = stageShell(container, 'Question 2', 'Multiple choice — question content coming soon.');
    placeholderText(body, 'Select one answer.');

    const choices = row(body);
    choices.className = 'ui-row quiz-choices';

    for (let i = 1; i <= 4; i++) {
      button(choices, `Choice ${i}`, () => {
        ctx.setAnswer('q2Choice', i);
        ctx.goNext();
      });
    }
  },

  unmount() {}
});

registerStage({
  id: 'difficulty',
  title: 'Difficulty',

  onEnter() {},
  onExit() {},

  mount(container, ctx) {
    const { body } = stageShell(container, 'Choose Difficulty', 'Select a difficulty level for this round.');
    const actions = row(body);
    actions.className = 'ui-row quiz-actions';

    const levels = [
      { id: 'easy', label: 'Easy' },
      { id: 'medium', label: 'Medium' },
      { id: 'hard', label: 'Hard' }
    ];

    for (const level of levels) {
      button(actions, level.label, () => {
        ctx.setDifficulty(level.id);
        ctx.goNext();
      });
    }
  },

  unmount() {}
});

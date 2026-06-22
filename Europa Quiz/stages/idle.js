registerStage({
  id: 'idle',
  title: 'Idle / Welcome',

  onEnter() {},
  onExit() {},

  mount(container, ctx) {
    const { body } = stageShell(container, 'Europa Quiz', 'Welcome — content coming soon.');
    placeholderText(body, 'Press Start to begin.');
    const actions = row(body);
    actions.className = 'ui-row quiz-actions';
    button(actions, 'Start', () => ctx.goNext());
  },

  unmount() {}
});

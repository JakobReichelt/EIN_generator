registerStage({
  id: 'playerCount',
  title: 'Player Count',

  onEnter() {},
  onExit() {},

  mount(container, ctx) {
    const { body } = stageShell(container, 'Player Count', 'Choose singleplayer or teams.');
    const actions = row(body);
    actions.className = 'ui-row quiz-actions';

    button(actions, 'Singleplayer', () => {
      ctx.setQuizMode('single');
      ctx.goNext();
    });

    button(actions, 'Teams', () => {
      ctx.setQuizMode('teams');
      ctx.goNext();
    });
  },

  unmount() {}
});

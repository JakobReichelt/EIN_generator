registerStage({
  id: 'particleSelection',
  title: 'Particle Selection',

  onEnter() {},
  onExit() {},

  mount(container, ctx) {
    const { body } = stageShell(container, 'Select Your Particle', 'Choose the personal particle created elsewhere.');
    const grid = document.createElement('div');
    grid.className = 'quiz-particle-grid';
    placeholderText(grid, 'Particle slots will appear here.');
    body.appendChild(grid);

    const actions = row(body);
    actions.className = 'ui-row quiz-actions';
    button(actions, 'Continue', () => {
      ctx.setParticleId('placeholder');
      ctx.goNext();
    });
  },

  unmount() {}
});

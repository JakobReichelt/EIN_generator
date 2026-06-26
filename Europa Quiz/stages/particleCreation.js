registerStage({
  id: 'particleCreation',
  title: 'Particle Creation',

  onEnter() {},
  onExit() {},

  mount(container, ctx) {
    const state = ctx.quizState;
    const { screen } = mountFigmaStage(container);
    addPauseButton(screen, ctx);
    addTitle(screen, 'Dein Punkt');
    addSubtitle(screen, 'erstelle deinen eigenen Punkt');

    const form = document.createElement('div');
    form.className = 'figma-creation-form';

    const nameLabel = document.createElement('label');
    nameLabel.textContent = 'Name';
    nameLabel.htmlFor = 'figma-particle-name';
    const nameInput = document.createElement('input');
    nameInput.id = 'figma-particle-name';
    nameInput.type = 'text';
    nameInput.placeholder = 'Mein Punkt';
    nameInput.maxLength = 32;
    form.appendChild(nameLabel);
    form.appendChild(nameInput);

    const colorLabel = document.createElement('label');
    colorLabel.textContent = 'Farbe';
    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.value = PARTICLE_PALETTE.skyBlue;
    form.appendChild(colorLabel);
    form.appendChild(colorInput);

    const actions = document.createElement('div');
    actions.className = 'figma-creation-actions';

    const backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.textContent = 'Zurück';
    backBtn.addEventListener('click', () => ctx.goTo('particleSelection'));

    const skipBtn = document.createElement('button');
    skipBtn.type = 'button';
    skipBtn.textContent = 'Überspringen';
    skipBtn.addEventListener('click', () => {
      if (state.particleId) ctx.goTo('topicSelection');
      else ctx.goTo('particleSelection');
    });

    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'figma-btn-primary';
    saveBtn.textContent = 'Speichern';
    saveBtn.addEventListener('click', () => {
      const particle = createCustomParticle({
        name: nameInput.value,
        color: colorInput.value,
        size: 4
      });
      if (!particle) {
        nameInput.focus();
        return;
      }
      ctx.setParticleId(particle.id);
      ctx.goTo('particleSelection');
    });

    actions.appendChild(backBtn);
    actions.appendChild(skipBtn);
    actions.appendChild(saveBtn);
    form.appendChild(actions);
    screen.appendChild(form);
  },

  unmount: unmountFigmaStage
});

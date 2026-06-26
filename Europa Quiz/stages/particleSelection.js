registerStage({
  id: 'particleSelection',
  title: 'Particle Selection',

  onEnter() {},
  onExit() {},

  mount(container, ctx) {
    const state = ctx.quizState;
    const { screen } = mountFigmaStage(container);
    addPauseButton(screen, ctx);
    addTitle(screen, 'Wer bist du?');
    addSubtitle(screen, 'wähle deinen Punkt aus');

    addPlaceholder(screen, 1083, 599, 1672, 934, 'figma-placeholder--purple');

    const initials = [
      { letter: 'K', x: 1435, y: 1076 },
      { letter: 'J', x: 1866, y: 1162 },
      { letter: 'R', x: 2191, y: 847 },
      { letter: 'A', x: 2239, y: 1037 }
    ];
    const particles = getAvailableParticles();

    let selectedEl = null;

    for (let i = 0; i < initials.length; i++) {
      const init = initials[i];
      const particle = particles[i];
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'figma-particle-initial';
      el.style.border = 'none';
      el.style.background = 'transparent';
      el.style.cursor = 'pointer';
      el.style.zIndex = '4';
      applyPos(el, init.x, init.y, 80, 80);

      const letterEl = document.createElement('span');
      letterEl.className = 'figma-particle-initial-letter';
      letterEl.textContent = init.letter;
      el.appendChild(letterEl);

      const checkEl = createCheckmark();
      checkEl.classList.add('figma-particle-initial-check');
      el.appendChild(checkEl);

      el.addEventListener('click', () => {
        if (selectedEl) selectedEl.classList.remove('figma-particle-initial--selected');
        selectedEl = el;
        el.classList.add('figma-particle-initial--selected');
        const pick = particle ?? particles[0];
        if (pick) ctx.setParticleId(pick.id);
        showSelectionConfirm(screen);
      });

      screen.appendChild(el);
    }

    const footer = document.createElement('p');
    footer.className = 'figma-hint';
    footer.style.top = '79.8%';
    footer.textContent = 'noch keinen eigenen Punkt?';
    footer.style.cursor = 'pointer';
    footer.addEventListener('click', () => ctx.goTo('particleCreation'));
    screen.appendChild(footer);

    addSelectionConfirmButton(screen, () => {
      if (selectedEl) ctx.goTo('topicSelection');
    });

    addContinueButton(screen, () => ctx.goTo('particleCreation'), {
      variant: 'add',
      icon: '+',
      label: 'Neuen Punkt erstellen'
    });
  },

  unmount: unmountFigmaStage
});

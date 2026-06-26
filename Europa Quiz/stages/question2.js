registerStage({
  id: 'question2',
  title: 'Question 2 — Multiple Choice',

  onEnter() {},
  onExit() {},

  mount(container, ctx) {
    const { screen } = mountFigmaStage(container);
    addPauseButton(screen, ctx);
    addQuestionHeader(
      screen,
      'Frage 2 von 4',
      'Welches dieser Länder ist <em>nicht</em> Teil des Schengenraums?'
    );
    addInstruction(screen, 'wähle die richtige Antwort aus');
    const instruction = screen.querySelector('.figma-instruction');
    if (instruction) instruction.style.top = '17.92%';

    const choices = [
      { id: 1, label: 'Spanien', x: 660, y: 1080 },
      { id: 2, label: 'Schweden', x: 1974, y: 1079 },
      { id: 3, label: 'Irland', x: 3179, y: 1081 }
    ];

    const CORRECT_ID = 3;
    const ANSWER_X = 1338;
    const TRANSITION_MS = 950;
    const TRANSITION_EASE = 'cubic-bezier(0.65, 0, 0.35, 1)';

    const particleColor = getQuizColorScheme(ctx.quizState.topic).user;

    let selected = ctx.quizState.answers.q2Choice;
    let selectionRegion = null;
    let selectedChoice = null;
    let transitioning = false;
    const choiceEls = [];

    function clearSelection() {
      if (!selectionRegion) return;
      selectionRegion.remove();
      selectionRegion = null;
      selectedChoice = null;
    }

    function showSelection(choice) {
      selected = choice.id;
      ctx.setAnswer('q2Choice', choice.id);

      if (!selectionRegion) {
        selectionRegion = spawnAnchoredParticle(
          screen,
          choice.x,
          choice.y,
          CHOICE_PARTICLE_SIZE,
          null,
          { colorHex: particleColor }
        );
      } else {
        selectionRegion.setAnchor(choice.x, choice.y);
      }

      selectedChoice = choice;
    }

    function playAnswerTransition() {
      const correctEntry = choiceEls.find((e) => e.choice.id === CORRECT_ID);
      const keep = correctEntry ? correctEntry.el : null;

      if (keep) markStageExempt(keep);

      const exitMs = window.stageTransitions?.STAGE_EXIT_MS ?? 400;
      const exitPromise = window.stageTransitions
        ? stageTransitions.animateStageExit(screen, { keep, exitMs })
        : Promise.resolve();
      const confirmPromise = window.confirmParticle
        ? confirmParticle.fadeOut(exitMs)
        : Promise.resolve();

      if (selectionRegion) {
        Promise.all([exitPromise, confirmPromise]).then(clearSelection);
      }

      if (correctEntry) {
        const el = correctEntry.el;
        const deltaX = ANSWER_X - correctEntry.choice.x;
        el.style.transition = `transform ${TRANSITION_MS}ms ${TRANSITION_EASE}`;
        el.style.transform =
          `translateX(calc(-50% + ${deltaX} * 100vw / var(--figma-canvas-width)))`;
      }

      setTimeout(() => ctx.goNext({ skipExitTransition: true }), TRANSITION_MS);
    }

    for (const choice of choices) {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'figma-choice';
      el.textContent = choice.label;
      el.style.left = `${(choice.x / FIGMA_W) * 100}%`;
      el.style.top = `${(choice.y / FIGMA_H) * 100}%`;
      el.style.background = 'transparent';
      el.style.border = 'none';
      el.style.cursor = 'pointer';
      el.style.zIndex = '3';
      el.addEventListener('click', () => {
        if (transitioning) return;
        showSelection(choice);
      });
      markStageTier(el, 'interactive');
      screen.appendChild(el);
      choiceEls.push({ choice, el });
    }

    if (selected != null) {
      const choice = choices.find((c) => c.id === selected);
      if (choice) showSelection(choice);
    }

    addConfirmParticle(() => {
      if (selected == null || transitioning) return;
      transitioning = true;
      playAnswerTransition();
    }, { label: 'Antwort bestätigen' });
  },

  unmount: unmountFigmaStage
});

registerStage({
  id: 'difficulty',
  title: 'Difficulty',

  onEnter() {},
  onExit() {},

  mount(container, ctx) {
    const { screen } = mountFigmaStage(container);
    addPauseButton(screen, ctx);
    addTitle(screen, 'Schwierigkeit');
    addSubtitle(screen, 'wähle die Schwierigkeit deines Quizzes');

    const topicColors = getQuizColorScheme(ctx.quizState.topic);
    const levels = [
      { id: 'easy', label: 'Einstieger', x: 960, y: 1080, colorHex: topicColors.difficultyEasy },
      { id: 'medium', label: 'Kira', x: 1920, y: 1080, colorHex: topicColors.difficultyMedium },
      { id: 'hard', label: 'EU-Insider', x: 2880, y: 1080, colorHex: topicColors.difficultyHard }
    ];

    for (const level of levels) {
      addChoiceText(screen, level.label, level.x, level.y);
      const region = spawnAnchoredParticle(
        screen,
        level.x,
        level.y,
        CHOICE_PARTICLE_SIZE,
        null,
        { colorHex: level.colorHex }
      );
      addSelectableHitArea(
        screen,
        region,
        () => {
          ctx.setDifficulty(level.id);
          ctx.goNext();
        },
        level.label,
        { textAnchor: { x: level.x, y: level.y } }
      );
    }

    addSelectionConfirmButton(screen);
  },

  unmount: unmountFigmaStage
});

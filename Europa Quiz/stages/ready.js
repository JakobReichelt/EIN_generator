registerStage({
  id: 'ready',
  title: 'Ready',

  onEnter() {},
  onExit() {},

  mount(container, ctx) {
    const { screen } = mountFigmaStage(container, { tap: true });
    const topicColors = getQuizColorScheme(ctx.quizState.topic);
    const line = addTopParticleLine(screen, { colors: topicColors.linePalette });
    addPauseButton(screen, ctx);
    addHero(screen, 'bereit?');
    addHint(screen, 'tippen, um mit der ersten Frage zu beginnen');
    wireTapToProceed(screen, ctx, {
      onProceed: (event) => {
        let textDone = false;
        let particlesDone = false;

        function maybeAdvance() {
          if (textDone && particlesDone) {
            ctx.goNext({ skipExitTransition: true });
          }
        }

        if (window.stageTransitions) {
          stageTransitions.animateStageExit(screen, {
            delayMs: window.TOP_LINE_TEXT_EXIT_DELAY_MS,
            exitMs: window.TOP_LINE_TEXT_EXIT_MS
          }).then(() => {
            textDone = true;
            maybeAdvance();
          });
        } else {
          textDone = true;
        }

        line.proceedWithImpulse(
          { clientX: event?.clientX, clientY: event?.clientY },
          () => {
            particlesDone = true;
            maybeAdvance();
          }
        );
      }
    });
  },

  unmount(container) {
    const screen = container.querySelector('.figma-screen');
    if (screen?._tapCleanup) screen._tapCleanup();
    unmountFigmaStage(container);
  }
});

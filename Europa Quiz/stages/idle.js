registerStage({
  id: 'idle',
  title: 'Idle / Welcome',

  onEnter() {},
  onExit() {},

  mount(container, ctx) {
    const { screen } = mountFigmaStage(container, { tap: true });
    const line = addTopParticleLine(screen);
    addHero(screen, 'EUROPA QUIZ');
    addHint(screen, 'tippen, um zu beginnen');
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

  unmount: unmountFigmaStage
});

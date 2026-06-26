const MAP_ANSWER_EXPLANATION =
  'Der Papst wohnt im Vatikan, ein eigener Staat in der Italienischen Hauptstadt.';

registerStage({
  id: 'answer3Map',
  title: 'Answer 3 — Map',

  onEnter() {},
  onExit() {},

  mount(container, ctx) {
    const { screen } = mountFigmaStage(container);
    addPauseButton(screen, ctx);

    const handoff = europeMap.consumeMapHandoff();
    const userPoint = handoff?.userPoint ?? ctx.quizState.answers.q3MapPoint;
    const correctPoint = handoff?.correctPoint ?? europeMap.getCorrectMapPoint();
    const isCorrect = handoff?.isCorrect ?? europeMap.isMapAnswerCorrect(userPoint);

    const topicColors = getQuizColorScheme(ctx.quizState.topic);
    const userColor = topicColors.user;
    const noSpawn = { spawnAnimation: false };

    let map = europeMap.adoptEuropeMap(screen, { topicId: handoff?.topicId ?? ctx.quizState.topic });
    const adopted = !!map;

    if (!map) {
      map = europeMap.createEuropeMap(screen, {
        topicId: handoff?.topicId ?? ctx.quizState.topic,
        viewport: handoff?.viewport,
        interactive: false
      });
    } else {
      map.setInteractive(false);
    }
    screen._mapController = map;

    if (!adopted) {
      map.clearUserMarker();
      map.setCorrectPoint(correctPoint, topicColors.correct, noSpawn);
      if (!isCorrect && userPoint) {
        map.setUserPoint(userPoint, userColor, noSpawn);
      }
    } else if (isCorrect) {
      map.clearUserMarker();
    }

    markStageExempt(map.viewport);
    if (window.stageTransitions) {
      stageTransitions.revealStageElement(map.viewport);
    }

    const resultHtml = isCorrect
      ? 'deine Antwort war<br>richtig!'
      : 'deine Antwort war<br>leider falsch.';

    const header = addAnswerHeader(screen, 'Wo wohnt der Papst?', resultHtml);

    const explanation = map.world.querySelector('.figma-map-explanation')
      || map.addExplanation(correctPoint, MAP_ANSWER_EXPLANATION);

    if (!adopted) {
      requestAnimationFrame(() => {
        if (isCorrect) {
          map.animateToFitCenter(correctPoint, 0.14, 0);
        } else if (userPoint) {
          map.fitToContent(
            europeMap.getMapFitPoints(userPoint, correctPoint),
            0.1,
            { screen }
          );
        }
      });
    }

    if (window.stageTransitions) {
      stageTransitions.revealStageElement(header);
      stageTransitions.revealStageElement(explanation);
    }

    addConfirmParticle(() => ctx.goNext(), { delayMs: 2000 });
  },

  enterAnimation: {
    skipTiers: ['heading', 'content', 'interactive']
  },

  unmount(container) {
    const screen = container.querySelector('.figma-screen');
    const map = screen?._mapController;
    if (map && !europeMap.isEuropeMapRetained()) {
      map.destroy();
    }
    if (screen) screen._mapController = null;
    unmountFigmaStage(container);
  }
});

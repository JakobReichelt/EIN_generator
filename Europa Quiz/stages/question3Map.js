registerStage({
  id: 'question3Map',
  title: 'Question 3 — Map',

  onEnter() {},
  onExit() {},

  mount(container, ctx) {
    const { screen } = mountFigmaStage(container);
    addPauseButton(screen, ctx);

    const topicColors = getQuizColorScheme(ctx.quizState.topic);
    const particleColor = topicColors.user;
    const correctPoint = europeMap.getCorrectMapPoint();

    let placed = ctx.quizState.answers.q3MapPoint;
    let transitioning = false;

    function showConfirm() {
      if (!window.confirmParticle) return;
      confirmParticle.show({
        onClick: () => {
          if (!placed || transitioning) return;
          playTransition();
        },
        label: 'Antwort bestätigen'
      });
    }

    const map = europeMap.createEuropeMap(screen, {
      topicId: ctx.quizState.topic,
      onPlace(norm) {
        if (transitioning) return;
        placed = norm;
        ctx.setAnswer('q3MapPoint', norm);
        map.setUserPoint(norm, particleColor);
        showConfirm();
      }
    });
    screen._mapController = map;

    const header = addQuestionHeader(screen, 'Frage 3 von 4', 'Wo wohnt der Papst?');
    const instruction = addInstruction(screen, 'bewege die Karte und platziere deinen Punkt');

    if (placed) {
      map.setUserPoint(placed, particleColor);
      showConfirm();
    }

    async function playTransition() {
      transitioning = true;
      const exitMs = window.stageTransitions?.STAGE_EXIT_MS ?? 400;
      const isCorrect = map.checkPlacementCorrect(placed);

      markStageExempt(map.viewport);
      if (window.stageTransitions) {
        stageTransitions.revealStageElement(map.viewport);
      }

      const fadeTargets = [header, instruction];
      for (const el of fadeTargets) {
        el.style.transition = `opacity ${exitMs}ms ease`;
        el.style.opacity = '0';
      }

      const confirmPromise = window.confirmParticle
        ? confirmParticle.fadeOut(exitMs)
        : Promise.resolve();

      await confirmPromise;

      map.clearUserMarker();
      map.setCorrectPoint(correctPoint, topicColors.correct, {
        spawnAnimation: false
      });

      if (isCorrect) {
        await map.animateToFitCenter(correctPoint, 0.14, 950);
      } else {
        map.setUserPoint(placed, particleColor, { spawnAnimation: false });
        map.addExplanation(
          correctPoint,
          'Der Papst wohnt im Vatikan, ein eigener Staat in der Italienischen Hauptstadt.'
        );
        const fitPoints = europeMap.getMapFitPoints(placed, correctPoint);
        await map.animateToFit(fitPoints, 0.1, 950, { screen });
      }

      europeMap.setMapHandoff({
        viewport: map.getViewport(),
        userPoint: placed,
        correctPoint,
        isCorrect,
        topicId: ctx.quizState.topic
      });

      europeMap.retainEuropeMap(map);
      ctx.goNext({ skipExitTransition: true });
    }
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

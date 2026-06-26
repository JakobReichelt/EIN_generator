registerStage({
  id: 'question4Timeline',
  title: 'Question 4 — Timeline',

  onEnter() {},
  onExit() {},

  mount(container, ctx) {
    const { screen } = mountFigmaStage(container);
    addPauseButton(screen, ctx);

    const topicColors = getQuizColorScheme(ctx.quizState.topic);
    const particleColor = topicColors.user;
    const correctT = quizTimeline.getCorrectTimelineT();

    let placedT = ctx.quizState.answers.q4Timeline;
    let transitioning = false;

    function showConfirm() {
      if (!window.confirmParticle) return;
      confirmParticle.show({
        onClick: () => {
          if (placedT == null || transitioning) return;
          playTransition();
        },
        label: 'Antwort bestätigen'
      });
    }

    const timelineWrap = buildTimeline(screen);
    if (window.stageTransitions) {
      markStageExempt(timelineWrap);
    }

    const timeline = quizTimeline.createQuizTimeline(screen, {
      onPlace(t, normX, normY) {
        if (transitioning) return;
        placedT = t;
        ctx.setAnswer('q4Timeline', t);
        timeline.setUserPoint(t, particleColor, { normX, normY, snapToLine: true });
        showConfirm();
      }
    });
    timeline.setTimelineWrap(timelineWrap);
    screen._timelineController = timeline;

    const header = addQuestionHeader(screen, 'Frage 4 von 4', 'Wann wurde die EU gegründet?');
    const instruction = addInstruction(screen, 'platziere deinen Punkt in der Nähe der Zeitachse');
    instruction.style.top = '11.76%';

    if (placedT != null) {
      timeline.setUserPoint(placedT, particleColor, { snapToLine: false, spawnAnimation: false });
      showConfirm();
    }

    async function playTransition() {
      transitioning = true;
      const exitMs = window.stageTransitions?.STAGE_EXIT_MS ?? 400;
      const isCorrect = timeline.checkPlacementCorrect(placedT);

      markStageExempt(timeline.placementZone);
      if (window.stageTransitions) {
        stageTransitions.revealStageElement(timeline.placementZone);
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

      timeline.setInteractive(false);
      if (isCorrect) {
        timeline.clearUserMarker();
      }
      timeline.setCorrectPoint(correctT, topicColors.correct, { spawnAnimation: false });

      quizTimeline.setTimelineHandoff({
        userT: placedT,
        correctT,
        isCorrect,
        topicId: ctx.quizState.topic
      });

      quizTimeline.retainQuizTimeline(timeline);
      ctx.goNext({ skipExitTransition: true });
    }
  },

  unmount(container) {
    const screen = container.querySelector('.figma-screen');
    const timeline = screen?._timelineController;
    if (timeline && !quizTimeline.isQuizTimelineRetained()) {
      timeline.destroy();
    }
    if (screen) screen._timelineController = null;
    unmountFigmaStage(container);
  }
});

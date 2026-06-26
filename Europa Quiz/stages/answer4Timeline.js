const TIMELINE_ANSWER_EXPLANATION =
  'Die Europäische Union (EU) in ihrer heutigen Form existiert seit dem 1. November 1993, als der Vertrag von Maastricht in Kraft trat.';

registerStage({
  id: 'answer4Timeline',
  title: 'Answer 4 — Timeline',

  onEnter() {},
  onExit() {},

  mount(container, ctx) {
    const { screen } = mountFigmaStage(container);
    addPauseButton(screen, ctx);

    const handoff = quizTimeline.consumeTimelineHandoff();
    const userT = handoff?.userT ?? ctx.quizState.answers.q4Timeline;
    const correctT = handoff?.correctT ?? quizTimeline.getCorrectTimelineT();
    const isCorrect = handoff?.isCorrect
      ?? quizTimeline.isTimelineAnswerCorrect(userT, null);

    const topicColors = getQuizColorScheme(ctx.quizState.topic);
    const userColor = topicColors.user;
    const noSpawn = { spawnAnimation: false, snapToLine: false };

    let timeline = quizTimeline.adoptQuizTimeline(screen);
    const adopted = !!timeline;

    if (!timeline) {
      const builtWrap = buildTimeline(screen);
      if (window.stageTransitions) {
        markStageExempt(builtWrap);
      }
      timeline = quizTimeline.createQuizTimeline(screen);
      timeline.setTimelineWrap(builtWrap);
      timeline.setInteractive(false);
      timeline.setCorrectPoint(correctT, topicColors.correct, noSpawn);
      if (!isCorrect && userT != null) {
        timeline.setUserPoint(userT, userColor, noSpawn);
      }
    } else {
      timeline.setInteractive(false);
    }

    screen._timelineController = timeline;

    const timelineWrap = timeline.getTimelineWrap() || screen.querySelector('.figma-timeline');
    if (timelineWrap && window.stageTransitions) {
      markStageExempt(timelineWrap);
    }

    const yearLabel = timeline.showCorrectYearLabel(correctT);
    const explanation = timeline.addExplanation(correctT, TIMELINE_ANSWER_EXPLANATION);

    const resultHtml = isCorrect
      ? 'deine Antwort war<br>richtig!'
      : 'deine Antwort war<br>leider falsch.';

    const header = addAnswerHeader(screen, 'Wann wurde die EU gegründet?', resultHtml);

    if (window.stageTransitions) {
      if (timelineWrap) stageTransitions.revealStageElement(timelineWrap);
      stageTransitions.revealStageElement(header);
      if (yearLabel) stageTransitions.revealStageElement(yearLabel);
      if (explanation) stageTransitions.revealStageElement(explanation);
    }

    addConfirmParticle(() => {
      setTimeout(() => ctx.goTo('results'), 0);
    }, { delayMs: 2000 });
  },

  enterAnimation: {
    skipTiers: ['heading', 'content', 'interactive']
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

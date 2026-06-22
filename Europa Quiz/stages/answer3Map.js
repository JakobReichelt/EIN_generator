registerStage({
  id: 'answer3Map',
  title: 'Answer 3 — Map',

  onEnter() {},
  onExit() {},

  mount(container, ctx) {
    const { body } = stageShell(container, 'Answer 3', 'Your selection vs correct position on the map.');
    const map = mapContainer(body);

    const userPoint = ctx.quizState.answers.q3MapPoint;
    const correctPoint = { x: 0.5, y: 0.5 };

    if (userPoint) {
      const userMarker = document.createElement('div');
      userMarker.className = 'quiz-map-marker quiz-map-marker-user';
      userMarker.style.left = `${userPoint.x * 100}%`;
      userMarker.style.top = `${userPoint.y * 100}%`;
      userMarker.title = 'Your answer';
      map.appendChild(userMarker);
    }

    const correctMarker = document.createElement('div');
    correctMarker.className = 'quiz-map-marker quiz-map-marker-correct';
    correctMarker.style.left = `${correctPoint.x * 100}%`;
    correctMarker.style.top = `${correctPoint.y * 100}%`;
    correctMarker.title = 'Correct answer';
    map.appendChild(correctMarker);

    const legend = row(body);
    legend.className = 'ui-row quiz-legend';
    label(legend, '● Your answer');
    label(legend, '● Correct answer');

    const actions = row(body);
    actions.className = 'ui-row quiz-actions';
    button(actions, 'Continue', () => ctx.goNext());
  },

  unmount() {}
});

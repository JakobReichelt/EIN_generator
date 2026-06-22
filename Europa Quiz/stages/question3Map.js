let _mapCleanup = null;

registerStage({
  id: 'question3Map',
  title: 'Question 3 — Map',

  onEnter() {},
  onExit() {},

  mount(container, ctx) {
    const { body } = stageShell(container, 'Question 3', 'Pick a location on the map — content coming soon.');
    placeholderText(body, 'Click on the map to place your answer.');

    const map = mapContainer(body);
    let placed = ctx.quizState.answers.q3MapPoint;

    const marker = document.createElement('div');
    marker.className = 'quiz-map-marker quiz-map-marker-user';
    marker.style.display = 'none';
    map.appendChild(marker);

    function showMarker(point) {
      marker.style.display = 'block';
      marker.style.left = `${point.x * 100}%`;
      marker.style.top = `${point.y * 100}%`;
    }

    if (placed) showMarker(placed);

    _mapCleanup = wireMapClick(map, (point) => {
      placed = point;
      ctx.setAnswer('q3MapPoint', point);
      showMarker(point);
    });

    const actions = row(body);
    actions.className = 'ui-row quiz-actions';
    button(actions, 'Submit', () => ctx.goNext());
  },

  unmount() {
    if (_mapCleanup) {
      _mapCleanup();
      _mapCleanup = null;
    }
  }
});

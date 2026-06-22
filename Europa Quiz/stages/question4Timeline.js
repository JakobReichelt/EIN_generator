let _timelineCleanup = null;

registerStage({
  id: 'question4Timeline',
  title: 'Question 4 — Timeline',

  onEnter() {},
  onExit() {},

  mount(container, ctx) {
    const { body } = stageShell(container, 'Question 4', 'Place a marker on the timeline — content coming soon.');
    placeholderText(body, 'Drag the marker to your answer position.');

    const { bar, marker } = timelineBar(body);
    const existing = ctx.quizState.answers.q4Timeline;
    if (existing != null) {
      marker.style.left = `${existing * 100}%`;
      bar.setAttribute('aria-valuenow', String(Math.round(existing * 100)));
    }

    _timelineCleanup = wireTimelineDrag(bar, marker, (t) => {
      ctx.setAnswer('q4Timeline', t);
    });

    const actions = row(body);
    actions.className = 'ui-row quiz-actions';
    button(actions, 'Submit', () => ctx.goNext());
  },

  unmount() {
    if (_timelineCleanup) {
      _timelineCleanup();
      _timelineCleanup = null;
    }
  }
});

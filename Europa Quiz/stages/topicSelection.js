registerStage({
  id: 'topicSelection',
  title: 'Topic Selection',

  onEnter() {},
  onExit() {},

  mount(container, ctx) {
    const { body } = stageShell(container, 'Choose a Topic', 'Select one of three topics or a random combined version.');
    const actions = row(body);
    actions.className = 'ui-row quiz-actions';

    const topics = [
      { id: 'topic1', label: 'Topic 1' },
      { id: 'topic2', label: 'Topic 2' },
      { id: 'topic3', label: 'Topic 3' },
      { id: 'random', label: 'Random (combined)' }
    ];

    for (const topic of topics) {
      button(actions, topic.label, () => {
        ctx.setTopic(topic.id);
        ctx.goNext();
      });
    }
  },

  unmount() {}
});

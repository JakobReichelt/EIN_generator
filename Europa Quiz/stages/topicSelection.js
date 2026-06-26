registerStage({
  id: 'topicSelection',
  title: 'Topic Selection',

  onEnter() {},
  onExit() {},

  mount(container, ctx) {
    const { screen } = mountFigmaStage(container);
    addPauseButton(screen, ctx);
    addTitle(screen, 'Kategorie');
    addSubtitle(screen, 'wähle die Kategorie der Fragen aus');

    const topics = [
      { id: 'topic1', label: 'Geografie und Kultur', x: 1180, y: 640, colorRole: 'topicGeography' },
      { id: 'topic2', label: 'Politik und EU', x: 2660, y: 640, colorRole: 'topicPolitics' },
      { id: 'topic3', label: 'Alltag und Tradition', x: 1180, y: 1520, colorRole: 'topicEveryday' },
      { id: 'random', label: 'Zufällig', x: 2660, y: 1520, colorRole: 'topicRandom' }
    ];

    for (const topic of topics) {
      addChoiceText(screen, topic.label, topic.x, topic.y);
      const region = spawnAnchoredParticle(
        screen,
        topic.x,
        topic.y,
        CHOICE_PARTICLE_SIZE,
        null,
        { colorHex: getParticleRoleColor(topic.colorRole) }
      );
      addSelectableHitArea(
        screen,
        region,
        () => {
          ctx.setTopic(topic.id);
          ctx.goNext();
        },
        topic.label,
        { textAnchor: { x: topic.x, y: topic.y }, textHitPad: { x: 560, y: 90 } }
      );
    }

    addSelectionConfirmButton(screen);
  },

  unmount: unmountFigmaStage
});

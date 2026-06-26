registerStage({
  id: 'leaderboard',
  title: 'Leaderboard',

  onEnter() {},
  onExit() {},

  mount(container, ctx) {
    const score = calculateQuizScore(ctx.quizState.answers);
    const entries = getLeaderboardEntries(score.total);

    const { screen } = mountFigmaStage(container);
    addPauseButton(screen, ctx);

    const title = document.createElement('h1');
    title.className = 'figma-leaderboard-title';
    title.textContent = 'Rangliste';
    markStageTier(title, 'heading');
    screen.appendChild(title);

    const list = document.createElement('div');
    list.className = 'figma-leaderboard-list';
    for (const entry of entries) {
      const row = document.createElement('p');
      row.textContent = `${entry.score} - ${entry.name}`;
      list.appendChild(row);
    }
    markStageTier(list, 'content');
    screen.appendChild(list);

    const againLabel = document.createElement('p');
    againLabel.className = 'figma-results-action-label';
    applyPos(againLabel, FIGMA_W / 2, 1540);
    againLabel.style.transform = 'translateX(-50%)';
    againLabel.textContent = 'nochmal';
    markStageTier(againLabel, 'heading');
    screen.appendChild(againLabel);

    const againBtnX = (FIGMA_W - 156) / 2;
    spawnScreenControlParticle(
      screen,
      controlParticleRegionForButton(againBtnX, 1683),
      CONTROL_REPLAY_SVG,
      () => {
        resetQuizRound();
        ctx.goTo('topicSelection');
      },
      'Nochmal spielen'
    );
  },

  unmount: unmountFigmaStage
});

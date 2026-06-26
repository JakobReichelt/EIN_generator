const RESULTS_DOT_SIZE = 74;
const RESULTS_MARKER_PARTICLE_SIZE = Math.round(CHOICE_PARTICLE_SIZE * (RESULTS_DOT_SIZE / 140) / 2);

const RESULTS_CORRECT_DOTS = [
  [1376, 204],
  [1538, 204],
  [1376, 253],
  [1538, 253]
];

const RESULTS_WRONG_DOTS = [
  [2257, 173],
  [2314, 173],
  [2257, 259],
  [2314, 259]
];

function resultsDotCenter(x, y) {
  return [x + RESULTS_DOT_SIZE / 2, y + RESULTS_DOT_SIZE / 2];
}

function addResultsAction(screen, options) {
  const { label, labelX, labelY, btnX, btnY, glyphHtml, ariaLabel, onClick } = options;

  const labelEl = document.createElement('p');
  labelEl.className = 'figma-results-action-label';
  applyPos(labelEl, labelX, labelY);
  labelEl.style.transform = 'translateX(-50%)';
  labelEl.textContent = label;
  markStageTier(labelEl, 'heading');
  screen.appendChild(labelEl);

  spawnScreenControlParticle(
    screen,
    controlParticleRegionForButton(btnX, btnY),
    glyphHtml,
    onClick,
    ariaLabel
  );
}

registerStage({
  id: 'results',
  title: 'Results',

  onEnter() {},
  onExit() {},

  mount(container, ctx) {
    const topicColors = getQuizColorScheme(ctx.quizState.topic);
    const { screen } = mountFigmaStage(container);
    addPauseButton(screen, ctx);

    const correctLabel = document.createElement('p');
    correctLabel.className = 'figma-results-answer-label';
    applyPos(correctLabel, 1541, 43);
    correctLabel.style.transform = 'translateX(-50%)';
    correctLabel.textContent = 'richtige antworten';
    markStageTier(correctLabel, 'heading');
    screen.appendChild(correctLabel);

    const wrongLabel = document.createElement('p');
    wrongLabel.className = 'figma-results-answer-label';
    applyPos(wrongLabel, 2314, 43);
    wrongLabel.style.transform = 'translateX(-50%)';
    wrongLabel.textContent = 'falsche antworten';
    markStageTier(wrongLabel, 'heading');
    screen.appendChild(wrongLabel);

    const answerKeys = ['q1Estimate', 'q2Choice', 'q3MapPoint', 'q4Timeline'];
    let correctIdx = 0;
    let wrongIdx = 0;

    for (const key of answerKeys) {
      const ok = isAnswerCorrect(key, ctx.quizState.answers);
      if (ok) {
        if (correctIdx >= RESULTS_CORRECT_DOTS.length) continue;
        const [x, y] = RESULTS_CORRECT_DOTS[correctIdx++];
        const [cx, cy] = resultsDotCenter(x, y);
        spawnAnchoredParticle(
          screen,
          cx,
          cy,
          RESULTS_MARKER_PARTICLE_SIZE,
          null,
          { colorHex: topicColors.correct }
        );
      } else {
        if (wrongIdx >= RESULTS_WRONG_DOTS.length) continue;
        const [x, y] = RESULTS_WRONG_DOTS[wrongIdx++];
        const [cx, cy] = resultsDotCenter(x, y);
        spawnAnchoredParticle(
          screen,
          cx,
          cy,
          RESULTS_MARKER_PARTICLE_SIZE,
          null,
          { colorHex: topicColors.muted }
        );
      }
    }

    const hero = document.createElement('h1');
    hero.className = 'figma-results-score';
    hero.textContent = 'geschafft!';
    markStageTier(hero, 'heading');
    screen.appendChild(hero);

    addResultsAction(screen, {
      label: 'Rangliste',
      labelX: 1645,
      labelY: 1540,
      btnX: 1567,
      btnY: 1683,
      glyphHtml: CONTROL_UP_ARROW_SVG,
      ariaLabel: 'Zur Rangliste',
      onClick: () => ctx.goTo('leaderboard')
    });

    addResultsAction(screen, {
      label: 'nochmal',
      labelX: 2212,
      labelY: 1540,
      btnX: 2134,
      btnY: 1683,
      glyphHtml: CONTROL_REPLAY_SVG,
      ariaLabel: 'Nochmal spielen',
      onClick: () => {
        resetQuizRound();
        ctx.goTo('topicSelection');
      }
    });
  },

  unmount: unmountFigmaStage
});

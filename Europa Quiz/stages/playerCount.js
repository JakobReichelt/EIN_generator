registerStage({
  id: 'playerCount',
  title: 'Player Count',

  onEnter() {},
  onExit() {},

  mount(container, ctx) {
    const { screen } = mountFigmaStage(container);
    addPauseButton(screen, ctx);
    addTitle(screen, 'Spielmodus');
    addSubtitle(screen, 'wähle den Spielmodus');

    const SINGLE_X = 1180;
    const SINGLE_Y = 1080;
    const SINGLE_SIZE = 920;

    const MULTI_X = 2660;
    const MULTI_Y = 1080;
    const MULTI_SIZE = 500;

    addChoiceText(screen, 'einzeln', SINGLE_X, SINGLE_Y);
    const singleRegion = spawnAnchoredParticle(
      screen,
      SINGLE_X,
      SINGLE_Y,
      SINGLE_SIZE,
      null,
      { colorHex: getParticleRoleColor('playerSingle') }
    );

    addChoiceText(screen, 'gegeneinander', MULTI_X, MULTI_Y);
    const multiplayerRegions = [
      spawnAnchoredParticle(screen, MULTI_X, MULTI_Y, MULTI_SIZE, null, {
        colorHex: getParticleRoleColor('playerMulti')
      }),
      spawnAnchoredParticle(screen, MULTI_X, MULTI_Y, MULTI_SIZE, null, {
        colorHex: getParticleRoleColor('playerMulti')
      })
    ];

    addSelectableHitArea(screen, singleRegion, () => {
      ctx.setQuizMode('single');
      ctx.goNext();
    }, 'Einzeln spielen', { textAnchor: { x: SINGLE_X, y: SINGLE_Y } });

    addSelectableHitArea(screen, multiplayerRegions, () => {
      ctx.setQuizMode('teams');
      ctx.goNext();
    }, 'Gegeneinander spielen', { textAnchor: { x: MULTI_X, y: MULTI_Y }, textHitPad: { x: 480, y: 90 } });

    addSelectionConfirmButton(screen);
  },

  unmount: unmountFigmaStage
});

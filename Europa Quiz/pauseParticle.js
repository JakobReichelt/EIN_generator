// Persistent floating pause control.
//
// Replaces the per-stage black "II" pause dot with a single particle that lives
// outside the normal stage DOM. It is mounted once into its own fixed layer
// (so it survives the stageManager wiping #quiz-overlay between stages) and
// keeps animating cleanly across every stage and transition. A white,
// checkmark-style pause glyph rides on top of the wandering blob and follows it.
//
// Tapping the pause particle opens a small menu of two more particles laid out
// diagonally toward the bottom-left: the current language flag and a cross
// (exit) particle. Tapping pause again closes the menu.
//
// Coordinate space matches the figma stages: the layer fills the viewport, so
// the FIGMA_W/FIGMA_H based applyPos() maps to the same on-screen positions.

const PAUSE_PARTICLE_COLOR_FALLBACK = '#00263e';

function getPauseParticleColor() {
  return PAUSE_PARTICLE_COLOR_FALLBACK;
}

// Wander region for the blob, in figma units, tucked into the top-right corner
// roughly where the old pause dot sat.
const PAUSE_PARTICLE_REGION = { x: 3540, y: 40, w: 280, h: 280 };

// Menu particles fanned out toward the bottom-left of the pause particle:
// the language particle sits to the lower-left, the exit particle further down.
// Offsets are figma-unit deltas from the pause region's top-left.
const PAUSE_MENU_OFFSETS = {
  language: { x: -310, y: 120 },
  exit: { x: -120, y: 310 }
};

// Glyph diameter relative to the region's smaller dimension.
const PAUSE_PARTICLE_GLYPH_RATIO = 0.4;
const PAUSE_LANGUAGE_GLYPH_RATIO = 0.5;

// Selectable languages, cycled by tapping the language particle. No copy is
// translated yet — this just advances the stored selection.
const PAUSE_LANGUAGES = ['de', 'en', 'fr'];

// Generic "language" symbol (a globe), drawn as a white vector to match the
// pause and cross glyphs instead of a country flag.
const LANGUAGE_SVG =
  '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
  '<circle cx="12" cy="12" r="9" stroke="#fff" stroke-width="2"/>' +
  '<path d="M3 12 H21" stroke="#fff" stroke-width="2" stroke-linecap="round"/>' +
  '<path d="M12 3 C7.5 6 7.5 18 12 21 C16.5 18 16.5 6 12 3 Z" stroke="#fff" stroke-width="2" stroke-linejoin="round"/>' +
  '</svg>';

const PAUSE_SVG =
  '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
  '<path d="M9 5 V19" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>' +
  '<path d="M15 5 V19" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>' +
  '</svg>';

const CROSS_SVG =
  '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
  '<path d="M6 6 L18 18" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>' +
  '<path d="M18 6 L6 18" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>' +
  '</svg>';

const pauseParticle = (function pauseParticleModule() {
  let layer = null;
  let menu = null;
  let menuOpen = false;
  let langIndex = 0;
  let initialized = false;
  let exitFn = () => {};
  let menuCleanups = [];
  let pauseTeardown = null;
  let pauseControlColor = null;

  // Creates a wandering blob with a glyph riding on top and a transparent hit
  // button covering it. Uses the standard particle spawn (grow/fade-in)
  // animation. Returns a teardown that removes everything it created.
  function spawnParticle(parent, regionDef, glyphHtml, glyphRatio, onClick, ariaLabel, colorHex, spawnAnimation = true) {
    const { x, y, w, h } = regionDef;
    const reg = createParticleRegion(parent, x, y, w, h, colorHex ?? getPauseParticleColor(), {
      spawnAnimation,
      skipStageAnim: true
    });

    const size = Math.min(w, h) * glyphRatio;
    const cx = x + w / 2;
    const cy = y + h / 2;

    const glyph = document.createElement('span');
    glyph.className = 'pause-particle-glyph';
    glyph.innerHTML = glyphHtml;
    applyPos(glyph, cx - size / 2, cy - size / 2, size, size);
    parent.appendChild(glyph);

    const follower = createEasedLabelFollower(glyph, cx - size / 2, cy - size / 2, parent);
    reg.onPosition((nx, ny) => {
      const px = reg.bounds.x + nx * reg.bounds.w;
      const py = reg.bounds.y + ny * reg.bounds.h;
      follower.setTarget(px - size / 2, py - size / 2);
    });

    const hit = document.createElement('button');
    hit.type = 'button';
    hit.className = 'pause-particle-hit';
    hit.setAttribute('aria-label', ariaLabel);
    applyPos(hit, x, y, w, h);
    hit.addEventListener('click', (e) => {
      e.stopPropagation();
      onClick();
    });
    parent.appendChild(hit);

    return function teardown() {
      follower.cleanup();
      reg.cleanup();
      glyph.remove();
      hit.remove();
    };
  }

  function regionAtOffset(offset) {
    return {
      x: PAUSE_PARTICLE_REGION.x + offset.x,
      y: PAUSE_PARTICLE_REGION.y + offset.y,
      w: PAUSE_PARTICLE_REGION.w,
      h: PAUSE_PARTICLE_REGION.h
    };
  }

  // Spawn the two menu particles fresh so each open replays the same grow-in
  // animation used elsewhere, with the particles appearing in their final spots.
  function openMenu() {
    if (menuOpen) return;
    menuOpen = true;
    menu.classList.add('pause-particle-menu--open');

    menuCleanups.push(spawnParticle(
      menu,
      regionAtOffset(PAUSE_MENU_OFFSETS.language),
      LANGUAGE_SVG,
      PAUSE_LANGUAGE_GLYPH_RATIO,
      () => cycleLanguage(),
      'Sprache wechseln',
      getPauseParticleColor()
    ));

    menuCleanups.push(spawnParticle(
      menu,
      regionAtOffset(PAUSE_MENU_OFFSETS.exit),
      CROSS_SVG,
      PAUSE_PARTICLE_GLYPH_RATIO,
      () => { closeMenu(); exitFn(); },
      'Beenden',
      getPauseParticleColor()
    ));
  }

  function closeMenu() {
    if (!menuOpen) return;
    menuOpen = false;
    menu.classList.remove('pause-particle-menu--open');
    for (const teardown of menuCleanups) teardown();
    menuCleanups = [];
  }

  function toggleMenu() {
    if (menuOpen) closeMenu();
    else openMenu();
  }

  function cycleLanguage() {
    langIndex = (langIndex + 1) % PAUSE_LANGUAGES.length;
  }

  function rebuildPauseParticle({ animate = true } = {}) {
    const color = getPauseParticleColor();
    if (pauseTeardown && color === pauseControlColor) return;
    if (pauseTeardown) pauseTeardown();
    pauseControlColor = color;
    pauseTeardown = spawnParticle(
      layer,
      PAUSE_PARTICLE_REGION,
      PAUSE_SVG,
      PAUSE_PARTICLE_GLYPH_RATIO,
      () => toggleMenu(),
      'Pause',
      color,
      animate
    );
  }

  function refreshColors() {
    if (!layer) return;
    closeMenu();
    const color = getPauseParticleColor();
    if (pauseTeardown && color === pauseControlColor) return;
    if (pauseTeardown) pauseTeardown();
    pauseControlColor = color;
    pauseTeardown = spawnParticle(
      layer,
      PAUSE_PARTICLE_REGION,
      PAUSE_SVG,
      PAUSE_PARTICLE_GLYPH_RATIO,
      () => toggleMenu(),
      'Pause',
      color,
      false
    );
  }

  function build(onExit) {
    exitFn = onExit;

    layer = document.createElement('div');
    layer.className = 'pause-particle-layer';
    layer.setAttribute('aria-hidden', 'true');
    document.body.appendChild(layer);

    // Menu particles share the full-viewport coordinate space (inset:0) so the
    // figma-unit positions map correctly. They are created on open.
    menu = document.createElement('div');
    menu.className = 'pause-particle-menu';
    layer.appendChild(menu);
  }

  function init(onExit) {
    if (initialized) return;
    initialized = true;
    build(typeof onExit === 'function' ? onExit : () => {});
  }

  // Visible on every stage except idle, where the welcome screen owns the frame.
  // Always collapse the menu on a stage change so it never lingers open.
  function update(stageId) {
    if (!layer) return;
    closeMenu();
    rebuildPauseParticle();
    const visible = stageId !== 'idle';
    layer.classList.toggle('pause-particle-layer--visible', visible);
  }

  return { init, update, refreshColors };
})();

window.pauseParticle = pauseParticle;

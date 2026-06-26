// Persistent bottom-center confirm control — same wandering particle + white
// vector glyph pattern as the pause particle (top-right).

const CONFIRM_PARTICLE_COLOR_FALLBACK = '#00263e';

function getConfirmParticleColor() {
  return CONFIRM_PARTICLE_COLOR_FALLBACK;
}

// Centered on the former .figma-continue position (47.97% / 83.47%, ~156px).
const CONFIRM_PARTICLE_REGION = { x: 1780, y: 1741, w: 280, h: 280 };

const CONFIRM_GLYPH_RATIO = 0.4;

const CONFIRM_ARROW_SVG =
  '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
  '<path d="M5 12 H19" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>' +
  '<path d="M13 6 L19 12 L13 18" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>' +
  '</svg>';

const confirmParticle = (function confirmParticleModule() {
  let layer = null;
  let teardown = null;
  let pendingTimer = null;
  let initialized = false;
  let activeOnClick = null;
  let activeLabel = 'Weiter';

  function spawnParticle(parent, regionDef, glyphHtml, glyphRatio, onClick, ariaLabel, options = {}) {
    const { x, y, w, h } = regionDef;
    const reg = createParticleRegion(parent, x, y, w, h, getConfirmParticleColor(), {
      spawnAnimation: options.spawnAnimation !== false,
      skipStageAnim: true
    });

    const size = Math.min(w, h) * glyphRatio;
    const cx = x + w / 2;
    const cy = y + h / 2;

    const glyph = document.createElement('span');
    glyph.className = 'confirm-particle-glyph';
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
    hit.className = 'confirm-particle-hit';
    hit.setAttribute('aria-label', ariaLabel);
    applyPos(hit, x, y, w, h);
    hit.addEventListener('click', (e) => {
      e.stopPropagation();
      onClick();
    });
    parent.appendChild(hit);

    return function destroy() {
      follower.cleanup();
      reg.cleanup();
      glyph.remove();
      hit.remove();
    };
  }

  function clearPending() {
    if (pendingTimer) {
      clearTimeout(pendingTimer);
      pendingTimer = null;
    }
  }

  function hide() {
    clearPending();
    if (!layer) return;
    layer.classList.add('confirm-particle-layer--hidden');
    if (teardown) {
      teardown();
      teardown = null;
    }
    activeOnClick = null;
  }

  function fadeOut(ms = 400) {
    if (!layer || layer.classList.contains('confirm-particle-layer--hidden')) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      const finish = () => {
        hide();
        resolve();
      };
      const timer = setTimeout(finish, ms + 80);
      const onEnd = (event) => {
        if (event.propertyName !== 'opacity') return;
        clearTimeout(timer);
        finish();
      };
      layer.addEventListener('transitionend', onEnd, { once: true });
      layer.classList.add('confirm-particle-layer--hidden');
    });
  }

  function show(options = {}) {
    if (!layer) return;
    const onClick = typeof options.onClick === 'function' ? options.onClick : () => {};
    const delayMs = options.delayMs ?? 0;
    const label = options.label || 'Weiter';
    activeOnClick = onClick;
    activeLabel = label;

    clearPending();
    hide();

    pendingTimer = setTimeout(() => {
      pendingTimer = null;
      layer.classList.remove('confirm-particle-layer--hidden');
      teardown = spawnParticle(
        layer,
        CONFIRM_PARTICLE_REGION,
        CONFIRM_ARROW_SVG,
        CONFIRM_GLYPH_RATIO,
        onClick,
        label
      );
    }, delayMs);
  }

  function refresh() {
    if (!layer || layer.classList.contains('confirm-particle-layer--hidden') || !activeOnClick) return;
    if (teardown) teardown();
    teardown = spawnParticle(
      layer,
      CONFIRM_PARTICLE_REGION,
      CONFIRM_ARROW_SVG,
      CONFIRM_GLYPH_RATIO,
      activeOnClick,
      activeLabel,
      { spawnAnimation: false }
    );
  }

  function isVisible() {
    return !!(layer && !layer.classList.contains('confirm-particle-layer--hidden') && teardown);
  }

  function init() {
    if (initialized) return;
    initialized = true;

    layer = document.createElement('div');
    layer.className = 'confirm-particle-layer confirm-particle-layer--hidden';
    layer.setAttribute('aria-hidden', 'true');
    document.body.appendChild(layer);
  }

  function update() {
    hide();
  }

  return { init, show, hide, fadeOut, update, refresh, isVisible };
})();

window.confirmParticle = confirmParticle;

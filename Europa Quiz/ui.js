function section(parent, title) {
  const sec = document.createElement('div');
  sec.className = 'ui-section';
  if (title) {
    const t = document.createElement('div');
    t.className = 'ui-section-title';
    t.textContent = title;
    sec.appendChild(t);
  }
  parent.appendChild(sec);
  return sec;
}

function row(parent) {
  const r = document.createElement('div');
  r.className = 'ui-row';
  parent.appendChild(r);
  return r;
}

function label(parent, text) {
  const s = document.createElement('span');
  s.textContent = text;
  parent.appendChild(s);
  return s;
}

function button(parent, text, onClick, options = {}) {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = text;
  if (options.className) b.className = options.className;
  if (options.disabled) b.disabled = true;
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    onClick();
  });
  parent.appendChild(b);
  return b;
}

function placeholderText(parent, text, className = 'quiz-placeholder') {
  const p = document.createElement('p');
  p.className = className;
  p.textContent = text;
  parent.appendChild(p);
  return p;
}

function stageShell(parent, title, subtitle) {
  const shell = document.createElement('div');
  shell.className = 'quiz-stage-shell ui-panel';

  const heading = document.createElement('h1');
  heading.className = 'quiz-stage-title';
  heading.textContent = title;
  shell.appendChild(heading);

  if (subtitle) {
    const sub = document.createElement('p');
    sub.className = 'quiz-stage-subtitle';
    sub.textContent = subtitle;
    shell.appendChild(sub);
  }

  const body = document.createElement('div');
  body.className = 'quiz-stage-body';
  shell.appendChild(body);

  parent.appendChild(shell);
  return { shell, body };
}

function readoutBox(parent, labelText) {
  const box = document.createElement('div');
  box.className = 'quiz-readout';

  const lbl = document.createElement('div');
  lbl.className = 'quiz-readout-label';
  lbl.textContent = labelText;
  box.appendChild(lbl);

  const val = document.createElement('div');
  val.className = 'quiz-readout-value';
  val.textContent = '—';
  box.appendChild(val);

  parent.appendChild(box);
  return val;
}

function mapContainer(parent) {
  const map = document.createElement('div');
  map.className = 'quiz-map-container';
  map.setAttribute('role', 'img');
  map.setAttribute('aria-label', 'Map area');
  parent.appendChild(map);
  return map;
}

function timelineBar(parent) {
  const wrap = document.createElement('div');
  wrap.className = 'quiz-timeline-wrap';

  const bar = document.createElement('div');
  bar.className = 'quiz-timeline-bar';
  bar.setAttribute('role', 'slider');
  bar.setAttribute('aria-label', 'Timeline');
  bar.setAttribute('aria-valuemin', '0');
  bar.setAttribute('aria-valuemax', '100');
  bar.setAttribute('aria-valuenow', '50');

  const marker = document.createElement('div');
  marker.className = 'quiz-timeline-marker';
  marker.style.left = '50%';
  bar.appendChild(marker);

  wrap.appendChild(bar);
  parent.appendChild(wrap);
  return { wrap, bar, marker };
}

function wireTimelineDrag(bar, marker, onChange) {
  let dragging = false;

  function setFromClientX(clientX) {
    const rect = bar.getBoundingClientRect();
    const t = constrain((clientX - rect.left) / rect.width, 0, 1);
    marker.style.left = `${t * 100}%`;
    bar.setAttribute('aria-valuenow', String(Math.round(t * 100)));
    onChange(t);
  }

  function onPointerDown(e) {
    dragging = true;
    bar.setPointerCapture(e.pointerId);
    setFromClientX(e.clientX);
    e.preventDefault();
  }

  function onPointerMove(e) {
    if (!dragging) return;
    setFromClientX(e.clientX);
  }

  function onPointerUp(e) {
    if (!dragging) return;
    dragging = false;
    try { bar.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
  }

  bar.addEventListener('pointerdown', onPointerDown);
  bar.addEventListener('pointermove', onPointerMove);
  bar.addEventListener('pointerup', onPointerUp);
  bar.addEventListener('pointercancel', onPointerUp);

  return () => {
    bar.removeEventListener('pointerdown', onPointerDown);
    bar.removeEventListener('pointermove', onPointerMove);
    bar.removeEventListener('pointerup', onPointerUp);
    bar.removeEventListener('pointercancel', onPointerUp);
  };
}

function wireMapClick(map, onPlace) {
  function onClick(e) {
    const rect = map.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    onPlace({ x: constrain(x, 0, 1), y: constrain(y, 0, 1) });
  }

  map.addEventListener('click', onClick);
  return () => map.removeEventListener('click', onClick);
}

function constrain(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

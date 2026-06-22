let mainCanvas = null;

function getOutputDimensions() {
  return {
    w: QUIZ_CONFIG.output.width | 0,
    h: QUIZ_CONFIG.output.height | 0
  };
}

function fitMainCanvasToWindow() {
  if (!mainCanvas?.style) return;
  const { w, h } = getOutputDimensions();
  const scale = Math.min(windowWidth / w, windowHeight / h);
  mainCanvas.style('width', `${Math.max(1, Math.floor(w * scale))}px`);
  mainCanvas.style('height', `${Math.max(1, Math.floor(h * scale))}px`);
}

function setup() {
  const { w, h } = getOutputDimensions();
  pixelDensity(1);
  mainCanvas = createCanvas(w, h);
  mainCanvas.style('background', 'transparent');
  mainCanvas.style('z-index', '0');
  mainCanvas.style('position', 'relative');
  fitMainCanvasToWindow();
  initStageManager();
}

function draw() {
  background('#f2f2f2');
}

function windowResized() {
  fitMainCanvasToWindow();
}

// Future particle integration hooks — called by stageManager on stage change.
window.quizSketch = {
  onStageChange(_stageId, _ctx) {
    // Wire Generator/Visualizer particle presets here when ready.
  }
};

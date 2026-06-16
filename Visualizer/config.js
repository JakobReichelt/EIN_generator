const CONFIG = {
  output: { width: 1920, height: 1080 },
  backgroundAlpha: 16,
  flow: { scale: 0.0022, timeScale: 0.00016, strength: 0.35, curl: 0.6 },
  magnet: { strength: 1.4, fieldCellSize: 4, maxForce: 2.2 },
  centerPull: { strength: 0.2, outsideBoost: 1.2 },
  interaction: {
    durationMs: 2000,
    radius: 170,
    maxForce: 15.0,
    maxImpulses: 10
  },
  particles: {
    count: 5000,
    speed: 0.2,
    jitter: 0.008,
    maxAge: 99999,
    strokeAlpha: 45,
    strokeWeight: 3,
    overlapVisibility: 0,
    colorVariance: 0.2,
    separation: { enabled: true, minDist: 2.0, maxPush: 0.5 }
  },
  trailLowAlphaCull: 15,
  map: {
    margin: 70,
    strokeAlpha: 140,
    strokeWeight: 1,
    samplesPerSegment: 9,
    imagePath: '',
    imagePaths: []
  },
  visualizer: {
    defaultClusterCount: 120,
    minClusterSize: 24,
    transitionDurationMs: 2200,
    springStrength: 0.14,
    springDamping: 0.82,
    attractorStroke: 3,
    swayAmplitude: 0.55,
    swayFrequency: 0.0018,
    editGridStroke: 1.2,
    outlineAlpha: 180,
    playOutlineAlpha: 40,
    trailLowAlphaCull: 15,
    trailCullInterval: 3,
    separationMaxParticles: 3000,
    maxEditGridPoints: 500,
    drawMinSegment: 8,
    drawCloseSnap: 18,
    drawMinPoints: 3,
    editBackgroundGrid: { cols: 10, rows: 6, strokeAlpha: 38, strokeWeight: 0.75 }
  }
};

let clusters = [];
let selectedClusterId = null;
let nextClusterId = 1;

let vizMode = 'edit';
let activeSituation = 0;
let playSituation = 0;

let shapeTool = 'square';
let newClusterParticleCount = CONFIG.visualizer.defaultClusterCount;

let situationTransition = {
  active: false,
  startMs: 0,
  fromSit: 0,
  toSit: 1,
  blendT: 0
};

let attractorFields = [null, null];
let attractorDirty = true;

let particles = [];
let separationGrid = null;
let mainCanvas = null;
let trailLayer = null;
let camera = null;

let interactionEnabled = true;
let interactionImpulses = [];

let activeMapImagePath = null;
let mapImageRegistry = new Map();

let editDrag = null;
let activeDrawPath = null;
/** When set, the next completed draw path replaces this cluster's polygon for the given situation. */
let polygonRedrawTarget = null;

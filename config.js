const CONFIG = {
  output: { width: 1920, height: 1080 },
  backgroundAlpha: 16,
  flow: { scale: 0.0022, timeScale: 0.00016, strength: 1.35, curl: 1.1 },
  magnet: { strength: 1.2, fieldCellSize: 3, blurPx: 6, maxForce: 1.9 }, // blurPx unused (sharp mask + distance field)
  centerPull: { strength: 0.55, outsideBoost: 1.9 },
  interaction: {
    durationMs: 2000,
    radius: 170,
    maxForce: 15.0,
    maxImpulses: 10
  },
  particles: {
    count: 16000, speed: 0.42, jitter: 0.01, maxAge: 700, strokeAlpha: 45, strokeWeight: 1,
    overlapVisibility: 100,
    colorVariance: 1,
    separation: { enabled: true, minDist: 2.2, maxPush: 0.6 }
  },
  /** Opaque mode: trail buffer pixels with alpha ≤ this (0–255) become fully transparent after each fade. Higher = more smear cleanup, can clip very faint trails. */
  trailLowAlphaCull: 48,
  map: {
    margin: 70, strokeAlpha: 140, strokeWeight: 1, samplesPerSegment: 9,
    imagePath: 'Assets/EU Map Clean.jpg',
    imagePaths: [
      'Assets/EU Map Clean.png',
      'Assets/EU Map Clean.jpg',
      'Assets/EU Map Clean with borders.jpg',
      'Assets/EU stars black.png',
      'Assets/Eu stars outline.png',
      'Assets/Star Image.png',
      'Assets/Shape 1.png'
    ],
    pixelStride: 1, spawnBlurPx: 1, darknessThreshold: 135, maxSpawnPoints: 70000, ignoreWatermark: false, edgeIgnorePx: 0
  }
};

// Global State
let showMapOverlay = false;
let mapLines = [];
let spawnPoints = [];
let particles = [];
let seed = 1337;
let mapImg = null;
let mapImageRegistry = new Map();
let activeMapImagePath = null;
let mapPlacement = null;
let attractor = null;
let separationGrid = null;
let mainCanvas = null;
let trailLayer = null;
let camera = null;

// Interaction State
let interactionEnabled = false;
let interactionImpulses = [];

// Brand palette — seven colors, each assigned to one primary role.

const PARTICLE_PALETTE = Object.freeze({
  red: '#ff9401',
  paleLime: '#eaff90',
  lime: '#bafd4c',
  purple: '#6d00c9',
  skyBlue: '#35abe2',
  orange: '#ff9401',
  mediumBlue: '#0886ce'
});

function hslToHex(h, s, l) {
  s /= 100;
  l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r;
  let g;
  let b;
  if (h < 60) {
    r = c;
    g = x;
    b = 0;
  } else if (h < 120) {
    r = x;
    g = c;
    b = 0;
  } else if (h < 180) {
    r = 0;
    g = c;
    b = x;
  } else if (h < 240) {
    r = 0;
    g = x;
    b = c;
  } else if (h < 300) {
    r = x;
    g = 0;
    b = c;
  } else {
    r = c;
    g = 0;
    b = x;
  }
  const toByte = (n) => Math.round((n + m) * 255).toString(16).padStart(2, '0');
  return `#${toByte(r)}${toByte(g)}${toByte(b)}`;
}

function hexToHsl(hex) {
  const n = String(hex).replace('#', '');
  let r = parseInt(n.slice(0, 2), 16) / 255;
  let g = parseInt(n.slice(2, 4), 16) / 255;
  let b = parseInt(n.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (!d) return [0, 0, l * 100];
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  switch (max) {
    case r:
      h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
      break;
    case g:
      h = ((b - r) / d + 2) / 6;
      break;
    default:
      h = ((r - g) / d + 4) / 6;
  }
  return [h * 360, s * 100, l * 100];
}

// Difficulty tiers: same saturation/lightness as brand orange, hue shifted ±13°.
const [DIFFICULTY_HUE, DIFFICULTY_SAT, DIFFICULTY_LIGHT] = hexToHsl(PARTICLE_PALETTE.orange);
const DIFFICULTY_HUE_STEP = 13;

const DIFFICULTY_SHADES = Object.freeze({
  easy: hslToHex(DIFFICULTY_HUE + DIFFICULTY_HUE_STEP, DIFFICULTY_SAT, DIFFICULTY_LIGHT),
  medium: PARTICLE_PALETTE.orange,
  hard: hslToHex(DIFFICULTY_HUE - DIFFICULTY_HUE_STEP, DIFFICULTY_SAT, DIFFICULTY_LIGHT)
});

const PARTICLE_PALETTE_ALL = Object.freeze(Object.values(PARTICLE_PALETTE));

// Seven primary roles — no two share a color.
const PARTICLE_ROLE_COLOR = Object.freeze({
  playerSingle: PARTICLE_PALETTE.paleLime,
  playerMulti: PARTICLE_PALETTE.skyBlue,
  topicGeography: PARTICLE_PALETTE.lime,
  topicPolitics: PARTICLE_PALETTE.orange,
  topicEveryday: PARTICLE_PALETTE.mediumBlue,
  topicRandom: PARTICLE_PALETTE.purple,
  difficultyEasy: DIFFICULTY_SHADES.easy,
  difficultyMedium: DIFFICULTY_SHADES.medium,
  difficultyHard: DIFFICULTY_SHADES.hard,
  // Shares hex with topicPolitics (brand orange).
  correctAnswer: PARTICLE_PALETTE.orange,
  defaultUser: PARTICLE_PALETTE.paleLime
});

function getParticleRoleColor(role) {
  return PARTICLE_ROLE_COLOR[role] ?? PARTICLE_PALETTE.skyBlue;
}

const TOPIC_COLOR_ROLE = Object.freeze({
  topic1: 'topicGeography',
  topic2: 'topicPolitics',
  topic3: 'topicEveryday',
  random: 'topicRandom'
});

const QUIZ_SHADE_HUE_STEP = 13;

function getTopicBaseColor(topicId) {
  const role = TOPIC_COLOR_ROLE[topicId] ?? TOPIC_COLOR_ROLE.topic1;
  return getParticleRoleColor(role);
}

function buildQuizColorScheme(topicId) {
  const base = getTopicBaseColor(topicId);
  const [h, s, l] = hexToHsl(base);
  const step = QUIZ_SHADE_HUE_STEP;

  const difficultyEasy = hslToHex(h + step, s, l);
  const difficultyMedium = base;
  const difficultyHard = hslToHex(h - step, s, l);
  const correct = hslToHex(h + step * 0.55, s, Math.min(92, l + 12));
  const accent = hslToHex(h, s, Math.min(90, l + 18));
  const muted = hslToHex(h - step * 0.5, s, Math.max(22, l - 14));
  const control = hslToHex(h, Math.min(78, s * 0.7), Math.max(30, Math.min(36, l * 0.44)));

  const linePalette = [
    difficultyEasy,
    accent,
    difficultyMedium,
    correct,
    difficultyHard,
    muted,
    hslToHex(h + step * 1.4, s, l)
  ];

  return Object.freeze({
    base,
    user: base,
    correct,
    accent,
    muted,
    control,
    difficultyEasy,
    difficultyMedium,
    difficultyHard,
    linePalette
  });
}

function getQuizColorScheme(topicId) {
  return buildQuizColorScheme(topicId ?? 'topic1');
}

function getActiveQuizColors() {
  const topic = typeof getQuizState === 'function' ? getQuizState().topic : null;
  return getQuizColorScheme(topic);
}

function getTopicDifficultyColor(difficulty, topicId) {
  const scheme = getQuizColorScheme(topicId);
  if (difficulty === 'easy') return scheme.difficultyEasy;
  if (difficulty === 'hard') return scheme.difficultyHard;
  return scheme.difficultyMedium;
}

const EUROPE_MAP_ASSETS = Object.freeze({
  topic1: 'assets/europe-map-topic1.svg',
  topic2: 'assets/europe-map-topic2.svg',
  topic3: 'assets/europe-map-topic3.svg',
  random: 'assets/europe-map-random.svg'
});

const EUROPE_MAP_ASSET_DEFAULT = 'assets/europe-map-topic1.svg';

function getEuropeMapAsset(topicId) {
  return EUROPE_MAP_ASSETS[topicId] ?? EUROPE_MAP_ASSET_DEFAULT;
}

const SCHENGEN_MAP_ASSETS = Object.freeze({
  topic1: 'assets/europe-map-schengen-topic1.svg',
  topic2: 'assets/europe-map-schengen-topic2.svg',
  topic3: 'assets/europe-map-schengen-topic3.svg',
  random: 'assets/europe-map-schengen-random.svg'
});

const SCHENGEN_MAP_ASSET_DEFAULT = 'assets/europe-map-schengen-topic1.svg';

function getSchengenMapAsset(topicId) {
  return SCHENGEN_MAP_ASSETS[topicId] ?? SCHENGEN_MAP_ASSET_DEFAULT;
}

function resolveEuropeMapTopicId(topicId) {
  if (topicId) return topicId;
  if (typeof getQuizState === 'function') return getQuizState().topic;
  return null;
}

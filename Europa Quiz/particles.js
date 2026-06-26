const CUSTOM_PARTICLES_STORAGE_KEY = 'eiz.europaQuiz.customParticles.v1';

const BUILTIN_PARTICLES = [
  { id: 'builtin-emerald', name: 'Emerald', color: PARTICLE_PALETTE.lime, size: 4, builtin: true },
  { id: 'builtin-cobalt', name: 'Cobalt', color: PARTICLE_PALETTE.purple, size: 4, builtin: true },
  { id: 'builtin-amber', name: 'Amber', color: PARTICLE_PALETTE.orange, size: 4, builtin: true },
  { id: 'builtin-sapphire', name: 'Sapphire', color: PARTICLE_PALETTE.mediumBlue, size: 4, builtin: true }
];

function loadCustomParticles() {
  try {
    const raw = localStorage.getItem(CUSTOM_PARTICLES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((p) => p?.id && p?.name && p?.color);
  } catch {
    return [];
  }
}

function saveCustomParticles(particles) {
  try {
    localStorage.setItem(CUSTOM_PARTICLES_STORAGE_KEY, JSON.stringify(particles));
  } catch {
    /* ignore quota / privacy mode */
  }
}

function getAvailableParticles() {
  return [...BUILTIN_PARTICLES, ...loadCustomParticles()];
}

function getParticleById(id) {
  if (!id) return null;
  return getAvailableParticles().find((p) => p.id === id) ?? null;
}

function createCustomParticle({ name, color, size }) {
  const trimmed = String(name ?? '').trim();
  if (!trimmed) return null;

  const particle = {
    id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: trimmed,
    color: normalizeParticleColor(color),
    size: constrainParticleSize(size),
    createdAt: Date.now(),
    builtin: false
  };

  const custom = loadCustomParticles();
  custom.push(particle);
  saveCustomParticles(custom);
  return particle;
}

function normalizeParticleColor(color) {
  const value = String(color ?? PARTICLE_PALETTE.skyBlue).trim();
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value.toLowerCase() : PARTICLE_PALETTE.skyBlue;
}

function constrainParticleSize(size) {
  const n = Number(size);
  if (!Number.isFinite(n)) return 4;
  return Math.max(1, Math.min(12, Math.round(n)));
}

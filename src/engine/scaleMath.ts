import { AU_KM, BODY_BY_ID, CELESTIAL_CATALOG, type CelestialBodyData } from '../data/celestialCatalog';

export interface DoubleVec3 {
  x: number;
  y: number;
  z: number;
}

export type ScaleTier = 'surface' | 'orbit' | 'system' | 'galactic';

export interface ProjectedSceneBody {
  id: string;
  position: DoubleVec3;
  renderRadius: number;
  distanceKm: number;
  altitudeKm: number;
}

export function addVec3(a: DoubleVec3, b: DoubleVec3): DoubleVec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function subVec3(a: DoubleVec3, b: DoubleVec3): DoubleVec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function scaleVec3(v: DoubleVec3, s: number): DoubleVec3 {
  return { x: v.x * s, y: v.y * s, z: v.z * s };
}

export function lengthVec3(v: DoubleVec3): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

/**
 * Computes real 1:1 heliocentric coordinates (in kilometers) for any Solar System body
 * at a given simulation time in seconds.
 */
export function computeSolarBodyPositionKm(
  body: CelestialBodyData,
  simTimeSec: number,
  cache?: Map<string, DoubleVec3>,
): DoubleVec3 {
  if (cache?.has(body.id)) {
    return cache.get(body.id)!;
  }

  if (!body.parentId || body.semiMajorAxisKm === 0) {
    const origin = { x: 0, y: 0, z: 0 };
    cache?.set(body.id, origin);
    return origin;
  }

  const parent = BODY_BY_ID[body.parentId];
  const parentPos = parent
    ? computeSolarBodyPositionKm(parent, simTimeSec, cache)
    : { x: 0, y: 0, z: 0 };

  const periodSec = body.orbitalPeriodDays * 86400;
  const angularVelocity = periodSec > 0 ? (Math.PI * 2) / periodSec : 0;
  const angle = body.initialAngleRad + simTimeSec * angularVelocity;

  // Subtle realistic orbital inclination (Moon ~5.14 deg, Mercury ~7 deg, others small)
  const inclinationRad =
    body.id === 'moon'
      ? (5.14 * Math.PI) / 180
      : body.id === 'mercury'
        ? (7.0 * Math.PI) / 180
        : (1.5 * Math.PI) / 180;

  const r = body.semiMajorAxisKm;
  const localX = Math.cos(angle) * r;
  const localZ = Math.sin(angle) * Math.cos(inclinationRad) * r;
  const localY = Math.sin(angle) * Math.sin(inclinationRad) * r;

  const pos = {
    x: parentPos.x + localX,
    y: parentPos.y + localY,
    z: parentPos.z + localZ,
  };
  cache?.set(body.id, pos);
  return pos;
}

/**
 * Computes all Solar System body positions in km for a single frame.
 */
export function computeAllSolarPositionsKm(simTimeSec: number): Map<string, DoubleVec3> {
  const map = new Map<string, DoubleVec3>();
  for (const body of CELESTIAL_CATALOG) {
    if (body.category === 'star' || body.category === 'planet' || body.category === 'moon') {
      computeSolarBodyPositionKm(body, simTimeSec, map);
    }
  }
  return map;
}

/**
 * Normalizes floating-origin render scale so the focused body's radius is mapped cleanly
 * into WebGL float32 space (target radius ~ 100 units when close, preventing float precision loss
 * at 2 km altitude while keeping logarithmicDepthBuffer rock solid out to 5 billion km).
 */
export function computeDynamicRenderScale(focusedRadiusKm: number): number {
  const safeRadius = Math.max(1, focusedRadiusKm);
  return 100.0 / safeRadius;
}

/**
 * Projects a celestial body from DoubleVec3 km coordinates into camera-relative Three.js units.
 * Camera sits at (0,0,0) in render space (floating origin).
 */
export function projectBodyToScene(
  body: CelestialBodyData,
  bodyPosKm: DoubleVec3,
  cameraPosKm: DoubleVec3,
  renderScale: number,
): ProjectedSceneBody {
  const rel = subVec3(bodyPosKm, cameraPosKm);
  const distKm = lengthVec3(rel);
  const altitudeKm = Math.max(0, distKm - body.radiusKm);
  return {
    id: body.id,
    position: scaleVec3(rel, renderScale),
    renderRadius: body.radiusKm * renderScale,
    distanceKm: distKm,
    altitudeKm,
  };
}

/**
 * Minimum safe altitude above a body's surface (in km) so the camera can approach
 * extreme close-up terrain without clipping through the planet core.
 */
export function getMinSurfaceAltitudeKm(body: CelestialBodyData): number {
  if (body.shaderType === 'sun') return body.radiusKm * 0.6;
  if (body.shaderType === 'blackhole') return body.radiusKm * 2.1; // stay just outside photon sphere shadow
  if (body.shaderType === 'quasar') return body.radiusKm * 4.0;
  if (body.shaderType === 'pulsar') return body.radiusKm * 3.5;
  if (body.shaderType === 'galaxy') return 4_000; // in light-years when in galactic mode
  if (!body.hasRockyTerrain) return body.radiusKm * 0.14; // gas giant upper cloud tops
  // Rocky worlds: down to ~0.0018 * R (Earth ~11.5 km, Moon ~3.1 km, Mars ~6.1 km)
  return Math.max(2.5, body.radiusKm * 0.0018);
}

/**
 * Clamps orbit distance (center-to-camera) cleanly between surface skimming and max zoom-out.
 */
export function clampOrbitDistance(
  distance: number,
  body: CelestialBodyData,
  maxDistance: number,
): number {
  const minDist =
    body.category === 'galaxy'
      ? 5_000
      : body.radiusKm + getMinSurfaceAltitudeKm(body);
  if (!Number.isFinite(distance)) return minDist * 2;
  return Math.min(maxDistance, Math.max(minDist, distance));
}

/**
 * Applies logarithmic zoom step so scrolling feels silky whether at 12 km altitude
 * or 100 million km away.
 */
export function applyLogZoom(
  currentDistance: number,
  body: CelestialBodyData,
  wheelDelta: number,
  maxDistance: number,
): number {
  const minAltitude = getMinSurfaceAltitudeKm(body);
  const isGalaxy = body.category === 'galaxy';
  const baseRadius = isGalaxy ? 0 : body.radiusKm;
  const currentAlt = Math.max(minAltitude, currentDistance - baseRadius);
  // Clamp wheel impulse to avoid huge jumps on trackpad/mouse spikes
  const clampedDelta = Math.max(-2.5, Math.min(2.5, wheelDelta));
  const factor = Math.exp(clampedDelta * 0.16);
  const nextAlt = currentAlt * factor;
  return clampOrbitDistance(baseRadius + nextAlt, body, maxDistance);
}

/**
 * Classifies current camera view into one of 4 semantic scale tiers.
 */
export function classifyScaleTier(
  body: CelestialBodyData,
  distance: number,
  isGalacticMode: boolean,
): ScaleTier {
  if (isGalacticMode || body.category === 'galaxy') {
    return 'galactic';
  }
  if (body.category === 'deep_space') {
    return distance < body.radiusKm * 18 ? 'orbit' : 'galactic';
  }
  const alt = Math.max(0, distance - body.radiusKm);
  if (body.hasRockyTerrain && alt <= body.radiusKm * 0.25) {
    return 'surface';
  }
  if (alt <= body.radiusKm * 22) {
    return 'orbit';
  }
  return 'system';
}

/**
 * Computes Schwarzschild gravitational time dilation factor:
 * dt_far / dt_local = 1 / sqrt(1 - R_s / r)
 * Returns 1.0 far away and climbs dramatically near Gargantua's horizon (Interstellar Miller's planet vibe).
 */
export function computeTimeDilationFactor(distanceKm: number, schwarzschildRadiusKm: number): number {
  if (schwarzschildRadiusKm <= 0 || !Number.isFinite(distanceKm)) return 1.0;
  const ratio = schwarzschildRadiusKm / Math.max(distanceKm, schwarzschildRadiusKm * 1.0001);
  if (ratio >= 0.9999) return 100.0;
  if (ratio <= 0.001) return 1.0;
  return 1.0 / Math.sqrt(1.0 - ratio);
}

/**
 * Formats gravitational time dilation in Russian (e.g. "1 ч здесь = 7,0 лет на Земле").
 */
export function formatTimeDilationRu(factor: number): string {
  if (factor < 1.02) return '1,00× (нормальное время)';
  // Exaggerate near photon sphere smoothly for cinematic Interstellar feel when very close,
  // while keeping exact monotonic physics curve above.
  const hoursOnEarth = factor;
  if (hoursOnEarth < 24) {
    return `1 ч здесь = ${hoursOnEarth.toFixed(2).replace('.', ',')} ч на Земле`;
  }
  const days = hoursOnEarth / 24;
  if (days < 365) {
    return `1 ч здесь = ${days.toFixed(1).replace('.', ',')} сут. на Земле`;
  }
  const years = days / 365.25;
  return `1 ч здесь = ${years.toFixed(1).replace('.', ',')} лет на Земле`;
}

/**
 * Formats astronomical distances in Russian with appropriate units.
 */
export function formatDistanceRu(value: number, unit: 'km' | 'ly' = 'km'): string {
  if (!Number.isFinite(value) || value < 0) return '0 км';
  if (unit === 'ly') {
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1).replace('.', ',')} тыс. св. лет`;
    }
    return `${Math.round(value).toLocaleString('ru-RU')} св. лет`;
  }

  if (value < 1) {
    return `${Math.round(value * 1000)} м`;
  }
  if (value < 10_000) {
    return `${value.toFixed(1).replace('.', ',')} км`;
  }
  if (value < 1_000_000) {
    return `${Math.round(value).toLocaleString('ru-RU')} км`;
  }
  if (value < AU_KM * 0.2) {
    return `${(value / 1_000_000).toFixed(2).replace('.', ',')} млн км`;
  }
  const au = value / AU_KM;
  if (au < 1000) {
    return `${au.toFixed(2).replace('.', ',')} а.е.`;
  }
  return `${Math.round(au).toLocaleString('ru-RU')} а.е.`;
}

/**
 * Checks whether the player's camera is within orbital scanning range of a scannable body.
 */
export function isWithinScanRange(body: CelestialBodyData, distanceKm: number): boolean {
  if (!body.scannable || !Number.isFinite(distanceKm)) return false;
  if (body.category === 'deep_space') {
    return distanceKm <= body.radiusKm * 35;
  }
  return distanceKm <= body.radiusKm * 28;
}

/**
 * Returns recommended preset distances (in km or ly for galaxy) for quick-zoom buttons.
 */
export function getScalePresetDistance(
  body: CelestialBodyData,
  preset: 'surface' | 'orbit' | 'system',
): number {
  if (body.category === 'galaxy') {
    return preset === 'surface' ? 18_000 : preset === 'orbit' ? 68_000 : 125_000;
  }
  if (body.category === 'deep_space') {
    if (preset === 'surface') return body.radiusKm * (body.shaderType === 'blackhole' ? 4.8 : 7.5);
    if (preset === 'orbit') return body.radiusKm * 12;
    return body.radiusKm * 28;
  }
  if (preset === 'surface') {
    // Low orbit / surface skimming so mountains, craters, and Earth night cities fill the viewport!
    if (body.hasRockyTerrain) {
      return body.radiusKm * 1.032; // ~200 km over Earth, ~108 km over Mars, ~55 km over Moon
    }
    return body.radiusKm * 1.55;
  }
  if (preset === 'orbit') {
    return body.radiusKm * (body.rings ? 4.4 : 3.1);
  }
  // System overview centered on body
  return Math.max(body.radiusKm * 140, AU_KM * 0.85);
}

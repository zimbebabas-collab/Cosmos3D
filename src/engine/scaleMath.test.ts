import test from 'node:test';
import assert from 'node:assert/strict';
import { BODY_BY_ID, AU_KM } from '../data/celestialCatalog';
import {
  applyLogZoom,
  clampOrbitDistance,
  classifyScaleTier,
  computeAllSolarPositionsKm,
  computeDynamicRenderScale,
  computeSolarBodyPositionKm,
  computeTimeDilationFactor,
  formatDistanceRu,
  formatTimeDilationRu,
  getMinSurfaceAltitudeKm,
  getScalePresetDistance,
  isWithinScanRange,
  lengthVec3,
  projectBodyToScene,
} from './scaleMath';

test('Solar System 1:1 real scale orbital distances match astronomical constants', () => {
  const earth = BODY_BY_ID.earth;
  const moon = BODY_BY_ID.moon;
  const sun = BODY_BY_ID.sun;

  const positions = computeAllSolarPositionsKm(0);
  const sunPos = positions.get('sun')!;
  const earthPos = positions.get('earth')!;
  const moonPos = positions.get('moon')!;

  assert.equal(lengthVec3(sunPos), 0);
  const earthSunDist = lengthVec3(earthPos);
  assert.ok(Math.abs(earthSunDist - AU_KM) < 1, 'Earth should orbit at 1 AU (~149.6M km)');

  const moonEarthDist = Math.hypot(
    moonPos.x - earthPos.x,
    moonPos.y - earthPos.y,
    moonPos.z - earthPos.z,
  );
  assert.ok(Math.abs(moonEarthDist - moon.semiMajorAxisKm) < 1, 'Moon should orbit Earth at 384,400 km');

  // Verify orbital motion after half an Earth year
  const halfYearSec = (earth.orbitalPeriodDays / 2) * 86400;
  const earthPosHalfYear = computeSolarBodyPositionKm(earth, halfYearSec);
  assert.ok(earthPosHalfYear.x * earthPos.x < 0, 'Earth should be on opposite side of Sun after 0.5 year');
});

test('Floating origin projection keeps focused planet crisp at ~100 scene units', () => {
  const earth = BODY_BY_ID.earth;
  const scale = computeDynamicRenderScale(earth.radiusKm);
  const earthPos = { x: AU_KM, y: 0, z: 0 };
  const cameraPos = { x: AU_KM, y: 0, z: earth.radiusKm + 100 }; // 100 km altitude

  const proj = projectBodyToScene(earth, earthPos, cameraPos, scale);
  assert.ok(Math.abs(proj.renderRadius - 100) < 1e-6);
  assert.ok(Math.abs(proj.altitudeKm - 100) < 1e-6);
  assert.ok(Math.abs(proj.position.z + (earth.radiusKm + 100) * scale) < 1e-4);
});

test('Logarithmic zoom clamps safely above rocky surface and zooms monotonically', () => {
  const earth = BODY_BY_ID.earth;
  const minAlt = getMinSurfaceAltitudeKm(earth);
  assert.ok(minAlt >= 2.5 && minAlt < 20, 'Earth min surface altitude should allow low-altitude flyover');

  const startDist = earth.radiusKm * 3;
  const zoomedIn = applyLogZoom(startDist, earth, -1.0, AU_KM * 60);
  const zoomedOut = applyLogZoom(startDist, earth, 1.0, AU_KM * 60);

  assert.ok(zoomedIn < startDist, 'Negative wheel delta should zoom closer');
  assert.ok(zoomedOut > startDist, 'Positive wheel delta should zoom farther');

  const clampedTooClose = clampOrbitDistance(100, earth, AU_KM * 60);
  assert.equal(clampedTooClose, earth.radiusKm + minAlt);
});

test('Scale tier classification transitions cleanly across surface, orbit, system, and galactic', () => {
  const earth = BODY_BY_ID.earth;
  assert.equal(classifyScaleTier(earth, earth.radiusKm * 1.02, false), 'surface');
  assert.equal(classifyScaleTier(earth, earth.radiusKm * 4.0, false), 'orbit');
  assert.equal(classifyScaleTier(earth, earth.radiusKm * 100.0, false), 'system');
  assert.equal(classifyScaleTier(earth, earth.radiusKm * 4.0, true), 'galactic');
});

test('Schwarzschild gravitational time dilation climbs smoothly near Gargantua event horizon', () => {
  const rs = 12_000_000;
  const far = computeTimeDilationFactor(rs * 2000, rs);
  const mid = computeTimeDilationFactor(rs * 2.0, rs);
  const near = computeTimeDilationFactor(rs * 1.02, rs);

  assert.equal(far, 1.0);
  assert.ok(mid > 1.4 && mid < 1.43, 'At 2 Rs, dilation should be sqrt(2) ~= 1.414');
  assert.ok(near > 7.0, 'Near event horizon dilation exceeds 7x');
  assert.ok(formatTimeDilationRu(1.0).includes('нормальное время'));
  assert.ok(formatTimeDilationRu(near).includes('на Земле'));
});

test('Distance formatting and scanner range logic work across all cosmic scales', () => {
  assert.equal(formatDistanceRu(0.45), '450 м');
  assert.ok(formatDistanceRu(408.2).includes('км'));
  assert.ok(formatDistanceRu(AU_KM).includes('а.е.'));
  assert.ok(formatDistanceRu(26_670, 'ly').includes('тыс. св. лет'));

  const mars = BODY_BY_ID.mars;
  assert.equal(isWithinScanRange(mars, getScalePresetDistance(mars, 'orbit')), true);
  assert.equal(isWithinScanRange(mars, AU_KM), false);
});

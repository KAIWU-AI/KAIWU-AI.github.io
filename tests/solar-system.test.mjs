import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SOLAR_SYSTEM_BODIES,
  SUN_VISUAL_RADIUS,
  SOLAR_SCALE_NOTE,
  visualOrbitRadius,
  visualPlanetRadius,
} from '../components/solar-system-data.mjs';

const names = ['Mercury', 'Venus', 'Earth', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune'];

test('includes all eight planets in orbital order', () => {
  assert.deepEqual(SOLAR_SYSTEM_BODIES.map((body) => body.name), names);
  assert.ok(SOLAR_SYSTEM_BODIES.every((body, index, all) => index === 0 || body.orbitAu > all[index - 1].orbitAu));
});

test('visual orbit mapping is monotonic and compresses astronomical distance', () => {
  const visual = SOLAR_SYSTEM_BODIES.map((body) => visualOrbitRadius(body.orbitAu));
  assert.ok(visual.every((value, index) => index === 0 || value > visual[index - 1]));
  const realRatio = SOLAR_SYSTEM_BODIES.at(-1).orbitAu / SOLAR_SYSTEM_BODIES[0].orbitAu;
  const visualRatio = visual.at(-1) / visual[0];
  assert.ok(realRatio > 70);
  assert.ok(visualRatio < 4);
  assert.match(SOLAR_SCALE_NOTE, /visualized|可视化|non-linear/i);
});

test('visual radii preserve broad real hierarchy while keeping small planets visible', () => {
  const radius = Object.fromEntries(SOLAR_SYSTEM_BODIES.map((body) => [body.name, visualPlanetRadius(body.radiusKm)]));
  assert.ok(radius.Jupiter > radius.Saturn);
  assert.ok(radius.Saturn > radius.Uranus);
  assert.ok(radius.Uranus > radius.Earth);
  assert.ok(radius.Earth > radius.Mars);
  assert.ok(radius.Mars > radius.Mercury);
  assert.ok(radius.Mercury >= 0.055);
  assert.ok(SUN_VISUAL_RADIUS >= radius.Jupiter * 2);
});

test('all orbital phases and visual parameters are deterministic finite values', () => {
  for (const body of SOLAR_SYSTEM_BODIES) {
    for (const key of ['radiusKm', 'orbitAu', 'orbitalDays', 'inclinationDeg', 'axialTiltDeg', 'phase']) {
      assert.ok(Number.isFinite(body[key]), `${body.name}.${key}`);
    }
  }
});

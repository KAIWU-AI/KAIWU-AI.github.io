import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SOLAR_SYSTEM_BODIES,
  SUN_VISUAL_RADIUS,
  SOLAR_SCALE_NOTE,
  SOLAR_CAMERA_NARROW,
  axialTiltRadians,
  positionOnVisualOrbit,
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

test('ringed planets retain their full physical axial tilt', () => {
  const saturn = SOLAR_SYSTEM_BODIES.find((body) => body.name === 'Saturn');
  const uranus = SOLAR_SYSTEM_BODIES.find((body) => body.name === 'Uranus');
  assert.ok(Math.abs(axialTiltRadians(saturn) - 26.73 * Math.PI / 180) < 1e-12);
  assert.ok(Math.abs(axialTiltRadians(uranus) - 97.77 * Math.PI / 180) < 1e-12);
});

test('scale disclosure covers visualized phase and time rather than implying an ephemeris', () => {
  assert.match(SOLAR_SCALE_NOTE, /phase/i);
  assert.match(SOLAR_SCALE_NOTE, /time/i);
  assert.match(SOLAR_SCALE_NOTE, /not an ephemeris/i);
});

test('all orbital phases and visual parameters are deterministic finite values', () => {
  for (const body of SOLAR_SYSTEM_BODIES) {
    for (const key of ['radiusKm', 'orbitAu', 'orbitalDays', 'inclinationDeg', 'axialTiltDeg', 'phase']) {
      assert.ok(Number.isFinite(body[key]), `${body.name}.${key}`);
    }
  }
});

test('planet positions stay on the same inclined planes as their orbit lines', () => {
  for (const body of SOLAR_SYSTEM_BODIES) {
    const position = positionOnVisualOrbit(body, body.phase + 0.731);
    const inclination = (body.inclinationDeg * Math.PI) / 180;
    const planeError = position.y * Math.cos(inclination) + position.z * Math.sin(inclination);
    assert.ok(Math.abs(planeError) < 1e-10, `${body.name} leaves its inclined orbit plane`);
  }
});

test('portrait camera fits the complete outer orbit with planet padding', () => {
  const distance = Math.hypot(...SOLAR_CAMERA_NARROW);
  const portraitCanvasAspect = 390 / 544;
  const halfHorizontalView = Math.tan((34 * Math.PI) / 360) * distance * portraitCanvasAspect;
  const required = visualOrbitRadius(30.07) + visualPlanetRadius(69911);
  assert.ok(halfHorizontalView > required * 1.15, `${halfHorizontalView} must exceed ${required} with 15% margin`);
});

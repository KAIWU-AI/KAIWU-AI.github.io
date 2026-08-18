import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const cases = [
  ['../public/components/planetary-gear-kit.js', '5373a97455dbf08e9a9e50e8d70de874fd37bece1b14a9c269289793f6e44075', 'PlanetaryGearKit'],
  ['../public/components/universal-joint-kit.js', '0aecd33857d886eb9b771135df3717f7dc76eebc774fe03dda635d1dc30f90fd', 'UniversalJointKit'],
];

async function loadKit(relativePath, name) {
  const source = await readFile(new URL(relativePath, import.meta.url), 'utf8');
  const context = vm.createContext({ window: {} });
  vm.runInContext(source, context, { filename: relativePath });
  return { source, kit: context.window[name] };
}

test('adopted mechanical components remain byte-identical to validated CreatorSkills assets', async () => {
  for (const [path, expected] of cases) {
    const source = await readFile(new URL(path, import.meta.url));
    const actual = createHash('sha256').update(source).digest('hex');
    assert.equal(actual, expected, path);
  }
});

test('planetary component enforces tooth relation and fixed-ring ratio', async () => {
  const { kit } = await loadKit(cases[0][0], cases[0][2]);
  const report = kit.validate({ sunTeeth: 18, planetTeeth: 12, ringTeeth: 42, planetCount: 3 });
  assert.equal(report.valid, true);
  assert.ok(Math.abs(report.ratioFixedRing - 10 / 3) < 1e-12);
  assert.ok(Math.abs(report.carrierSpeedForSun1 - 0.3) < 1e-12);
  assert.equal(kit.validate({ sunTeeth: 18, planetTeeth: 12, ringTeeth: 41, planetCount: 3 }).valid, false);
});

test('universal-joint component preserves single-Cardan angle and speed relations', async () => {
  const { kit } = await loadKit(cases[1][0], cases[1][2]);
  const beta = 25 * Math.PI / 180;
  assert.ok(Math.abs(kit.continuousOutputAngle(0, beta)) < 1e-12);
  assert.ok(Math.abs(kit.continuousOutputAngle(Math.PI / 2, beta) - Math.PI / 2) < 1e-12);
  assert.ok(Math.abs(kit.speedRatio(0, beta) - Math.cos(beta)) < 1e-12);
  assert.ok(Math.abs(kit.speedRatio(Math.PI / 2, beta) - 1 / Math.cos(beta)) < 1e-12);
});

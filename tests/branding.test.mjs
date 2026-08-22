import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

async function text(path) {
  return readFile(resolve(root, path), 'utf8');
}

function colorToken(styles, name) {
  const match = styles.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, 'i'));
  assert.ok(match, `missing --${name} color token`);
  return match[1];
}

function luminance(hex) {
  const channels = [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const linear = channels.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrastRatio(first, second) {
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

test('public product surfaces are fully branded as MindMotion', async () => {
  const [html, runtime, starfield, readme] = await Promise.all([
    text('index.html'),
    text('three-lab.js'),
    text('starfield.js'),
    text('README.md'),
  ]);

  assert.doesNotMatch(html, /AgentV/i);
  assert.doesNotMatch(runtime, /AgentV/i);
  assert.doesNotMatch(starfield, /AgentV/i);
  assert.match(readme, /MindMotion/);
  assert.match(html, /<title>MindMotion by KAIWU-AI · AI 教育视频生成<\/title>/);
  assert.match(html, /class="hero-product-name">MindMotion，<\/span>/);
  assert.match(html, /MindMotion \/ Product/);
});

test('official PR #24 logo is reused byte-for-byte and wired into brand surfaces', async () => {
  const [html, logo] = await Promise.all([
    text('index.html'),
    readFile(resolve(root, 'assets/mindmotion-logo.svg')),
  ]);

  assert.equal(
    createHash('sha256').update(logo).digest('hex'),
    '0b5f7c73cf8e12280643583584ade4ab233f49c6ab84e286f085c029d1da528f',
  );
  assert.match(html, /href="assets\/mindmotion-logo\.svg"/);
  assert.equal((html.match(/src="assets\/mindmotion-logo\.svg"/g) || []).length, 2);
  assert.match(html, /<span class="brand-wordmark">MindMotion<\/span>/);
  assert.match(html, /<small>by KAIWU-AI<\/small>/);
});

test('MindMotion violet identity is adapted without changing the core page structure', async () => {
  const [html, styles] = await Promise.all([text('index.html'), text('styles.css')]);

  assert.match(styles, /--accent:\s*#8b5cf6/);
  assert.match(styles, /--accent-text:\s*#a78bfa/);
  assert.match(styles, /--accent-action:\s*#7c3aed/);
  assert.match(styles, /--accent-strong:\s*#a78bfa/);
  assert.match(styles, /--brand-gradient:\s*linear-gradient\(135deg, #8b5cf6, #5b21b6\)/);
  assert.match(styles, /\.button-primary\s*\{[^}]*background:\s*var\(--accent-action\)/s);
  assert.match(styles, /\.skip-link\s*\{[^}]*background:\s*var\(--accent-action\)/s);
  assert.match(styles, /--bg:\s*#100f16/);

  const requiredSections = ['top', 'lab', 'mission', 'directions', 'projects'];
  let previousIndex = -1;
  for (const section of requiredSections) {
    const nextIndex = html.indexOf(`id="${section}"`);
    assert.ok(nextIndex > previousIndex, `${section} must retain its position in the core flow`);
    previousIndex = nextIndex;
  }
  assert.deepEqual(
    [...html.matchAll(/data-three-view="(solar|gearbox|joint)"/g)].map((match) => match[1]),
    ['solar', 'gearbox', 'joint'],
  );
});

test('small text and action colors meet WCAG AA on MindMotion surfaces', async () => {
  const styles = await text('styles.css');
  const surfaces = [colorToken(styles, 'bg'), colorToken(styles, 'panel')];

  for (const foreground of [colorToken(styles, 'text-dim'), colorToken(styles, 'accent-text')]) {
    for (const surface of surfaces) {
      assert.ok(
        contrastRatio(foreground, surface) >= 4.5,
        `${foreground} must reach 4.5:1 on ${surface}`,
      );
    }
  }

  assert.ok(contrastRatio('#ffffff', colorToken(styles, 'accent-action')) >= 4.5);
  assert.match(styles, /\.lab-scene-meta\s*\{[^}]*color:\s*var\(--accent-text\)/s);
});

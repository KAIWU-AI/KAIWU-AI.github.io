import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const external = /^(?:https?:|mailto:|tel:|#|data:|\/\/)/i;

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

test('all local HTML, CSS and module references resolve inside the static site', async () => {
  const index = await readFile(resolve(root, 'index.html'), 'utf8');
  const styles = await readFile(resolve(root, 'styles.css'), 'utf8');
  const lab = await readFile(resolve(root, 'three-lab.js'), 'utf8');
  const references = [];

  for (const match of index.matchAll(/(?:src|href)=["']([^"']+)["']/g)) {
    references.push(match[1]);
  }
  for (const match of styles.matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
    references.push(match[1]);
  }
  for (const match of lab.matchAll(/from\s+["']([^"']+)["']/g)) {
    references.push(match[1]);
  }

  const missing = [];
  for (const reference of references) {
    if (external.test(reference)) continue;
    const clean = reference.split(/[?#]/)[0];
    if (!clean) continue;
    const absolute = resolve(root, clean);
    if (!(await exists(absolute))) missing.push(reference);
  }
  assert.deepEqual(missing, []);
});

test('HTML script elements are balanced so module markup cannot swallow the page', async () => {
  const html = await readFile(resolve(root, 'index.html'), 'utf8');
  assert.equal((html.match(/<script\b/g) || []).length, (html.match(/<\/script>/g) || []).length);
});

test('README code fences are balanced and Pages setup action is unique', async () => {
  const readme = await readFile(resolve(root, 'README.md'), 'utf8');
  const workflow = await readFile(resolve(root, '.github/workflows/pages.yml'), 'utf8');
  assert.equal((readme.match(/```/g) || []).length % 2, 0);
  assert.equal((workflow.match(/actions\/configure-pages@v5/g) || []).length, 1);
});

test('3D viewport exposes keyboard rotation and reset semantics', async () => {
  const html = await readFile(resolve(root, 'index.html'), 'utf8');
  const viewports = [...html.matchAll(/data-three-view="(solar|gearbox|joint)"/g)];
  assert.deepEqual(viewports.map((match) => match[1]), ['solar', 'gearbox', 'joint']);
  assert.equal((html.match(/data-three-canvas/g) || []).length, 3);
  assert.doesNotMatch(html, /class="lab-selector"/);
  assert.ok(html.indexOf('id="lab"') < html.indexOf('id="mission"'));
  assert.match(html, /tabindex="0"/);
  assert.match(html, /aria-label=/);
  assert.match(html, /方向键/);
});

test('starfield paints immediately with a denser motion field', async () => {
  const script = await readFile(resolve(root, 'starfield.js'), 'utf8');
  assert.match(script, /return Math\.max\(96,/);
  assert.match(script, /drawStaticField\(\);\s*if \(reducedMotion\.matches\)/s);
});

test('3D runtime feature-detects observers and handles WebGL context loss', async () => {
  const script = await readFile(resolve(root, 'three-lab.js'), 'utf8');
  assert.match(script, /if \("IntersectionObserver" in window\)/);
  assert.match(script, /if \("ResizeObserver" in window\)/);
  assert.match(script, /webglcontextlost/);
  const html = await readFile(resolve(root, 'index.html'), 'utf8');
  assert.match(html, /import\("\.\/three-lab\.js"\)\.catch/);
});

test('3D lab supports WebGL1 and keeps a visual fallback without WebGL', async () => {
  const script = await readFile(resolve(root, 'three-lab.js'), 'utf8');
  const html = await readFile(resolve(root, 'index.html'), 'utf8');
  const css = await readFile(resolve(root, 'styles.css'), 'utf8');
  const legacyRuntime = await readFile(resolve(root, 'vendor/three-r162.module.min.js'));
  assert.equal(
    createHash('sha256').update(legacyRuntime).digest('hex'),
    'ecd9f6b9bc1a12efdf14d13e4c610c012903c141a77d967d3f500bc727f0896c',
  );
  assert.match(script, /getContext\("webgl2"\)/);
  assert.match(script, /getContext\("webgl"\)/);
  assert.match(script, /three-r162\.module\.min\.js/);
  assert.match(script, /is-webgl-ready/);
  assert.match(html, /lab-fallback-visual/);
  assert.match(css, /\.lab-viewport\.is-webgl-ready/);
});

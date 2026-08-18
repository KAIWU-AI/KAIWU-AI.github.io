import test from 'node:test';
import assert from 'node:assert/strict';
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

test('README code fences are balanced and Pages setup action is unique', async () => {
  const readme = await readFile(resolve(root, 'README.md'), 'utf8');
  const workflow = await readFile(resolve(root, '.github/workflows/pages.yml'), 'utf8');
  assert.equal((readme.match(/```/g) || []).length % 2, 0);
  assert.equal((workflow.match(/actions\/configure-pages@v5/g) || []).length, 1);
});

test('3D viewport exposes keyboard rotation and reset semantics', async () => {
  const html = await readFile(resolve(root, 'index.html'), 'utf8');
  const viewport = html.match(/<div\b(?=[^>]*class="lab-viewport")[^>]*>/s)?.[0] || '';
  assert.match(viewport, /tabindex="0"/);
  assert.match(viewport, /aria-label=/);
  assert.match(html, /方向键/);
});

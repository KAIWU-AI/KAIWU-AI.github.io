import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const productUrl = 'https://thedoorofai.com/api/kaiwuai/mindmotion/about/';
const source = (file) => readFile(resolve(root, file), 'utf8');

test('both download CTAs link to the product website without JavaScript; product navigation stays unchanged', async () => {
  const html = await source('index.html');
  const navigation = html.match(/<div class="nav-links"[\s\S]*?<\/div>/)?.[0];
  const hero = html.match(/<div class="hero-actions">[\s\S]*?<\/div>/)?.[0];
  const footerCta = html.match(/<section class="cta section container"[\s\S]*?<\/section>/)?.[0];
  assert.match(navigation, /<a href="#mission">MindMotion \/ Product<\/a>/);
  for (const section of [hero, footerCta]) {
    assert.ok(section);
    assert.ok(section.includes(`href="${productUrl}"`));
  }
  assert.match(hero, /产品官网/);
  assert.doesNotMatch(hero, /aria-disabled|tabindex="-1"|\sdownload(?:=|\s|>)/);
  assert.match(footerCta, /产品官网/);
});

test('homepage has no platform-dependent download routing or direct installer/Store links', async () => {
  const html = await source('index.html');
  assert.doesNotMatch(html, /platform-download|data-(?:windows|macos|android)-download|data-download-(?:label|icon)|#desktop-download|ms-windows-store:|apps\.microsoft\.com|releases\/download|\.dmg(?:"|\?)|\.apk(?:"|\?)|\.exe(?:"|\?)/);
  await assert.rejects(access(resolve(root, 'platform-download.js')), { code: 'ENOENT' });
});

test('public documentation delegates downloads to the product website', async () => {
  for (const file of ['README.md', 'docs/mindmotion-brand-integration.md']) {
    const text = await source(file);
    assert.ok(text.includes(productUrl));
    assert.doesNotMatch(text, /ms-windows-store:|apps\.microsoft\.com|releases\/download|#desktop-download/);
  }
});

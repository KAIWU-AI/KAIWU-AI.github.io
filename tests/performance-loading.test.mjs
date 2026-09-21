import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('the heavyweight 3D lab is requested only when the lab enters the viewport', async () => {
  const html = await read('index.html');
  const loader = await read('three-lab-loader.js');

  assert.match(html, /<script src="three-lab-loader\.js" defer><\/script>/);
  assert.doesNotMatch(html, /<script src="public\/components\/(?:planetary-gear|universal-joint)-kit\.js"/);
  assert.doesNotMatch(html, /import\("\.\/three-lab\.js"\)/);
  assert.match(loader, /querySelector\("#lab"\)/);
  assert.match(loader, /new IntersectionObserver/);
  assert.match(loader, /rootMargin:\s*"0px"/);
  assert.match(loader, /import\("\.\/three-lab\.js"\)/);
  assert.match(loader, /observer\.unobserve\(lab\)/);
});

test('each 3D scene initializes independently and shares one Three runtime request', async () => {
  const lab = await read('three-lab.js');

  assert.match(lab, /let threeRuntimePromise/);
  assert.match(lab, /let sceneActivationQueue = Promise\.resolve\(\)/);
  assert.match(lab, /function scheduleSceneCreation\(task\)/);
  assert.match(lab, /requestIdleCallback/);
  assert.match(lab, /function activateViewport\(viewport\)/);
  assert.match(lab, /new IntersectionObserver\([\s\S]*activateViewport/);
  assert.match(lab, /import\("\.\/public\/components\/planetary-gear-kit\.js"\)/);
  assert.match(lab, /import\("\.\/public\/components\/universal-joint-kit\.js"\)/);
  assert.doesNotMatch(lab, /for \(const viewport of viewports\) \{\s*views\.push\(createView\(viewport\)\);\s*\}/);
});

test('3D rendering is frame-capped and offscreen scenes remain paused', async () => {
  const lab = await read('three-lab.js');

  assert.match(lab, /const targetFrameInterval/);
  assert.match(lab, /compactDevice \? 1000 \/ 20 : 1000 \/ 30/);
  assert.match(lab, /time - runtimeState\.lastRenderTime < targetFrameInterval/);
  assert.match(lab, /Math\.max\(0, Math\.min\(\(time - runtimeState\.lastTime\) \/ 1000, 0\.05\)\)/);
  assert.match(lab, /!views\.some\(\(view\) => view\.visible && !view\.error\)/);
});

test('video bytes are attached on intersection instead of during HTML parsing', async () => {
  const html = await read('index.html');
  const script = await read('script.js');

  assert.equal((html.match(/<video\b/g) || []).length, (html.match(/data-src="assets\/videos\//g) || []).length);
  assert.doesNotMatch(html, /<video[\s\S]*?\ssrc="assets\/videos\//);
  assert.match(script, /video\.src = video\.dataset\.src/);
  assert.match(script, /video\.load\(\)/);
});

test('the decorative starfield limits GPU work to an adaptive frame rate', async () => {
  const starfield = await read('starfield.js');

  assert.match(starfield, /const targetFrameInterval/);
  assert.match(starfield, /compactDevice \? 1000 \/ 20 : 1000 \/ 30/);
  assert.match(starfield, /time - previousPaintTime < targetFrameInterval/);
  assert.match(starfield, /const turnCos = Math\.cos\(turn\)/);
  assert.match(starfield, /const turnSin = Math\.sin\(turn\)/);
});

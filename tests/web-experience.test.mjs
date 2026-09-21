import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const experienceRoot = resolve(root, 'try');
const external = /^(?:https?:|mailto:|tel:|#|data:|\/\/)/i;

async function text(path) {
  return readFile(resolve(root, path), 'utf8');
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function loadExperienceModule() {
  return import(`${pathToFileURL(resolve(experienceRoot, 'app.js')).href}?test=${Date.now()}`);
}

test('homepage exposes the Web experience and keeps the desktop capability boundary visible', async () => {
  const html = await text('index.html');

  assert.match(html, /class="nav-experience" href="try\/">Web 体验 \/ Try<\/a>/);
  assert.match(html, /class="button button-primary" href="try\/">/);
  assert.match(html, /真实生成、编辑与导出能力需安装桌面版/);
  assert.match(html, /data-platform-download/);
});

test('experience page is explicitly a local preset demo with a desktop upgrade path', async () => {
  const html = await text('try/index.html');

  assert.match(html, /INTERACTIVE DEMO · 无需登录/);
  assert.match(html, /不会上传或保存你的输入/);
  assert.match(html, /页面使用内置模板生成演示结果，不会创建或导出真实视频/);
  assert.match(html, /演示素材 · 非实时生成结果/);
  assert.match(html, /真实生成 · 项目编辑 · 本地素材 · 视频导出/);
  assert.match(html, /data-windows-download-url=/);
  assert.match(html, /data-macos-download-url=/);
  assert.doesNotMatch(html, /password|accessToken|api\/kaiwuai/i);
});

test('experience runtime stays local and avoids unsafe HTML or persistent browser storage', async () => {
  const script = await text('try/app.js');

  assert.doesNotMatch(script, /\bfetch\s*\(/);
  assert.doesNotMatch(script, /localStorage|sessionStorage|indexedDB/);
  assert.doesNotMatch(script, /innerHTML|insertAdjacentHTML|eval\s*\(/);
  assert.match(script, /textContent = plan\.title/);
  assert.match(script, /replaceChildren\(\)/);
});

test('preset selection and custom plans are deterministic and bounded', async () => {
  const { buildDemoPlan, normalizeTopic, selectPreset } = await loadExperienceModule();

  assert.equal(selectPreset('八大行星与太阳').id, 'solar');
  assert.equal(selectPreset('牛顿第二定律').id, 'physics');
  assert.equal(selectPreset('大语言模型').id, 'models');
  assert.equal(normalizeTopic('  光的   折射  '), '光的 折射');
  assert.equal(normalizeTopic('知'.repeat(100)).length, 80);

  const custom = buildDemoPlan('光的折射');
  assert.equal(custom.topic, '光的折射');
  assert.equal(custom.title, '光的折射：可视化课程方案');
  assert.equal(custom.scenes.length, 3);
  assert.ok(custom.scenes.every((scene) => scene.title && scene.description && scene.format));
});

test('all local references in the experience page resolve inside the static site', async () => {
  const html = await text('try/index.html');
  const styles = await text('try/styles.css');
  const references = [];

  for (const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)) {
    references.push(match[1]);
  }
  for (const match of styles.matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
    references.push(match[1]);
  }

  const missing = [];
  for (const reference of references) {
    if (external.test(reference)) continue;
    const clean = reference.split(/[?#]/)[0];
    if (!clean) continue;
    if (!(await exists(resolve(experienceRoot, clean)))) missing.push(reference);
  }

  assert.deepEqual(missing, []);
});

test('experience has responsive and reduced-motion behavior', async () => {
  const [html, styles, script] = await Promise.all([
    text('try/index.html'),
    text('try/styles.css'),
    text('try/app.js'),
  ]);

  assert.match(html, /aria-live="polite"/);
  assert.match(html, /role="progressbar"/);
  assert.match(html, /maxlength="80"/);
  assert.match(styles, /@media \(max-width: 780px\)/);
  assert.match(styles, /@media \(max-width: 520px\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(script, /prefers-reduced-motion: reduce/);
});

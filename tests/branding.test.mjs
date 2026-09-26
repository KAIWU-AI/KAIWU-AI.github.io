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

  // AgentV remains only as the required sign-in identity for case search.
  const productHtml = html
    .replace('需要已获授权的 AgentV 用户登录。', '')
    .replace('Sign-in with an authorized AgentV account is required.', '');
  assert.doesNotMatch(productHtml, /AgentV/i);
  assert.doesNotMatch(runtime, /AgentV/i);
  assert.doesNotMatch(starfield, /AgentV/i);
  assert.match(readme, /MindMotion/);
  assert.match(html, /<title>MindMotion by KAIWU-AI · AI 教育视频生成<\/title>/);
  assert.match(html, /class="hero-product-name">MindMotion，<\/span>/);
  assert.match(
    html,
    /<h1 id="hero-title">\s*<span class="hero-product-name">MindMotion，<\/span>\s*<span>让知识<\/span>\s*<span class="muted-title">生动放映<\/span>\s*<\/h1>/,
  );
  assert.doesNotMatch(html, /成为生动的视频/);
  assert.match(html, /MindMotion \/ Product/);
});

test('case search replaces source-release promises and all fragment links resolve', async () => {
  const html = await text('index.html');
  const searchUrl = 'https://thedoorofai.com/api/kaiwuai/mindmotion/search/';
  assert.doesNotMatch(html, /开源|公开源码|公开代码|open[-\s]source|code[^<]*will be shared/i);
  const nav = html.match(/<nav[\s\S]*?<\/nav>/)?.[0] || '';
  const projects = html.match(/<section[^>]*id="projects"[\s\S]*?<\/section>/)?.[0] || '';
  for (const block of [nav, projects]) {
    assert.ok(block.includes(`href="${searchUrl}"`));
    assert.match(block, /案例搜索/);
    assert.match(block, /Case search/i);
    assert.doesNotMatch(block, /github\.com|IN PREPARATION/);
  }
  assert.match(projects, /THU课程成果知识库/);
  assert.match(projects, /THU Course Outcomes Knowledge Base/);
  assert.match(projects, /需要已获授权的 AgentV 用户登录。/);
  assert.match(projects, /Sign-in with an authorized AgentV account is required\./);
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(ids.length, new Set(ids).size, 'IDs must be unique');
  for (const [, id] of html.matchAll(/\shref="#([^"]*)"/g)) {
    assert.ok(ids.includes(id), `missing anchor target: ${id}`);
  }
});

test('download and brand documentation reflect desktop guidance and the sign-in exception', async () => {
  const readme = await text('README.md');
  const brand = await text('docs/mindmotion-brand-integration.md');
  assert.match(readme, /ms-windows-store:\/\/pdp\/\?ProductId=9NPQH4HQD3WK/);
  assert.match(readme, /https:\/\/apps\.microsoft\.com\/detail\/9NPQH4HQD3WK/);
  assert.match(readme, /#desktop-download/);
  assert.match(readme, /https:\/\/kaiwu-ai\.github\.io\//);
  assert.match(readme, /https:\/\/thedoorofai\.com\/api\/kaiwuai\/mindmotion\/search\//);
  assert.doesNotMatch(readme, /其他平台保持禁用|不支持|unsupported/i);
  assert.match(brand, /AgentV.*登录/);
  assert.doesNotMatch(brand, /不更改组织名、GitHub 链接|公开页面和运行时不存在旧产品名/);
});

test('hero workflow prompt describes large language and diffusion models', async () => {
  const html = await text('index.html');

  assert.match(html, /生成一节关于大语言模型和扩散模型的可视化课程/);
  assert.match(html, /Create a visual lesson about large language models and diffusion models\./);
  assert.doesNotMatch(html, /生成一节关于宇宙与行星的可视化课程/);
  assert.doesNotMatch(html, /Create a visual lesson about space and planets\./);
});

test('the user-provided M logo is reused byte-for-byte across public brand surfaces', async () => {
  const [html, logo] = await Promise.all([
    text('index.html'),
    readFile(resolve(root, 'assets/mindmotion-logo.png')),
  ]);

  assert.equal(
    createHash('sha256').update(logo).digest('hex'),
    'a693a476edb223143bf0b9d6cae1900365ed6b9e90978e8f33ae1c8daf93d0bd',
  );
  assert.match(html, /href="assets\/mindmotion-logo\.png" type="image\/png"/);
  assert.equal((html.match(/src="assets\/mindmotion-logo\.png"/g) || []).length, 2);
  assert.doesNotMatch(html, /mindmotion-logo\.svg/);
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

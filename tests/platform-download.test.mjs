import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const downloadUrl =
  'https://github.com/KAIWU-AI/KAIWU-AI.github.io/releases/download/desktop-v0.1.1/MindMotion_0.1.1_x64-setup.exe';

async function loadModule() {
  return import(`${pathToFileURL(resolve(root, 'platform-download.js')).href}?test=${Date.now()}`);
}

function fakeButton() {
  const attributes = new Map();
  const classes = new Set(['is-disabled']);
  const label = { textContent: '' };
  const icon = { textContent: '' };
  let clickHandler = null;

  return {
    dataset: { downloadUrl },
    classList: {
      add: (name) => classes.add(name),
      remove: (name) => classes.delete(name),
      contains: (name) => classes.has(name),
    },
    setAttribute: (name, value) => attributes.set(name, String(value)),
    removeAttribute: (name) => attributes.delete(name),
    getAttribute: (name) => attributes.get(name) ?? null,
    querySelector: (selector) =>
      selector === '[data-download-label]' ? label : selector === '[data-download-icon]' ? icon : null,
    addEventListener: (name, handler) => {
      if (name === 'click') clickHandler = handler;
    },
    label,
    icon,
    classes,
    attributes,
    click: () => {
      const event = { prevented: false, preventDefault() { this.prevented = true; } };
      clickHandler?.(event);
      return event;
    },
  };
}

test('hero primary action is wired to the verified Windows release asset', async () => {
  const html = await readFile(resolve(root, 'index.html'), 'utf8');
  assert.match(html, /<script type="module" src="platform-download\.js"><\/script>/);
  assert.match(html, /data-platform-download/);
  assert.match(html, new RegExp(`data-download-url="${downloadUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`));
  assert.doesNotMatch(
    html.match(/<div class="hero-actions">[\s\S]*?<\/div>/)?.[0] || '',
    /在 GitHub 上关注/,
  );
});

test('platform detection distinguishes Windows and macOS', async () => {
  const { detectDesktopPlatform } = await loadModule();
  assert.equal(detectDesktopPlatform({ userAgentData: { platform: 'Windows' } }), 'windows');
  assert.equal(detectDesktopPlatform({ platform: 'Win32' }), 'windows');
  assert.equal(detectDesktopPlatform({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }), 'windows');
  assert.equal(detectDesktopPlatform({ userAgentData: { platform: 'macOS' } }), 'macos');
  assert.equal(detectDesktopPlatform({ platform: 'MacIntel' }), 'macos');
  assert.equal(detectDesktopPlatform({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' }), 'macos');
  assert.equal(detectDesktopPlatform({ platform: 'Linux x86_64' }), 'other');
});

test('platform detection fails closed for conflicts and mobile devices', async () => {
  const { detectDesktopPlatform } = await loadModule();
  assert.equal(
    detectDesktopPlatform({
      userAgentData: { platform: 'macOS' },
      platform: 'MacIntel',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    }),
    'other',
  );
  assert.equal(
    detectDesktopPlatform({
      userAgentData: { platform: 'Linux' },
      platform: 'Linux x86_64',
      userAgent: 'Mozilla/5.0 (Windows Phone 10.0; Android 6.0.1)',
    }),
    'other',
  );
  assert.equal(
    detectDesktopPlatform({ userAgent: 'Mozilla/5.0 (Windows Phone 10.0; Android 6.0.1; Microsoft)' }),
    'other',
  );
  assert.equal(
    detectDesktopPlatform({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile' }),
    'other',
  );
  assert.equal(
    detectDesktopPlatform({ platform: 'MacIntel', maxTouchPoints: 5, userAgent: 'Mozilla/5.0 (iPad)' }),
    'other',
  );
  assert.equal(detectDesktopPlatform({ platform: 'Windows Phone' }), 'other');
  assert.equal(detectDesktopPlatform({ userAgentData: { platform: 'Windows Phone' } }), 'other');
  assert.equal(detectDesktopPlatform({ userAgentData: { platform: 'Windows', mobile: true } }), 'other');
  assert.equal(detectDesktopPlatform({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Macintosh; Intel Mac OS X)' }), 'other');
  assert.equal(detectDesktopPlatform({ platform: 'Win32 MacIntel' }), 'other');
  assert.equal(detectDesktopPlatform({ userAgentData: { platform: 'Windows Linux' } }), 'other');
  assert.equal(detectDesktopPlatform({ platform: 'FreeBSD amd64', userAgent: 'Windows NT 10.0' }), 'other');
  assert.equal(detectDesktopPlatform({ platform: 'OpenBSD', userAgent: 'Windows NT 10.0' }), 'other');
  assert.equal(detectDesktopPlatform({ userAgentData: { platform: 'macOS' }, platform: 'SunOS' }), 'other');
  assert.equal(detectDesktopPlatform({ platform: 'Win32', userAgent: 'Mozilla/5.0 (BB10; Touch)' }), 'other');
  assert.equal(detectDesktopPlatform({ platform: 'mystery-os', userAgent: 'Windows NT 10.0' }), 'other');
  for (const marker of ['iOS', 'ChromeOS', 'BSD']) {
    assert.equal(detectDesktopPlatform({ userAgentData: { platform: `Windows ${marker}` } }), 'other');
    assert.equal(detectDesktopPlatform({ platform: `Windows ${marker}` }), 'other');
    assert.equal(detectDesktopPlatform({ userAgent: `Windows ${marker}` }), 'other');
  }
  for (const marker of ['iOS', 'ChromeOS', 'BSD', 'Android 14; Mobile']) {
    assert.equal(
      detectDesktopPlatform({ userAgent: `Mozilla/5.0 (Windows NT 10.0; ${marker})` }),
      'other',
    );
  }
  for (const marker of ['iOS', 'ChromeOS', 'BSD']) {
    assert.equal(
      detectDesktopPlatform({ userAgent: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7; ${marker})` }),
      'other',
    );
  }
  assert.equal(
    detectDesktopPlatform({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:142.0) Gecko/20100101 Firefox/142.0',
    }),
    'windows',
  );
  assert.equal(
    detectDesktopPlatform({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:142.0) Gecko/20100101 Firefox/142.0',
    }),
    'macos',
  );
  for (const userAgent of [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Mobile',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Macintosh Android Mobile',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15',
    'Mozilla/5.0 (Windows NT 999.0; Win64; x64)',
    'Mozilla/5.0 (Windows NT 6.1; Win64; x64)',
  ]) {
    assert.equal(detectDesktopPlatform({ userAgent }), 'other');
  }
  for (const userAgent of [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
  ]) {
    assert.notEqual(detectDesktopPlatform({ userAgent }), 'other');
  }
  assert.equal(detectDesktopPlatform({}), 'other');
});

test('Windows visitors receive a direct download link', async () => {
  const { configurePlatformDownload } = await loadModule();
  const button = fakeButton();
  configurePlatformDownload(button, { userAgentData: { platform: 'Windows' } });

  assert.equal(button.getAttribute('href'), downloadUrl);
  assert.equal(button.getAttribute('download'), 'MindMotion_0.1.1_x64-setup.exe');
  assert.equal(button.getAttribute('aria-disabled'), null);
  assert.equal(button.label.textContent, '下载 Windows 版');
  assert.equal(button.icon.textContent, '↓');
  assert.equal(button.classList.contains('is-disabled'), false);
  assert.equal(button.click().prevented, false);
});

test('macOS visitors see coming soon without a downloadable link', async () => {
  const { configurePlatformDownload } = await loadModule();
  const button = fakeButton();
  configurePlatformDownload(button, { platform: 'MacIntel' });

  assert.equal(button.getAttribute('href'), null);
  assert.equal(button.getAttribute('download'), null);
  assert.equal(button.getAttribute('aria-disabled'), 'true');
  assert.equal(button.label.textContent, 'macOS 版敬请期待');
  assert.equal(button.icon.textContent, '…');
  assert.equal(button.classList.contains('is-disabled'), true);
  assert.equal(button.click().prevented, true);
});

test('other platforms do not receive an incompatible installer', async () => {
  const { configurePlatformDownload } = await loadModule();
  const button = fakeButton();
  configurePlatformDownload(button, { platform: 'Linux x86_64' });

  assert.equal(button.getAttribute('href'), null);
  assert.equal(button.getAttribute('aria-disabled'), 'true');
  assert.equal(button.label.textContent, '暂仅支持 Windows');
  assert.equal(button.click().prevented, true);
});

test('reconfiguration removes stale download state and can safely re-enable Windows', async () => {
  const { configurePlatformDownload } = await loadModule();
  const button = fakeButton();

  configurePlatformDownload(button, { platform: 'Win32' });
  assert.equal(button.getAttribute('href'), downloadUrl);

  configurePlatformDownload(button, { platform: 'MacIntel' });
  assert.equal(button.getAttribute('href'), null);
  assert.equal(button.getAttribute('download'), null);
  assert.equal(button.getAttribute('aria-disabled'), 'true');
  assert.equal(button.click().prevented, true);

  configurePlatformDownload(button, { platform: 'Win32' });
  assert.equal(button.getAttribute('href'), downloadUrl);
  assert.equal(button.getAttribute('aria-disabled'), null);
  assert.equal(button.click().prevented, false);
});

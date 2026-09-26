import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const windowsDownloadUrl =
  'ms-windows-store://pdp/?ProductId=9NPQH4HQD3WK';
const windowsFallbackUrl = 'https://apps.microsoft.com/detail/9NPQH4HQD3WK';
const macosDownloadUrl =
  'https://github.com/KAIWU-AI/KAIWU-AI.github.io/releases/download/desktop-v0.2.0/MindMotion_0.2.0_aarch64.dmg';

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
    dataset: { windowsDownloadUrl, macosDownloadUrl },
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

test('hero primary action uses Microsoft Store for Windows and the 0.2.0 macOS disk image', async () => {
  const html = await readFile(resolve(root, 'index.html'), 'utf8');
  assert.match(html, /<script type="module" src="platform-download\.js"><\/script>/);
  assert.match(html, /data-platform-download/);
  assert.match(html, new RegExp(`data-windows-download-url="${windowsDownloadUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`));
  assert.match(html, new RegExp(`data-macos-download-url="${macosDownloadUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`));
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

test('Windows visitors receive a Microsoft Store link without a download attribute', async () => {
  const { configurePlatformDownload } = await loadModule();
  const button = fakeButton();
  configurePlatformDownload(button, { userAgentData: { platform: 'Windows' } });

  assert.equal(button.getAttribute('href'), windowsDownloadUrl);
  assert.equal(button.getAttribute('download'), null);
  assert.equal(button.getAttribute('aria-label'), '下载 MindMotion Windows 桌面客户端（Microsoft Store）');
  assert.equal(button.getAttribute('title'), '下载 MindMotion Windows 桌面客户端（Microsoft Store）');
  assert.equal(button.getAttribute('aria-disabled'), null);
  assert.equal(button.label.textContent, '下载桌面客户端 · Windows');
  assert.equal(button.icon.textContent, '↓');
  assert.equal(button.classList.contains('is-disabled'), false);
  assert.equal(button.click().prevented, false);
});

test('macOS visitors receive the Apple Silicon disk image', async () => {
  const { configurePlatformDownload } = await loadModule();
  const button = fakeButton();
  configurePlatformDownload(button, { platform: 'MacIntel' });

  assert.equal(button.getAttribute('href'), macosDownloadUrl);
  assert.equal(button.getAttribute('download'), 'MindMotion_0.2.0_aarch64.dmg');
  assert.equal(button.getAttribute('aria-label'), '下载 MindMotion 0.2.0 macOS 桌面客户端（Apple 芯片）');
  assert.equal(button.getAttribute('title'), '下载 MindMotion 0.2.0 macOS 桌面客户端（Apple 芯片）');
  assert.equal(button.getAttribute('aria-disabled'), null);
  assert.equal(button.label.textContent, '下载桌面客户端 · macOS（Apple 芯片）· v0.2.0');
  assert.equal(button.icon.textContent, '↓');
  assert.equal(button.classList.contains('is-disabled'), false);
  assert.equal(button.click().prevented, false);
});

test('macOS to Windows reconfiguration removes the disk image download attribute', async () => {
  const { configurePlatformDownload } = await loadModule();
  const button = fakeButton();
  configurePlatformDownload(button, { platform: 'MacIntel' });
  assert.match(button.getAttribute('download'), /\.dmg$/);

  configurePlatformDownload(button, { platform: 'Win32' });
  assert.equal(button.getAttribute('href'), windowsDownloadUrl);
  assert.equal(button.getAttribute('download'), null);
  assert.equal(button.label.textContent, '下载桌面客户端 · Windows');
  assert.equal(button.getAttribute('aria-label'), '下载 MindMotion Windows 桌面客户端（Microsoft Store）');
  assert.equal(button.getAttribute('title'), '下载 MindMotion Windows 桌面客户端（Microsoft Store）');
  assert.equal(button.click().prevented, false);
});

for (const [platform, url, filename] of [
  ['Win32', windowsDownloadUrl, null],
  ['MacIntel', macosDownloadUrl, 'MindMotion_0.2.0_aarch64.dmg'],
]) {
  test(`${platform} uses the current download target when data attributes are absent`, async () => {
    const { configurePlatformDownload } = await loadModule();
    const button = fakeButton();
    button.dataset = {};
    configurePlatformDownload(button, { platform });
    assert.equal(button.getAttribute('href'), url);
    assert.equal(button.getAttribute('download'), filename);
  });
}

for (const [name, navigatorLike] of [
  ['Android', { userAgentData: { platform: 'Android', mobile: true } }],
  ['iPhone', { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile' }],
  ['iPad desktop mode', { platform: 'MacIntel', maxTouchPoints: 5 }],
  ['Linux', { platform: 'Linux x86_64' }],
  ['unknown', {}],
  ['conflicting desktop signals', { platform: 'MacIntel', userAgentData: { platform: 'Windows' } }],
]) {
  test(`${name} receives clickable desktop guidance, not an installer or Store launch`, async () => {
    const { configurePlatformDownload } = await loadModule();
    const button = fakeButton();
    button.setAttribute('aria-disabled', 'true');
    button.setAttribute('tabindex', '-1');
    assert.equal(configurePlatformDownload(button, navigatorLike), 'other');

    assert.equal(button.getAttribute('href'), '#desktop-download');
    assert.equal(button.getAttribute('download'), null);
    assert.equal(button.getAttribute('aria-disabled'), null);
    assert.equal(button.getAttribute('tabindex'), null);
    assert.equal(button.classList.contains('is-disabled'), false);
    assert.equal(button.label.textContent, '下载桌面客户端');
    assert.equal(button.getAttribute('aria-label'), '下载 MindMotion 桌面客户端');
    assert.equal(button.getAttribute('title'), '下载 MindMotion 桌面客户端');
    assert.equal(button.icon.textContent, '↓');
    assert.equal(button.click().prevented, false);
  });
}

test('reconfiguration safely switches between Windows, macOS, guidance, and Windows again', async () => {
  const { configurePlatformDownload } = await loadModule();
  const button = fakeButton();

  configurePlatformDownload(button, { platform: 'Win32' });
  assert.equal(button.getAttribute('href'), windowsDownloadUrl);

  configurePlatformDownload(button, { platform: 'MacIntel' });
  assert.equal(button.getAttribute('href'), macosDownloadUrl);
  assert.equal(button.getAttribute('download'), 'MindMotion_0.2.0_aarch64.dmg');
  assert.equal(button.getAttribute('aria-disabled'), null);
  assert.equal(button.click().prevented, false);

  configurePlatformDownload(button, { platform: 'Linux x86_64' });
  assert.equal(button.getAttribute('href'), '#desktop-download');
  assert.equal(button.getAttribute('download'), null);
  assert.equal(button.getAttribute('aria-disabled'), null);
  assert.equal(button.click().prevented, false);

  configurePlatformDownload(button, { platform: 'Win32' });
  assert.equal(button.getAttribute('href'), windowsDownloadUrl);
  assert.equal(button.getAttribute('download'), null);
  assert.equal(button.getAttribute('aria-disabled'), null);
  assert.equal(button.click().prevented, false);
});

test('static CTA and shared guidance work without JavaScript and offer desktop-only fallback links', async () => {
  const html = await readFile(resolve(root, 'index.html'), 'utf8');
  const hero = html.match(/<a\s[^>]*data-platform-download[\s\S]*?<\/a>/)?.[0];
  assert.ok(hero);
  assert.match(hero, /\shref="#desktop-download"/);
  assert.match(hero, /data-download-label>下载桌面客户端</);
  assert.doesNotMatch(hero, /is-disabled|aria-disabled|tabindex|\sdownload=/);

  const guidance = html.match(/<section[^>]*id="desktop-download"[\s\S]*?<\/section>/)?.[0];
  assert.ok(guidance);
  assert.match(guidance, /class="cta section container"/);
  assert.doesNotMatch(guidance.match(/^<section[^>]*>/)[0], /\shidden|aria-hidden|display:\s*none/);
  assert.match(guidance, /请在 Windows 或 Mac 电脑上访问本网站，下载 MindMotion 桌面客户端。/);
  assert.match(guidance, /Visit this website on a Windows or Mac computer to download the MindMotion desktop client\./);
  assert.match(guidance, />https:\/\/kaiwu-ai\.github\.io\/<\/a>/);
  assert.ok(guidance.includes(`href="${windowsFallbackUrl}"`));
  assert.ok(guidance.includes(`href="${macosDownloadUrl}"`));
  assert.match(guidance, /Windows 电脑版/);
  assert.match(guidance, /Windows desktop/);
  assert.match(guidance, /Mac 电脑版（Apple 芯片）/);
  assert.match(guidance, /Mac desktop \(Apple Silicon\)/);
  assert.doesNotMatch(guidance, /ms-windows-store:/);
  assert.doesNotMatch(html, /不支持|unsupported/i);
});

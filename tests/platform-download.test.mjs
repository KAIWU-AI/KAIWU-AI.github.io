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
  'https://github.com/KAIWU-AI/KAIWU-AI.github.io/releases/download/desktop-v0.2.1/MindMotion_0.2.1_aarch64.dmg';
const androidDownloadUrl =
  'https://github.com/KAIWU-AI/KAIWU-AI.github.io/releases/download/desktop-v0.2.1/MeMo_0.2.2_101.apk';

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
    dataset: { windowsDownloadUrl, macosDownloadUrl, androidDownloadUrl },
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

test('hero primary action has matching public macOS, Android and Microsoft Store targets', async () => {
  const html = await readFile(resolve(root, 'index.html'), 'utf8');
  assert.match(html, /<script type="module" src="platform-download\.js"><\/script>/);
  assert.match(html, /data-platform-download/);
  assert.match(html, new RegExp(`data-windows-download-url="${windowsDownloadUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`));
  assert.match(html, new RegExp(`data-macos-download-url="${macosDownloadUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`));
  assert.match(html, new RegExp(`data-android-download-url="${androidDownloadUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`));
  assert.doesNotMatch(
    html.match(/<div class="hero-actions">[\s\S]*?<\/div>/)?.[0] || '',
    /在 GitHub 上关注/,
  );
});

test('platform detection distinguishes Windows, macOS and Android', async () => {
  const { detectDownloadPlatform } = await loadModule();
  assert.equal(detectDownloadPlatform({ userAgentData: { platform: 'Windows' } }), 'windows');
  assert.equal(detectDownloadPlatform({ platform: 'Win32' }), 'windows');
  assert.equal(detectDownloadPlatform({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }), 'windows');
  assert.equal(detectDownloadPlatform({ userAgentData: { platform: 'macOS' } }), 'macos');
  assert.equal(detectDownloadPlatform({ platform: 'MacIntel' }), 'macos');
  assert.equal(detectDownloadPlatform({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' }), 'macos');
  assert.equal(detectDownloadPlatform({ platform: 'Linux x86_64' }), 'other');
  assert.equal(detectDownloadPlatform({ userAgentData: { platform: 'Android', mobile: true } }), 'android');
  assert.equal(detectDownloadPlatform({ platform: 'Linux armv8l', userAgent: 'Mozilla/5.0 (Linux; Android 16; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36' }), 'android');
  assert.equal(detectDownloadPlatform({ userAgent: 'Mozilla/5.0 (Android 16; Mobile; rv:142.0) Gecko/142.0 Firefox/142.0' }), 'android');
  assert.equal(detectDownloadPlatform({ userAgentData: { platform: 'Android', mobile: false }, platform: 'Linux aarch64' }), 'android');
});

test('platform detection fails closed for conflicts and mobile devices', async () => {
  const { detectDownloadPlatform } = await loadModule();
  assert.equal(
    detectDownloadPlatform({
      userAgentData: { platform: 'macOS' },
      platform: 'MacIntel',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    }),
    'other',
  );
  assert.equal(
    detectDownloadPlatform({
      userAgentData: { platform: 'Linux' },
      platform: 'Linux x86_64',
      userAgent: 'Mozilla/5.0 (Windows Phone 10.0; Android 6.0.1)',
    }),
    'other',
  );
  assert.equal(
    detectDownloadPlatform({ userAgent: 'Mozilla/5.0 (Windows Phone 10.0; Android 6.0.1; Microsoft)' }),
    'other',
  );
  for (const navigatorLike of [
    { userAgentData: { platform: 'Android' }, platform: 'Win32' },
    { userAgentData: { platform: 'Android' }, platform: 'MacIntel' },
    { userAgentData: { platform: 'Windows' }, userAgent: 'Mozilla/5.0 (Linux; Android 16)' },
    { userAgentData: { platform: 'Android' }, userAgent: 'Mozilla/5.0 (Windows Phone 10.0; Android 6.0.1)' },
    { userAgentData: { platform: 'Android' }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)' },
    { userAgentData: { platform: 'Android' }, userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
    { userAgentData: { platform: 'Android' }, platform: 'CrOS' },
  ]) {
    assert.equal(detectDownloadPlatform(navigatorLike), 'other');
  }
  assert.equal(
    detectDownloadPlatform({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile' }),
    'other',
  );
  assert.equal(
    detectDownloadPlatform({ platform: 'MacIntel', maxTouchPoints: 5, userAgent: 'Mozilla/5.0 (iPad)' }),
    'other',
  );
  assert.equal(detectDownloadPlatform({ platform: 'Windows Phone' }), 'other');
  assert.equal(detectDownloadPlatform({ userAgentData: { platform: 'Windows Phone' } }), 'other');
  assert.equal(detectDownloadPlatform({ userAgentData: { platform: 'Windows', mobile: true } }), 'other');
  assert.equal(detectDownloadPlatform({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Macintosh; Intel Mac OS X)' }), 'other');
  assert.equal(detectDownloadPlatform({ platform: 'Win32 MacIntel' }), 'other');
  assert.equal(detectDownloadPlatform({ userAgentData: { platform: 'Windows Linux' } }), 'other');
  assert.equal(detectDownloadPlatform({ platform: 'FreeBSD amd64', userAgent: 'Windows NT 10.0' }), 'other');
  assert.equal(detectDownloadPlatform({ platform: 'OpenBSD', userAgent: 'Windows NT 10.0' }), 'other');
  assert.equal(detectDownloadPlatform({ userAgentData: { platform: 'macOS' }, platform: 'SunOS' }), 'other');
  assert.equal(detectDownloadPlatform({ platform: 'Win32', userAgent: 'Mozilla/5.0 (BB10; Touch)' }), 'other');
  assert.equal(detectDownloadPlatform({ platform: 'mystery-os', userAgent: 'Windows NT 10.0' }), 'other');
  for (const marker of ['iOS', 'ChromeOS', 'BSD']) {
    assert.equal(detectDownloadPlatform({ userAgentData: { platform: `Windows ${marker}` } }), 'other');
    assert.equal(detectDownloadPlatform({ platform: `Windows ${marker}` }), 'other');
    assert.equal(detectDownloadPlatform({ userAgent: `Windows ${marker}` }), 'other');
  }
  for (const marker of ['iOS', 'ChromeOS', 'BSD', 'Android 14; Mobile']) {
    assert.equal(
      detectDownloadPlatform({ userAgent: `Mozilla/5.0 (Windows NT 10.0; ${marker})` }),
      'other',
    );
  }
  for (const marker of ['iOS', 'ChromeOS', 'BSD']) {
    assert.equal(
      detectDownloadPlatform({ userAgent: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7; ${marker})` }),
      'other',
    );
  }
  assert.equal(
    detectDownloadPlatform({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:142.0) Gecko/20100101 Firefox/142.0',
    }),
    'windows',
  );
  assert.equal(
    detectDownloadPlatform({
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
    assert.equal(detectDownloadPlatform({ userAgent }), 'other');
  }
  for (const userAgent of [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
  ]) {
    assert.notEqual(detectDownloadPlatform({ userAgent }), 'other');
  }
  assert.equal(detectDownloadPlatform({}), 'other');
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
  assert.equal(button.getAttribute('download'), 'MindMotion_0.2.1_aarch64.dmg');
  assert.equal(button.getAttribute('aria-label'), '下载 MindMotion 0.2.1 macOS 桌面客户端（Apple 芯片）');
  assert.equal(button.getAttribute('title'), '下载 MindMotion 0.2.1 macOS 桌面客户端（Apple 芯片）');
  assert.equal(button.getAttribute('aria-disabled'), null);
  assert.equal(button.label.textContent, '下载桌面客户端 · macOS（Apple 芯片）· v0.2.1');
  assert.equal(button.icon.textContent, '↓');
  assert.equal(button.classList.contains('is-disabled'), false);
  assert.equal(button.click().prevented, false);
});

test('Android visitors receive the dedicated-key APK with accessible version labels', async () => {
  const { configurePlatformDownload } = await loadModule();
  const button = fakeButton();
  assert.equal(configurePlatformDownload(button, { userAgentData: { platform: 'Android', mobile: true } }), 'android');

  assert.equal(button.getAttribute('href'), androidDownloadUrl);
  assert.equal(button.getAttribute('download'), 'MeMo_0.2.2_101.apk');
  assert.equal(button.getAttribute('aria-label'), '下载 MeMo 0.2.2 Android 客户端');
  assert.equal(button.getAttribute('title'), '下载 MeMo 0.2.2 Android 客户端（Android 12 及以上）');
  assert.equal(button.label.textContent, '下载 MeMo · Android · v0.2.2');
  assert.equal(button.getAttribute('aria-disabled'), null);
  assert.equal(button.classList.contains('is-disabled'), false);
  assert.equal(button.click().prevented, false);
});

test('Android default target matches the HTML and switching to Windows clears the APK attribute', async () => {
  const { configurePlatformDownload, ANDROID_DOWNLOAD_URL, MACOS_DOWNLOAD_URL } = await loadModule();
  assert.equal(ANDROID_DOWNLOAD_URL, androidDownloadUrl);
  assert.equal(MACOS_DOWNLOAD_URL, macosDownloadUrl);
  const button = fakeButton();
  button.dataset = {};
  configurePlatformDownload(button, { userAgentData: { platform: 'Android' } });
  assert.equal(button.getAttribute('href'), androidDownloadUrl);
  assert.equal(button.getAttribute('download'), 'MeMo_0.2.2_101.apk');
  configurePlatformDownload(button, { platform: 'Win32' });
  assert.equal(button.getAttribute('href'), windowsDownloadUrl);
  assert.equal(button.getAttribute('download'), null);
  assert.equal(button.label.textContent, '下载桌面客户端 · Windows');
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
  ['MacIntel', macosDownloadUrl, 'MindMotion_0.2.1_aarch64.dmg'],
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
    assert.equal(button.label.textContent, '下载客户端');
    assert.equal(button.getAttribute('aria-label'), '下载 MindMotion / MeMo 客户端');
    assert.equal(button.getAttribute('title'), '下载 MindMotion / MeMo 客户端');
    assert.equal(button.icon.textContent, '↓');
    assert.equal(button.click().prevented, false);
  });
}

test('reconfiguration safely switches between Windows, macOS, Android, guidance, and Windows again', async () => {
  const { configurePlatformDownload } = await loadModule();
  const button = fakeButton();

  configurePlatformDownload(button, { platform: 'Win32' });
  assert.equal(button.getAttribute('href'), windowsDownloadUrl);

  configurePlatformDownload(button, { platform: 'MacIntel' });
  assert.equal(button.getAttribute('href'), macosDownloadUrl);
  assert.equal(button.getAttribute('download'), 'MindMotion_0.2.1_aarch64.dmg');
  assert.equal(button.getAttribute('aria-disabled'), null);
  assert.equal(button.click().prevented, false);

  configurePlatformDownload(button, { userAgentData: { platform: 'Android', mobile: true } });
  assert.equal(button.getAttribute('href'), androidDownloadUrl);
  assert.equal(button.getAttribute('download'), 'MeMo_0.2.2_101.apk');
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

test('static CTA and shared guidance work without JavaScript and offer all three platform links', async () => {
  const html = await readFile(resolve(root, 'index.html'), 'utf8');
  const hero = html.match(/<a\s[^>]*data-platform-download[\s\S]*?<\/a>/)?.[0];
  assert.ok(hero);
  assert.match(hero, /\shref="#desktop-download"/);
  assert.match(hero, /data-download-label>下载客户端</);
  assert.doesNotMatch(hero, /is-disabled|aria-disabled|tabindex|\sdownload=/);

  const guidance = html.match(/<section[^>]*id="desktop-download"[\s\S]*?<\/section>/)?.[0];
  assert.ok(guidance);
  assert.match(guidance, /class="cta section container"/);
  assert.doesNotMatch(guidance.match(/^<section[^>]*>/)[0], /\shidden|aria-hidden|display:\s*none/);
  assert.match(guidance, /Windows 推荐通过 Microsoft Store 安装；Mac 支持 Apple 芯片；MeMo 支持 Android 12 及以上。/);
  assert.match(guidance, /Use Microsoft Store on Windows, the Apple Silicon DMG on Mac, or MeMo on Android 12 and later\./);
  assert.match(guidance, />https:\/\/kaiwu-ai\.github\.io\/<\/a>/);
  assert.ok(guidance.includes(`href="${windowsFallbackUrl}"`));
  assert.ok(guidance.includes(`href="${macosDownloadUrl}"`));
  assert.ok(guidance.includes(`href="${androidDownloadUrl}"`));
  assert.match(guidance, /Windows 电脑版/);
  assert.match(guidance, /Windows desktop/);
  assert.match(guidance, /Mac 电脑版（Apple 芯片）/);
  assert.match(guidance, /Mac desktop \(Apple Silicon\)/);
  assert.match(guidance, /MeMo for Android 12\+/);
  assert.doesNotMatch(guidance, /ms-windows-store:/);
  assert.doesNotMatch(html, /不支持|unsupported/i);
});

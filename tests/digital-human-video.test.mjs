import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

async function text(path) {
  return readFile(resolve(root, path), 'utf8');
}

async function runVideoRuntime({ reduced = false, hasObserver = true, rejectPlay = false } = {}) {
  const script = await text('script.js');
  const calls = { play: 0, pause: 0 };
  const classes = new Set();
  const section = {
    classList: {
      add: (name) => classes.add(name),
      remove: (name) => classes.delete(name),
    },
  };
  const video = {
    dataset: { startAt: '14.1' },
    duration: 58.6,
    readyState: 1,
    currentTime: 0,
    muted: false,
    defaultMuted: false,
    closest: () => section,
    addEventListener: () => {},
    pause: () => {
      calls.pause += 1;
    },
    play: () => {
      calls.play += 1;
      return rejectPlay ? Promise.reject(new Error('autoplay blocked')) : Promise.resolve();
    },
  };
  const observers = [];
  class FakeIntersectionObserver {
    constructor(callback, options) {
      this.callback = callback;
      this.options = options;
      observers.push(this);
    }
    observe(target) {
      this.target = target;
    }
    unobserve() {}
  }
  const reducedMotion = { matches: reduced };
  const window = {
    matchMedia: () => reducedMotion,
  };
  if (hasObserver) {
    window.IntersectionObserver = FakeIntersectionObserver;
  }
  const context = {
    window,
    document: {
      documentElement: { classList: { add: () => {} } },
      querySelector: () => null,
      querySelectorAll: (selector) => (selector === '[data-scroll-video]' ? [video] : []),
      addEventListener: () => {},
    },
    HTMLMediaElement: { HAVE_METADATA: 1 },
    IntersectionObserver: hasObserver ? FakeIntersectionObserver : undefined,
    Number,
  };

  runInNewContext(script, context);
  await Promise.resolve();
  return { calls, classes, observers, section };
}

test('the complete core-capabilities section has a masked decorative background video', async () => {
  const [html, styles] = await Promise.all([text('index.html'), text('styles.css')]);

  const section = html.match(
    /<section class="directions section container directions-video-section" id="directions" data-scroll-video-section[\s\S]*?<\/section>/,
  )?.[0];

  assert.ok(section, 'the entire directions section must opt in to the video background behavior');
  assert.equal((section.match(/class="direction-card"/g) || []).length, 3);
  assert.match(section, /class="direction-video-shell" aria-hidden="true"/);
  assert.match(section, /<video[^>]*data-scroll-video[^>]*>/);
  assert.match(section, /src="assets\/videos\/zhang-industrial-engineering-bg\.mp4"/);
  assert.match(section, /poster="assets\/videos\/zhang-industrial-engineering-poster\.jpg"/);
  assert.match(section, /\bmuted\b/);
  assert.match(section, /\bplaysinline\b/);
  assert.match(section, /preload="metadata"/);
  assert.doesNotMatch(section, /\bcontrols\b/);
  assert.match(section, /class="direction-video-mask"/);
  assert.doesNotMatch(html, /direction-card-video|data-scroll-video-card/);

  assert.match(styles, /\.directions-video-section\s*\{[^}]*isolation:\s*isolate/s);
  assert.match(styles, /\.direction-video-shell\s*\{[^}]*opacity:\s*0/s);
  assert.match(styles, /\.directions-video-section\.is-video-active\s+\.direction-video-shell\s*\{[^}]*opacity:/s);
  assert.match(styles, /\.direction-video\s*\{[^}]*width:\s*100%[^}]*height:\s*100%[^}]*object-fit:\s*contain/s);
  assert.match(styles, /\.direction-video\s*\{[^}]*object-position:\s*center/s);
  assert.doesNotMatch(styles, /\.direction-video\s*\{[^}]*object-fit:\s*cover/s);
  assert.doesNotMatch(styles, /\.direction-video\s*\{[^}]*\btransform\s*:/s);
  assert.match(styles, /\.direction-video-shell\s*\{[^}]*background:\s*transparent/s);
  assert.match(styles, /\.direction-video-mask\s*\{[^}]*background:/s);
});

test('the background video pauses offscreen and for reduced-motion users', async () => {
  const script = await text('script.js');

  assert.match(script, /\[data-scroll-video\]/);
  assert.match(script, /IntersectionObserver/);
  assert.match(script, /video\.play\(\)/);
  assert.match(script, /video\.pause\(\)/);
  assert.match(script, /reducedMotion\.matches/);
  assert.match(script, /\[data-scroll-video-section\]/);
  assert.match(script, /is-video-active/);
});

test('the runtime only plays in view and pauses again offscreen', async () => {
  const runtime = await runVideoRuntime();
  const videoObserver = runtime.observers.find((observer) => observer.options?.threshold === 0.35);

  assert.ok(videoObserver, 'video observer must be installed');
  assert.equal(runtime.calls.play, 0, 'video must not play during initialization');

  videoObserver.callback([{ isIntersecting: true }]);
  await Promise.resolve();
  assert.equal(runtime.calls.play, 1);
  assert.ok(runtime.classes.has('is-video-active'));

  videoObserver.callback([{ isIntersecting: false }]);
  assert.equal(runtime.calls.pause, 1);
  assert.ok(!runtime.classes.has('is-video-active'));
});

test('observer absence and reduced motion both keep a paused visual', async () => {
  for (const options of [{ hasObserver: false }, { reduced: true }]) {
    const runtime = await runVideoRuntime(options);
    assert.equal(runtime.calls.play, 0);
    assert.equal(runtime.calls.pause, 1);
    assert.ok(runtime.classes.has('is-video-active'));
  }
});

test('a rejected muted autoplay attempt is handled without an unhandled rejection', async () => {
  const runtime = await runVideoRuntime({ rejectPlay: true });
  const videoObserver = runtime.observers.find((observer) => observer.options?.threshold === 0.35);

  videoObserver.callback([{ isIntersecting: true }]);
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(runtime.calls.play, 1);
  assert.ok(runtime.classes.has('is-video-active'));
});

test('the optimized video and poster assets are present', async () => {
  const [video, poster] = await Promise.all([
    stat(resolve(root, 'assets/videos/zhang-industrial-engineering-bg.mp4')),
    stat(resolve(root, 'assets/videos/zhang-industrial-engineering-poster.jpg')),
  ]);

  assert.ok(video.size > 100_000, 'background video must not be an empty placeholder');
  assert.ok(poster.size > 10_000, 'poster must not be an empty placeholder');
});

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
  const card = {
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
    closest: () => card,
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
  return { calls, classes, observers, card };
}

test('the digital-human capability has a masked decorative background video', async () => {
  const [html, styles] = await Promise.all([text('index.html'), text('styles.css')]);

  const card = html.match(
    /<article class="direction-card direction-card-video" data-scroll-video-card>[\s\S]*?<\/article>/,
  )?.[0];

  assert.ok(card, 'digital-human card must opt in to the video background behavior');
  assert.match(card, /02 \/ DIGITAL HUMAN/);
  assert.match(card, /class="direction-video-shell" aria-hidden="true"/);
  assert.match(card, /<video[^>]*data-scroll-video[^>]*>/);
  assert.match(card, /src="assets\/videos\/zhang-industrial-engineering-bg\.mp4"/);
  assert.match(card, /poster="assets\/videos\/zhang-industrial-engineering-poster\.jpg"/);
  assert.match(card, /\bmuted\b/);
  assert.match(card, /\bplaysinline\b/);
  assert.match(card, /preload="metadata"/);
  assert.doesNotMatch(card, /\bcontrols\b/);
  assert.match(card, /class="direction-video-mask"/);

  assert.match(styles, /\.direction-card-video\s*\{[^}]*isolation:\s*isolate/s);
  assert.match(styles, /\.direction-video-shell\s*\{[^}]*opacity:\s*0/s);
  assert.match(styles, /\.direction-card-video\.is-video-active\s+\.direction-video-shell\s*\{[^}]*opacity:/s);
  assert.match(styles, /\.direction-video\s*\{[^}]*object-fit:\s*cover/s);
  assert.match(styles, /\.direction-video-mask\s*\{[^}]*background:/s);
});

test('the background video pauses offscreen and for reduced-motion users', async () => {
  const script = await text('script.js');

  assert.match(script, /\[data-scroll-video\]/);
  assert.match(script, /IntersectionObserver/);
  assert.match(script, /video\.play\(\)/);
  assert.match(script, /video\.pause\(\)/);
  assert.match(script, /reducedMotion\.matches/);
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

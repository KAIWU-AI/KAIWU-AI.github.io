import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import vm from 'node:vm';

const runtimeUrl = new URL('../vendor/archify-browser/d8e4daf-v1/archify-browser.js', import.meta.url);
const bundle = await readFile(runtimeUrl, 'utf8');
const manifest = JSON.parse(await readFile(new URL('manifest.json', runtimeUrl), 'utf8'));
const context = vm.createContext({ TextEncoder }, { codeGeneration: { strings: false, wasm: false } });
vm.runInContext(bundle, context);
const fixture = () => ({
  schema_version: 1,
  diagram_type: 'architecture',
  meta: { title: 'Synthetic request path', animation: 'trace', quality_profile: 'standard' },
  components: [
    { id: 'client', type: 'frontend', label: 'Client', pos: [50, 100], size: [120, 60] },
    { id: 'service', type: 'backend', label: 'Service', pos: [350, 100], size: [120, 60] },
  ],
  connections: [{ id: 'request', from: 'client', to: 'service', label: 'Request' }],
});
function render(spec = fixture(), options = { theme: 'light', id: 'synthetic-example' }) {
  context.inputJson = JSON.stringify(spec);
  context.optionsJson = JSON.stringify(options);
  return vm.runInContext('KaiwuArchify.renderArchitecture(JSON.parse(inputJson), JSON.parse(optionsJson))', context);
}
function scripts(html) {
  return [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)]
    .filter((match) => !match[1].includes('application/json')).map((match) => match[2]);
}
const rendered = await render();

test('Archify renders synthetic JSON in a browser-only realm with dynamic code disabled', async () => {
  const result = render();
  assert.equal(typeof result.then, 'function');
  const html = await result;
  assert.match(html, /^<!DOCTYPE html>/);
  assert.match(html, /<svg viewBox=/);
  assert.match(html, /data-node-id="client"/);
  assert.match(html, /data-edge-id="request"/);
  assert.match(html, /data-initial-theme="light"/);
  assert.match(html, /data-initial-motion="still"/);
  assert.match(html, /data-theme="light"/);
  assert.doesNotMatch(html, /ARCHIFY:SVG_SLOT|ARCHIFY:GUIDED_VIEWS_DATA|\[PROJECT NAME\]/);
});

test('Archify preserves upstream MIT provenance, pinned source hashes, SHA-256 and SRI', async () => {
  const bytes = await readFile(runtimeUrl);
  const hash = createHash('sha256').update(bytes);
  const digest = hash.digest();
  assert.equal(manifest.files['archify-browser.js'].sha256, digest.toString('hex'));
  const sha384 = createHash('sha384').update(bytes).digest();
  assert.equal(manifest.files['archify-browser.js'].sha384, sha384.toString('hex'));
  assert.equal(manifest.files['archify-browser.js'].integrity, `sha384-${sha384.toString('base64')}`);
  assert.equal(manifest.files['archify-browser.js'].bytes, bytes.length);
  assert.equal(manifest.upstream.revision, 'd8e4daf2610d512821365f41b139d874b29efe81');
  assert.equal(manifest.upstream.repository, 'https://github.com/tt-a1i/archify');
  const license = await readFile(new URL('LICENSE', runtimeUrl), 'utf8');
  assert.match(license, /MIT License/);
  assert.match(license, /2026 tt-a1i \(Archify\)/);
  assert.equal(createHash('sha256').update(license).digest('hex'), manifest.files.LICENSE.sha256);
  const lock = JSON.parse(await readFile(new URL('../tools/archify-browser/upstream-lock.json', import.meta.url), 'utf8'));
  assert.deepEqual(manifest.upstream.files, lock.files);
  assert.equal(manifest.build.esbuild, '0.25.12');
  assert.doesNotMatch(bundle, /sourceMappingURL=|[a-z]:[\\/]+Users[\\/]|file:\/\/\/[a-z]:|\/(?:home|Users)\/[^/]+\//i);
  const attributes = await readFile(new URL('../vendor/archify-browser/.gitattributes', import.meta.url), 'utf8');
  assert.match(attributes, /^d8e4daf-v1\/\* -text$/m);
  for (const [name, expected] of Object.entries(manifest.adapterSources)) {
    const source = (await readFile(new URL(`../tools/archify-browser/${name}`, import.meta.url), 'utf8')).replace(/\r\n/g, '\n');
    assert.equal(createHash('sha256').update(source).digest('hex'), expected, `Rebuild after changing ${name}`);
  }
});

test('repeated and concurrent renders preserve invocation isolation and never mutate caller JSON', async () => {
  const first = fixture();
  const unchanged = JSON.stringify(first);
  const second = fixture();
  second.meta.title = 'Other synthetic title';
  second.components[0].id = 'alternate';
  second.connections[0].from = 'alternate';
  const [a, b, c] = await Promise.all([
    render(first), render(second, { theme: 'dark', id: 'other-example' }), render(first),
  ]);
  assert.equal(a, c);
  assert.match(b, /data-node-id="alternate"/);
  assert.doesNotMatch(a, /Other synthetic title|data-node-id="alternate"/);
  assert.match(b, /data-initial-theme="dark"/);
  assert.match(b, /data-theme="dark"/);
  assert.equal(JSON.stringify(first), unchanged);
});

test('schema, relationship and guided-view validation retain actionable diagnostics in order', async () => {
  const schema = fixture();
  schema.components[0].type = 'invalid-kind';
  await assert.rejects(render(schema), (error) => {
    const item = error.archifyDiagnostics.find((entry) => entry.code === 'schema/enum');
    assert.ok(item);
    assert.equal(item.subject.path, '/components/0/type');
    assert.ok(item.supportedFixes.length);
    assert.ok(item.evidence.allowedValues.includes('frontend'));
    return true;
  });
  const views = fixture();
  views.meta.views = [{ id: 'overview', label: 'Overview', focus: ['absent'] }];
  views.connections.push({ ...views.connections[0] });
  await assert.rejects(render(views), (error) => error.archifyDiagnostics.some((item) => item.code === 'guided-view/invalid'));
  delete views.meta.views;
  await assert.rejects(render(views), (error) => error.archifyDiagnostics.some((item) => item.code === 'relationship/duplicate-id'));
  const profile = fixture();
  profile.meta.engineering_profile = 'deployment-ownership';
  await assert.rejects(render(profile), (error) => error.archifyDiagnostics.some((item) => item.code.startsWith('engineering/') && Object.keys(item.evidence).length));
});

test('invalid layout is rejected without contaminating later layout diagnostics or successful rendering', async () => {
  const overlap = fixture();
  overlap.components[1].pos = [80, 100];
  await assert.rejects(render(overlap), (error) => {
    assert.match(error.message, /less than 8px apart/);
    assert.ok(error.archifyDiagnostics.length);
    assert.ok(error.archifyDiagnostics.every((item) => item.code && item.subject && item.evidence && item.supportedFixes));
    return true;
  });

  const bad = fixture();
  bad.components[0].type = 'bad';
  await assert.rejects(render(bad), (error) => {
    assert.ok(error.archifyDiagnostics.every((item) => item.code.startsWith('schema/')));
    return true;
  });
  assert.equal(await render(), rendered);
});

test('authored showcase crossing failures keep native relationship identities, coordinates and fixes', async () => {
  const spec = fixture();
  spec.meta.quality_profile = 'showcase';
  spec.components = [
    { id: 'west', type: 'frontend', label: 'West', pos: [50, 270], size: [120, 60] },
    { id: 'east', type: 'backend', label: 'East', pos: [530, 270], size: [120, 60] },
    { id: 'north', type: 'frontend', label: 'North', pos: [290, 50], size: [120, 60] },
    { id: 'south', type: 'backend', label: 'South', pos: [290, 490], size: [120, 60] },
  ];
  spec.connections = [
    { id: 'horizontal', from: 'west', to: 'east' },
    { id: 'vertical', from: 'north', to: 'south', fromSide: 'bottom', toSide: 'top' },
  ];
  await assert.rejects(render(spec), (error) => {
    const item = error.archifyDiagnostics.find((entry) => entry.code === 'composition/proper-crossing');
    assert.ok(item);
    assert.equal(item.subject.id, 'horizontal');
    assert.equal(item.evidence.otherRelationship.id, 'vertical');
    assert.deepEqual(Array.from(item.evidence.point), [350, 300]);
    assert.ok(item.supportedFixes[0].includes('separate corridors'));
    assert.equal(error.archifyDiagnostics.filter((entry) => entry.message === item.message).length, 1);
    return true;
  });
  assert.equal(await render(), rendered);
});

test('synthetic SVG matches the unmodified public upstream CLI at the pinned revision', () => {
  const svg = rendered.match(/<svg viewBox="0 0 [^"]+" role="img"[\s\S]*?<\/svg>/)[0];
  assert.equal(createHash('sha256').update(svg).digest('hex'), 'f6806a7a5f53834d8960448681bfd7e29bd0e47e5d95b0ffa7d25de186370bcf');
});

test('public demo uses synthetic inline JSON and documentation pins the matching SRI', async () => {
  const demo = await readFile(new URL('../vendor/archify-browser/demo.html', import.meta.url), 'utf8');
  const docs = await readFile(new URL('../docs/archify-browser.html', import.meta.url), 'utf8');
  assert.ok(demo.includes(`integrity="${manifest.files['archify-browser.js'].integrity}"`));
  assert.ok(docs.includes(`integrity="${manifest.files['archify-browser.js'].integrity}"`));
  assert.match(demo, /sandbox="allow-scripts allow-downloads"/);
  assert.doesNotMatch(demo, /\bfetch\s*\(/);
  const spec = JSON.parse(demo.match(/<script type="application\/json" id="architecture-data">([\s\S]*?)<\/script>/)[1]);
  assert.deepEqual(spec.components.map((component) => component.id), ['client', 'service']);
  assert.match(await render(spec), /data-node-id="client"/);
});

test('filesystem, repository evidence, brand URLs and caller templates are unsupported', async () => {
  for (const field of ['output', 'repository']) {
    const spec = fixture();
    spec.meta[field] = field === 'output' ? 'local.html' : { url: 'https://example.invalid', revision: 'a'.repeat(40) };
    await assert.rejects(render(spec), (error) => error.archifyDiagnostics[0].code === 'browser/unsupported');
  }
  for (const field of ['brand', 'sources']) {
    const spec = fixture();
    spec.components[0][field] = null;
    await assert.rejects(render(spec), (error) => error.archifyDiagnostics[0].code === 'browser/unsupported');
  }
  await assert.rejects(render(fixture(), { theme: 'light', id: 'demo', template: '<script>bad</script>' }));
  for (const id of ['', 'Upper', 'bad_id', 'bad--id', 'bad-', 'a'.repeat(65), 'a"><script>']) {
    await assert.rejects(render(fixture(), { theme: 'light', id }));
  }
  for (const theme of ['auto', null, 'LIGHT', '"><script>']) {
    await assert.rejects(render(fixture(), { theme, id: 'demo' }));
  }
});

test('HTML text and inline JSON cannot terminate a script or inject markup', async () => {
  const attack = '</script><script>globalThis.pwned=1</script><img src="https://example.invalid">&$&';
  const spec = fixture();
  spec.meta.title = attack;
  spec.meta.subtitle = attack;
  spec.cards = [{ dot: 'cyan', title: attack, items: [attack] }];
  spec.meta.views = [{ id: 'overview', label: 'Overview', focus: ['client'], note: attack }];
  const html = await render(spec);
  assert.equal(scripts(html).length, 4);
  assert.equal(scripts(html).join('\n'), scripts(rendered).join('\n'));
  assert.doesNotMatch(html, /<script>globalThis\.pwned|<img src="https/);
  assert.match(html, /&lt;\/script&gt;/);
  const data = html.match(/<script id="archify-guided-views-data" type="application\/json">([\s\S]*?)<\/script>/)[1];
  assert.doesNotMatch(data, /[<>&]/);
  assert.equal(JSON.parse(data)[0].note, attack);
});

test('bounded input rejects excess nodes, relationships, bytes, strings, nesting and non-JSON values', async () => {
  const nodes = fixture();
  nodes.components = Array.from({ length: 129 }, (_, index) => ({ ...nodes.components[0], id: `n-${index}` }));
  await assert.rejects(render(nodes), /components exceeds 128/);
  const edges = fixture();
  edges.connections = Array.from({ length: 257 }, (_, index) => ({ ...edges.connections[0], id: `e-${index}` }));
  await assert.rejects(render(edges), /connections exceeds 256/);
  const long = fixture();
  long.meta.title = 'a'.repeat(8193);
  await assert.rejects(render(long), /String exceeds/);
  const huge = fixture();
  huge.cards = Array.from({ length: 32 }, () => ({ dot: 'cyan', title: 'Example', items: ['x'.repeat(8192)] }));
  await assert.rejects(render(huge), /256 KiB/);
  const deep = fixture();
  deep.extra = Array.from({ length: 30 }).reduce((child) => ({ child }), {});
  await assert.rejects(render(deep), /structural limits/);
  for (const input of ['NaN', 'Infinity', 'new Date()', '[1,,2]', 'Object.assign([1], {extra: 2})', '(()=>{const x={};x.x=x;return x})()', '({get meta(){throw new Error("getter invoked")}})']) {
    await assert.rejects(vm.runInContext(`KaiwuArchify.renderArchitecture(${input}, {theme:'light',id:'test'})`, context), (error) => {
      assert.ok(error.archifyDiagnostics);
      assert.doesNotMatch(error.message, /getter invoked/);
      return true;
    });
  }
});

test('child CSP hashes every actual executable script without unsafe-eval or network capabilities', async () => {
  for (const locale of ['en', 'zh-CN']) {
    const spec = fixture();
    spec.meta.locale = locale;
    const html = await render(spec);
    const policy = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)[1];
    for (const script of scripts(html)) {
      assert.ok(policy.includes(`'sha256-${createHash('sha256').update(script).digest('base64')}'`));
      new vm.Script(script);
    }
    assert.match(policy, /default-src 'none'/);
    assert.match(policy, /connect-src 'none'/);
    assert.match(policy, /font-src 'none'/);
    assert.match(policy, /img-src data: blob:/);
    assert.match(policy, /script-src-attr 'none'/);
    assert.doesNotMatch(policy, /unsafe-eval|https?:|script-src[^;]*'unsafe-inline'/);
    const markup = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '');
    assert.doesNotMatch(markup, /<(?:script|link|img|iframe)\b[^>]*(?:src|href)=["'](?:https?:|\/\/)/i);
    assert.doesNotMatch(html, /fonts\.googleapis\.com|fonts\.gstatic\.com/);
    assert.doesNotMatch(markup, /@font-face/);
    assert.doesNotMatch(scripts(html).join('\n'), /\bfetch\s*\(|\bXMLHttpRequest\b|\bsendBeacon\b|\beval\s*\(|\bnew Function\s*\(/);
  }
  assert.doesNotMatch(bundle, /\bprocess\.(?:env|argv|cwd)|node:fs|node:path|\brequire\s*\(/);
});

function bridgeHarness({
  count = 0, complete = true, missingApi = false, missingSvg = false,
  zeroGeometry = false, invalidViewBox = false, measureThrows = false, failDuringMeasure = false,
} = {}) {
  const events = new Map();
  const documentEvents = new Map();
  const calls = [];
  const messages = [];
  const queue = [];
  const frames = [];
  const measurements = [];
  const attributes = new Map([['data-archify-id', 'bridge-example']]);
  const media = { matches: false, addEventListener: (_type, fn) => { media.change = fn; } };
  const parent = { postMessage: (value) => messages.push(value) };
  const guidedViews = count ? {
    count, pause: () => calls.push('pause'), clearPreview: () => calls.push('clear'),
    settleHandoff: () => calls.push('settle'), isPlaying: () => true,
  } : { count: 0, active: () => null };
  const window = {
    parent,
    addEventListener: (type, handler) => events.set(type, handler),
    matchMedia: () => media,
    Archify: {
      motionGovernor: { setMode: (mode, options) => { assert.equal(mode, 'still'); assert.equal(options.persist, false); calls.push('still'); } },
      guidedViews, routeProbe: { pauseJourney: () => calls.push('journey') },
      view: { reset() {} }, theme: { toggle() {} },
    },
  };
  if (missingApi) delete window.Archify.routeProbe;
  const svg = {
    viewBox: { baseVal: { width: invalidViewBox ? NaN : 510, height: 240 } },
    getBBox() {
      measurements.push('geometry');
      if (measureThrows) throw new Error('No SVG geometry');
      return { width: zeroGeometry ? 0 : 510, height: 240 };
    },
    getBoundingClientRect() {
      measurements.push('layout');
      if (failDuringMeasure) window.__kaiwuArchifyBridge.failed = true;
      return { width: 900, height: 500 };
    },
  };
  const document = {
    hidden: false, documentElement: { getAttribute: (key) => attributes.get(key) },
    addEventListener: (type, handler) => documentEvents.set(type, handler),
    querySelector: () => missingSvg ? null : svg,
  };
  const scope = vm.createContext({
    window, document, requestAnimationFrame: (fn) => frames.push(fn),
    setTimeout: (fn) => queue.push(fn), queueMicrotask: (fn) => queue.push(fn),
  });
  const code = scripts(rendered);
  vm.runInContext(code[0], scope);
  window.__kaiwuArchifyBridge.nativeComplete = complete;
  vm.runInContext(code.at(-1), scope);
  return { window, parent, document, media, events, documentEvents, calls, messages, queue, frames, measurements, flush() { while (queue.length) queue.shift()(); } };
}

test('offscreen ready measures completed native SVG without any animation-frame progress, including zero views', () => {
  for (const count of [0, 1]) {
    const harness = bridgeHarness({ count });
    assert.equal(harness.messages.length, 0);
    harness.events.get('load')();
    assert.equal(harness.messages.length, 0);
    harness.flush();
    assert.equal(harness.messages.length, 1);
    assert.equal(harness.messages[0].type, 'archify:ready');
    assert.equal(harness.messages[0].id, 'bridge-example');
    assert.deepEqual(harness.calls, count ? ['still', 'pause', 'clear', 'settle', 'journey'] : ['still', 'journey']);
    assert.deepEqual(harness.measurements, ['geometry', 'layout']);
    assert.equal(harness.frames.length, 0);
  }
  assert.match(scripts(rendered)[2], /window\.__kaiwuArchifyBridge\.nativeComplete = true;\s*$/);
  assert.match(scripts(rendered)[2], /typeof Archify\.guidedViews\.isPlaying === 'function'/);
});

test('offscreen readiness cannot succeed on a task boundary alone without real measurable SVG', () => {
  for (const options of [{ missingSvg: true }, { zeroGeometry: true }, { invalidViewBox: true }, { measureThrows: true }, { failDuringMeasure: true }]) {
    const harness = bridgeHarness(options);
    harness.events.get('load')();
    harness.flush();
    assert.equal(harness.messages.length, 0);
  }
});

test('ready is suppressed after native errors, rejected initialization, missing sentinel or incomplete APIs', () => {
  for (const options of [{ complete: false }, { missingApi: true }, { error: true }, { rejection: true }]) {
    const harness = bridgeHarness(options);
    harness.events.get('load')();
    if (options.error) harness.events.get('error')();
    if (options.rejection) harness.events.get('unhandledrejection')();
    harness.flush();
    assert.equal(harness.messages.length, 0);
  }
});

test('suspend bridge authenticates parent source and id and settles motion, visibility, print and reduced-motion', () => {
  const harness = bridgeHarness({ count: 1 });
  const message = harness.events.get('message');
  message({ source: {}, data: { type: 'archify:suspend', id: 'bridge-example' } });
  message({ source: harness.parent, data: { type: 'archify:suspend', id: 'wrong' } });
  message({ source: harness.parent, data: { type: 'other', id: 'bridge-example' } });
  assert.deepEqual(harness.calls, []);
  message({ source: harness.parent, data: { type: 'archify:suspend', id: 'bridge-example' } });
  assert.deepEqual(harness.calls, ['still', 'pause', 'clear', 'settle', 'journey']);
  harness.calls.length = 0;
  harness.document.hidden = true;
  harness.documentEvents.get('visibilitychange')();
  harness.events.get('beforeprint')();
  harness.media.matches = true;
  harness.media.change();
  assert.equal(harness.calls.filter((call) => call === 'still').length, 3);
});

test('validated theme overrides head, toolbar, stored preference and OS updates', () => {
  const [head, main] = scripts(rendered).slice(1, 3);
  assert.match(head, /var theme = document\.documentElement\.getAttribute\('data-initial-theme'\)/);
  assert.match(head, /if \(!theme && \(param === 'light'/);
  assert.match(main, /function urlOverride\(\) \{\s*var initial = html\.getAttribute\('data-initial-theme'\)/);
  assert.match(main, /if \(urlOverride\(\) \|\| saved === 'light' \|\| saved === 'dark'\) return/);
  assert.match(main, /readerPaused = html\.getAttribute\('data-initial-motion'\) === 'still'/);
});

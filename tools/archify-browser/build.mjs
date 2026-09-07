import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const here = path.dirname(fileURLToPath(import.meta.url));
const site = path.resolve(here, '..', '..');
const upstreamRoot = process.argv[2];
if (!upstreamRoot) throw new Error('Usage: node tools/archify-browser/build.mjs <public-archify-root> [esbuild-module-file]');
const esbuild = process.argv[3]
  ? await import(pathToFileURL(path.resolve(process.argv[3])).href)
  : await import('esbuild');
if (esbuild.version !== '0.25.12') throw new Error('Regeneration requires esbuild 0.25.12');
const pin = JSON.parse(await readFile(path.join(here, 'upstream-lock.json'), 'utf8'));
const sources = new Map();
for (const [name, expected] of Object.entries(pin.files)) {
  const bytes = await readFile(path.resolve(upstreamRoot, ...name.split('/')));
  if (createHash('sha256').update(bytes).digest('hex') !== expected) throw new Error(`Upstream hash mismatch: ${name}`);
  sources.set(name, bytes.toString('utf8'));
}

function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before);
  if (first < 0 || source.indexOf(before, first + before.length) !== -1) throw new Error(`Transformation marker mismatch: ${label}`);
  return source.slice(0, first) + after + source.slice(first + before.length);
}
function between(source, start, end, label) {
  const a = source.indexOf(start);
  const b = source.indexOf(end, a + start.length);
  if (a < 0 || b < a || source.indexOf(start, a + start.length) !== -1 || source.indexOf(end, b + end.length) !== -1) {
    throw new Error(`Extraction marker mismatch: ${label}`);
  }
  return source.slice(a, b);
}

const bridgeStart = (await readFile(path.join(here, 'bridge-start.js'), 'utf8')).replace(/\r\n/g, '\n');
const bridgeEnd = (await readFile(path.join(here, 'bridge-end.js'), 'utf8')).replace(/\r\n/g, '\n');
let template = sources.get('assets/template.html').replace(/\r\n/g, '\n');
template = replaceOnce(template,
  between(template, '  <!-- Async font load:', '  <style>', 'font resource block'), '', 'remove remote fonts');
template = replaceOnce(template, '<head>', `<head>\n  <meta http-equiv="Content-Security-Policy" content="[KAIWU:CSP]">\n  <script>${bridgeStart}</script>`, 'early failure latch');
template = replaceOnce(template, 'var theme = null;', "var theme = document.documentElement.getAttribute('data-initial-theme');", 'head theme');
template = replaceOnce(template, "if (param === 'light' || param === 'dark') theme = param;", "if (!theme && (param === 'light' || param === 'dark')) theme = param;", 'head theme priority');
template = replaceOnce(template, 'function urlOverride() {', "function urlOverride() {\n        var initial = html.getAttribute('data-initial-theme');\n        if (initial === 'light' || initial === 'dark') return initial;", 'toolbar and OS theme priority');
template = replaceOnce(template, "readerPaused = readStored() === 'still';", "readerPaused = html.getAttribute('data-initial-motion') === 'still' || readStored() === 'still';", 'initial still');
template = replaceOnce(template, 'Archify.guidedViews && Archify.guidedViews.isPlaying())', "Archify.guidedViews && typeof Archify.guidedViews.isPlaying === 'function' && Archify.guidedViews.isPlaying())", 'empty guided views governor');
template = replaceOnce(template, '  </script>\n</body>', `    window.__kaiwuArchifyBridge.nativeComplete = true;\n  </script>\n  <script>${bridgeEnd}</script>\n</body>`, 'native completion sentinel');
const staticScripts = [...template.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map((match) => match[1]);
if (staticScripts.length !== 4 || staticScripts.some((script) => script.includes('{{i18n:'))) throw new Error('Static script contract changed');
const scriptHashes = staticScripts.map((script) => `'sha256-${createHash('sha256').update(script).digest('base64')}'`);
const csp = [
  "default-src 'none'", `script-src ${scriptHashes.join(' ')}`, "script-src-attr 'none'",
  "style-src 'unsafe-inline'", "connect-src 'none'", "font-src 'none'",
  "img-src data: blob:", "media-src blob:", "object-src 'none'", "base-uri 'none'",
  "form-action 'none'", "frame-src 'none'", "worker-src 'none'",
].join('; ');
template = replaceOnce(template, '[KAIWU:CSP]', csp, 'CSP');

function transform(name, source) {
  if (name === 'renderers/architecture/render-architecture.mjs') {
    let imports = between(source, "import { esc,", 'const componentTextFit', 'architecture imports');
    imports = replaceOnce(imports, 'loadDiagramWithBrandMarks, writeDiagram, ', '', 'CLI imports');
    const constants = between(source, 'const componentTextFit', 'const __dirname', 'text constants');
    const body = between(source, 'const grid = gridLayout(arch);', '\nvalidateArchitecture();', 'invocation-local renderer');
    return `${imports}\nimport { applyTemplate, renderCards } from '../shared/utils.mjs';\nimport template from 'archify-template';\n${constants}\nexport function renderArchitectureCore(arch) {\n${body}\nvalidateArchitecture();\nreturn applyTemplate(template, { title: arch.meta.title, subtitle: arch.meta.subtitle, svg: renderSvg(), cards: renderCards(arch.cards), locale: arch.meta.locale, visualPreset: arch.meta.visual_preset || 'classic', guidedViews: arch.meta.views || [], sourceEvidence: null });\n}\n`;
  }
  if (name === 'renderers/shared/cli.mjs') {
    const pure = source.slice(source.indexOf('const SEMANTIC_COLLECTIONS ='));
    if (!pure.startsWith('const SEMANTIC_COLLECTIONS =')) throw new Error('CLI pure helper marker missing');
    return "import { esc } from './utils.mjs';\nimport { throwDiagnosticProblems } from './diagnostics.mjs';\nimport { resolveLocale, translateMessage } from './i18n.mjs';\n"
      + replaceOnce(pure, 'process.env.ARCHIFY_QUALITY_PROFILE || meta.quality_profile', 'meta.quality_profile', 'SVG authored profile');
  }
  if (name === 'renderers/shared/geometry.mjs') {
    return replaceOnce(source, 'process.env.ARCHIFY_QUALITY_PROFILE || profile', 'profile', 'geometry authored profile');
  }
  if (name === 'renderers/shared/diagnostics.mjs') {
    const pure = between(source, 'function plainObject(value)', 'function fallbackDiagnostic(error)', 'pure diagnostics');
    return `const DIAGNOSTIC_MODE = true;\nlet recorded = [];\nlet recordedMessages = new Set();\nlet recordingSuppressionDepth = 0;\n${pure}
export function withBrowserDiagnostics(callback) {
  recorded = [];
  recordedMessages = new Set();
  recordingSuppressionDepth = 0;
  try { return callback(); }
  catch (error) {
    const attached = error.archifyDiagnostics || [];
    const all = [...recorded, ...attached].map(normalizedDiagnostic);
    if (!all.length) all.push(normalizedDiagnostic({ message: error.message }));
    error.archifyDiagnostics = all.filter((item, index) => all.findIndex((other) => other.message === item.message) === index);
    throw error;
  } finally {
    recorded = [];
    recordedMessages = new Set();
    recordingSuppressionDepth = 0;
  }
}\n`;
  }
  if (name === 'renderers/shared/brand-marks.mjs') {
    return `export function brandMetadataFor() { return {}; }\nexport function brandLabelFitWidth(node, width) { return width; }\nexport function brandTopRailProblem() { return null; }\nexport function renderBrandMark() { return ''; }\n`;
  }
  return source;
}

const result = await esbuild.build({
  entryPoints: [path.join(here, 'adapter.mjs')],
  bundle: true, write: false, platform: 'browser', format: 'iife', globalName: 'KaiwuArchify',
  target: ['es2022'], minify: true, legalComments: 'inline', charset: 'utf8',
  banner: { js: `/*! Kaiwu Archify browser adapter ${pin.adapterVersion}; upstream MIT ${pin.revision}. See LICENSE and manifest.json. */` },
  plugins: [{
    name: 'pinned-public-archify',
    setup(build) {
      build.onResolve({ filter: /^archify-upstream:/ }, (args) => ({ path: args.path.slice('archify-upstream:'.length), namespace: 'archify' }));
      build.onResolve({ filter: /^archify-template$/ }, () => ({ path: 'template', namespace: 'archify-template' }));
      build.onLoad({ filter: /.*/, namespace: 'archify-template' }, () => ({ contents: template, loader: 'text' }));
      build.onResolve({ filter: /^\./, namespace: 'archify' }, (args) => ({
        path: path.posix.normalize(path.posix.join(path.posix.dirname(args.importer), args.path)), namespace: 'archify',
      }));
      build.onLoad({ filter: /.*/, namespace: 'archify' }, (args) => {
        if (!sources.has(args.path)) throw new Error(`Unpinned upstream dependency: ${args.path}`);
        const contents = transform(args.path, sources.get(args.path));
        if (/\bprocess\b|\bnode:|from ['"](?:fs|path)['"]/.test(contents)) throw new Error(`Node boundary remains in ${args.path}`);
        return { contents, loader: 'js' };
      });
    },
  }],
});
const bundle = result.outputFiles[0].contents;
const out = path.join(site, 'vendor', 'archify-browser', pin.adapterVersion);
await mkdir(out, { recursive: true });
await writeFile(path.join(out, 'archify-browser.js'), bundle);
await writeFile(path.join(out, 'LICENSE'), sources.get('LICENSE'));
const hash = (bytes, encoding, algorithm = 'sha256') => createHash(algorithm).update(bytes).digest(encoding);
const manifest = {
  name: 'KaiwuArchify', adapterVersion: pin.adapterVersion,
  upstream: { repository: pin.repository, revision: pin.revision, license: 'MIT', files: pin.files },
  build: { esbuild: esbuild.version, target: 'es2022', format: 'iife' },
  adapterSources: Object.fromEntries(await Promise.all([
    'adapter.mjs', 'build.mjs', 'bridge-start.js', 'bridge-end.js',
    'package.json', 'package-lock.json', 'upstream-lock.json',
  ].map(async (name) => [name, hash((await readFile(path.join(here, name), 'utf8')).replace(/\r\n/g, '\n'), 'hex')]))),
  files: {
    'archify-browser.js': {
      bytes: bundle.length, sha256: hash(bundle, 'hex'), sha384: hash(bundle, 'hex', 'sha384'),
      integrity: `sha384-${hash(bundle, 'base64', 'sha384')}`,
    },
    LICENSE: { sha256: hash(sources.get('LICENSE'), 'hex') },
  },
  childScriptHashes: scriptHashes,
};
await writeFile(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`${path.relative(site, out)}\n${manifest.files['archify-browser.js'].integrity}`);

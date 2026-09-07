import { renderArchitectureCore } from 'archify-upstream:renderers/architecture/render-architecture.mjs';
import { validateSchema } from 'archify-upstream:renderers/shared/validator.mjs';
import { validateGuidedViews, validateRelationshipIds } from 'archify-upstream:renderers/shared/cli.mjs';
import { validateEngineeringProfile } from 'archify-upstream:renderers/shared/engineering-profiles.mjs';
import { withBrowserDiagnostics } from 'archify-upstream:renderers/shared/diagnostics.mjs';

const limits = Object.freeze({
  jsonBytes: 262144, components: 128, connections: 256, boundaries: 64,
  cards: 32, views: 32, arrayItems: 512, stringLength: 8192, depth: 24,
  values: 20000, coordinateMagnitude: 1000000,
});

function reject(message, path = '/', code = 'browser/input') {
  const error = new TypeError(message);
  error.archifyDiagnostics = [{
    code, severity: 'error', message, subject: { path }, evidence: {},
    supportedFixes: ['provide bounded, plain architecture JSON and supported render options'],
  }];
  throw error;
}

function snapshot(input) {
  let values = 0;
  let textBytes = 0;
  const encoder = new TextEncoder();
  const ancestors = new Set();
  function countText(value) {
    textBytes += encoder.encode(value).length;
    if (textBytes > limits.jsonBytes) reject('Input exceeds 256 KiB UTF-8 JSON');
  }
  function visit(value, path, depth) {
    if (++values > limits.values || depth > limits.depth) reject('Input exceeds structural limits', path);
    if (value === null || typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      if (value.length > limits.stringLength) reject('String exceeds 8192 characters', path);
      countText(value);
      return value;
    }
    if (typeof value === 'number') {
      if (!Number.isFinite(value) || Math.abs(value) > limits.coordinateMagnitude) reject('Number is non-finite or exceeds magnitude 1000000', path);
      return value;
    }
    if (typeof value !== 'object') reject('Only JSON values are supported', path);
    if (ancestors.has(value)) reject('Cyclic input is not supported', path);
    const array = Array.isArray(value);
    if (!array && Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) {
      reject('Only plain JSON objects are supported', path);
    }
    if (array && value.length > limits.arrayItems) reject('Array exceeds 512 items', path);
    ancestors.add(value);
    const copy = array ? [] : Object.create(null);
    let arrayEntries = 0;
    for (const key of Reflect.ownKeys(value)) {
      if (array && key === 'length') continue;
      if (typeof key !== 'string' || ['__proto__', 'prototype', 'constructor'].includes(key)) reject('Unsupported object key', path);
      countText(key);
      if (array && !/^(0|[1-9][0-9]*)$/.test(key)) reject('Arrays may contain only indexed JSON values', path);
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) reject('Accessors and hidden fields are not JSON', path);
      copy[key] = visit(descriptor.value, `${path}/${key}`, depth + 1);
      arrayEntries += 1;
    }
    if (array && arrayEntries !== value.length) reject('Sparse arrays are not JSON', path);
    ancestors.delete(value);
    return copy;
  }
  const copy = visit(input, '', 0);
  const json = JSON.stringify(copy);
  if (new TextEncoder().encode(json).length > limits.jsonBytes) reject('Input exceeds 256 KiB UTF-8 JSON');
  return JSON.parse(json);
}

function validateBrowserInput(spec) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) reject('Expected an architecture object');
  for (const field of ['output', 'repository']) {
    if (spec.meta && Object.hasOwn(spec.meta, field)) reject(`meta.${field} is not supported in the browser`, `/meta/${field}`, 'browser/unsupported');
  }
  for (const [name, maximum] of Object.entries({
    components: limits.components, connections: limits.connections,
    boundaries: limits.boundaries, cards: limits.cards,
  })) {
    if (Array.isArray(spec[name]) && spec[name].length > maximum) reject(`${name} exceeds ${maximum} items`, `/${name}`);
  }
  if (Array.isArray(spec.meta?.views) && spec.meta.views.length > limits.views) reject('views exceeds 32 items', '/meta/views');
  if (Array.isArray(spec.components)) spec.components.forEach((component, index) => {
    if (!component || typeof component !== 'object') return;
    for (const field of ['sources', 'brand']) {
      if (Object.hasOwn(component, field)) reject(`component.${field} is not supported in the browser`, `/components/${index}/${field}`, 'browser/unsupported');
    }
  });
}

export async function renderArchitecture(input, options) {
  const config = snapshot(options);
  if (!config || typeof config !== 'object' || Array.isArray(config)
      || Object.keys(config).some((key) => key !== 'theme' && key !== 'id')
      || !['light', 'dark'].includes(config.theme)
      || typeof config.id !== 'string' || config.id.length > 64
      || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(config.id)) {
    reject('Options require theme light|dark and a kebab-case id (1–64 characters)', '/options');
  }
  const spec = snapshot(input);
  validateBrowserInput(spec);
  return withBrowserDiagnostics(() => {
    validateSchema('architecture', spec);
    validateGuidedViews('architecture', spec);
    validateRelationshipIds('architecture', spec);
    validateEngineeringProfile('architecture', spec);
    return renderArchitectureCore(spec)
      .replace('<html ', `<html data-archify-id="${config.id}" data-initial-theme="${config.theme}" data-initial-motion="still" `)
      .replace('data-theme="dark"', `data-theme="${config.theme}"`);
  });
}

export { limits };
export const version = 'd8e4daf-v1';

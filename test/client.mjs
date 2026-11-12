/**
 * Client-half tests: load the browser bundle the way the module loader does,
 * then mount, click and type through the real components with a miniature
 * renderer (`test/harness.mjs`).
 *   node test/client.mjs
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

import { createSurface } from './harness.mjs';

/** Let queued fetches resolve, debounced effects fire, and the tree settle. */
async function settle(surface) {
  await surface.flush(60);
  await surface.flush(340);
  await surface.flush(60);
}

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, '..', 'client.js'), 'utf8');

const CATALOG = {
  ok: true,
  sources: { tier: 'settings' },
  secretsAvailable: true,
  canWrite: true,
  providers: [
    {
      id: 'relay',
      displayName: 'Relay',
      api: 'openai-completions',
      baseURL: 'http://relay.example/v1',
      apiKeyEnv: 'RELAY_API_KEY',
      hasCredential: true,
      models: [
        { id: 'model-one', name: 'Model One', origin: 'declared' },
        { id: 'model-two', name: 'Model Two', origin: 'catalog' },
      ],
    },
    {
      id: 'second',
      displayName: 'Second API',
      api: 'anthropic-messages',
      baseURL: 'http://second.example',
      models: [{ id: 'claude-x', name: 'Claude X', origin: 'declared' }],
    },
  ],
  skipped: [],
  dormant: [],
  warnings: [],
};

const EXPORTED = {
  ok: true,
  mode: 'auto',
  yaml: '- id: llm-pi-ai\n  name: "@deepseek-ai/dsh-llm-pi-ai"\n  config:\n    providers: {}\n',
  json: '{"patch":[]}\n',
  renames: [],
  identical: [],
  warnings: [],
  providerIds: ['relay'],
  secretsIncluded: false,
};

const PLAN = {
  ok: true,
  format: 'yaml',
  policy: 'merge',
  canWrite: true,
  changes: true,
  entries: [
    { provider: 'relay', action: 'rename', from: 'relay', to: 'relay-2', reason: 'the profile already owns this id', models: { total: 2 } },
    { provider: 'second', action: 'unchanged', from: 'second', to: 'second', reason: 'identical', models: { total: 1 } },
  ],
  summary: { create: 0, rename: 1, update: 0, unchanged: 1, skip: 0, invalid: 0 },
  warnings: [],
  validation: { checked: true, error: '' },
};

/**
 * Load the bundle with a fake module loader and a routing `fetch`.
 * @param {{ responses?: Record<string, any>, fail?: string }} [options]
 */
function loadBundle(options = {}) {
  let factory = null;
  const calls = [];
  const responses = Object.assign({ '/catalog': CATALOG, '/export': EXPORTED, '/import/preview': PLAN }, options.responses);
  const surface = createSurface();

  const sandbox = {
    window: {
      __ModuleLoader__: {
        load(definition) {
          factory = definition.factory;
          assert.equal(definition.id, 'dsh-api-share', 'the factory id must equal the package name');
        },
      },
    },
    document: {
      getElementById: () => null,
      createElement: () => ({ style: {}, setAttribute() {}, appendChild() {}, textContent: '' }),
      head: { appendChild() {} },
      body: { appendChild() {}, removeChild() {} },
      addEventListener() {},
      removeEventListener() {},
    },
    navigator: {},
    console: { log() {}, warn() {}, error() {} },
    setTimeout,
    clearTimeout,
    URL: { createObjectURL: () => 'blob:x', revokeObjectURL() {} },
    Blob: class {},
  };
  sandbox.fetch = (url, init) => {
    const path = String(url).replace('dsh-api-share', '');
    const body = init !== undefined && typeof init.body === 'string' ? JSON.parse(init.body) : {};
    calls.push({ path, body });
    if (options.fail === path) {
      return Promise.resolve({ ok: false, status: 422, json: () => Promise.resolve({ ok: false, code: 'bad-snippet', detail: 'nope' }) });
    }
    const payload = responses[path] === undefined ? { ok: true } : responses[path];
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(payload) });
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: 'client.js' });
  assert.ok(factory !== null, 'the bundle must register itself with the module loader');

  const exports = factory((name) => {
    assert.equal(name, 'react', `the bundle may only require the platform table, got "${name}"`);
    return surface.react;
  });
  return { exports, surface, calls };
}

/** Activate the bundle and return the component registered into the slot. */
function mountFooter(options) {
  const bundle = loadBundle(options);
  const registrations = [];
  const injections = [];
  bundle.exports.apply({
    get: () => undefined,
    effect: (fn) => {
      if (typeof fn === 'function') fn();
    },
    slots: {
      inject(name, callback) {
        injections.push(name);
        callback();
      },
      register(options, component) {
        registrations.push({ options, component });
        return () => {};
      },
    },
  });
  assert.deepEqual(injections, ['settings.models.footer']);
  assert.equal(registrations.length, 1);
  bundle.surface.mount(registrations[0].component, {});
  return { ...bundle, registrations };
}

test('client: the bundle declares only the slots service', () => {
  const { exports } = loadBundle();
  assert.equal(exports.inject.length, 1);
  assert.equal(exports.inject[0], 'slots');
  assert.equal(typeof exports.apply, 'function');
});

test('client: a missing slots service never throws out of apply', () => {
  const { exports } = loadBundle();
  assert.doesNotThrow(() => exports.apply({ get: () => undefined, effect: () => {} }));
});

test('client: the footer renders its entry button and keeps the dialog closed', () => {
  const { surface } = mountFooter();
  const text = surface.text();
  assert.match(text, /导入 \/ 导出配置/);
  assert.doesNotMatch(text, /模型配置分享/, 'the dialog stays closed until the button is used');
});

test('client: opening the dialog loads the catalogue and lists API groups', async () => {
  const { surface, calls } = mountFooter();
  surface.clickText(/导入 \/ 导出配置/);
  await settle(surface);
  assert.ok(calls.some((call) => call.path === '/catalog'), 'the catalogue route is read on open');
  const text = surface.text();
  assert.match(text, /模型配置分享/);
  assert.match(text, /导出/);
  assert.match(text, /导入/);
  assert.match(text, /Relay/, 'a provider group header shows the display name');
  assert.match(text, /Second API/);
});

test('client: each API group collapses and expands', async () => {
  const { surface } = mountFooter();
  surface.clickText(/导入 \/ 导出配置/);
  await settle(surface);

  /* The first group opens by itself, so its model list is visible… */
  assert.match(surface.text(), /model-one/);
  /* …while the second one starts collapsed. */
  assert.doesNotMatch(surface.text(), /claude-x/);

  const headers = surface.byType('button').filter((element) => element.props['aria-controls'] !== undefined);
  assert.equal(headers.length, 2, 'one collapsible header per provider');

  headers[1].props.onClick();
  surface.render();
  assert.match(surface.text(), /claude-x/, 'expanding a group reveals its models');

  surface.byType('button').filter((element) => element.props['aria-controls'] !== undefined)[1].props.onClick();
  surface.render();
  assert.doesNotMatch(surface.text(), /claude-x/, 'collapsing hides them again');
});

test('client: the search box filters providers and models', async () => {
  const { surface } = mountFooter();
  surface.clickText(/导入 \/ 导出配置/);
  await settle(surface);

  const search = surface.elements().find((element) => element.props.type === 'search');
  assert.ok(search !== undefined, 'the provider column has a search field');
  surface.type(search, 'claude-x');
  assert.match(surface.text(), /Second API/, 'the matching provider stays');
  assert.doesNotMatch(surface.text(), /Relay/, 'a provider with no match is filtered out');
});

test('client: the export preview is requested and shown', async () => {
  const { surface, calls } = mountFooter();
  surface.clickText(/导入 \/ 导出配置/);
  await settle(surface);

  const exportCall = calls.filter((call) => call.path === '/export').pop();
  assert.ok(exportCall !== undefined, 'the export route is called for the initial selection');
  assert.equal(exportCall.body.mode, 'auto');
  assert.equal(exportCall.body.selection.length, 2);
  assert.match(surface.text(), /llm-pi-ai/, 'the YAML preview is rendered');
});

test('client: the import tab previews a pasted snippet', async () => {
  const { surface, calls } = mountFooter();
  surface.clickText(/导入 \/ 导出配置/);
  await settle(surface);
  surface.clickText(/^导入$/);

  const areas = surface.byType('textarea');
  assert.equal(areas.length, 1, 'the import tab offers a paste area');
  surface.type(areas[0], '- id: llm-pi-ai\n  config:\n    providers: {}\n');
  await settle(surface);

  const previewCall = calls.filter((call) => call.path === '/import/preview').pop();
  assert.ok(previewCall !== undefined, 'the preview route is called');
  assert.equal(previewCall.body.policy, 'merge');
  const text = surface.text();
  assert.match(text, /relay-2/, 'the plan shows the renamed provider');
  assert.match(text, /已存在|unchanged|second/, 'the plan shows the untouched provider');
});

test('client: a refused plan disables the write button', async () => {
  const refused = Object.assign({}, PLAN, { validation: { checked: true, error: 'provider "relay" has an empty baseURL' } });
  const { surface } = mountFooter({ responses: { '/import/preview': refused } });
  surface.clickText(/导入 \/ 导出配置/);
  await settle(surface);
  surface.clickText(/^导入$/);
  surface.type(surface.byType('textarea')[0], '- id: llm-pi-ai\n  config:\n    providers: {}\n');
  await settle(surface);

  assert.match(surface.text(), /empty baseURL/, 'the adapter diagnostic is shown');
  const writeButton = surface.byType('button').find((element) => element.props.disabled === true && /写入配置/.test(surface.textOf(element)));
  assert.ok(writeButton !== undefined, 'the write button is disabled when validation fails');
});

test('client: a parse failure is reported instead of crashing', async () => {
  const { surface } = mountFooter({ fail: '/import/preview' });
  surface.clickText(/导入 \/ 导出配置/);
  await settle(surface);
  surface.clickText(/^导入$/);
  surface.type(surface.byType('textarea')[0], 'not a snippet');
  await settle(surface);
  assert.match(surface.text(), /nope/, 'the server detail is shown to the user');
});

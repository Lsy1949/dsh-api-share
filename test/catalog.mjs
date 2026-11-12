/**
 * Catalogue tests with fake harness services: the shapes a real DSH composition
 * hands over (settings descriptors, directory entries, credential resolution),
 * so the export route is exercised without booting the app.
 *   node test/catalog.mjs
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { readCatalog, targetOf, plain, mergeConfig, isExpression } from '../lib/host/catalog.js';
import { normalizeRequest, isBrowserSameOrigin } from '../lib/host/routes.js';

/** A Config reference, as cordis hands one to a plugin. */
function ref(value) {
  return { get: () => value, set: () => {} };
}

/**
 * @param {object} options
 * @returns {any} a fake host context
 */
function fakeCtx(options = {}) {
  const services = new Map();
  if (options.settings !== undefined) services.set('settings', { describe: () => options.settings });
  if (options.withLlm !== false) {
    services.set('llm', {
      listConfigurableProviders: () => options.directory ?? [],
    });
  }
  if (options.withCredentials !== false) {
    services.set('credentials', {
      resolve: async (name) => {
        const value = (options.credentials ?? {})[name];
        return value === undefined ? undefined : { value, source: 'file' };
      },
    });
  }
  if (options.configEditor !== undefined) services.set('configEditor', options.configEditor);
  if (options.loader !== undefined) services.set('loader', options.loader);
  return { get: (name) => services.get(name) };
}

const PROVIDER = {
  apiKeyEnv: 'WORKBUDDY_API_API_KEY',
  api: 'openai-completions',
  baseURL: 'http://121.40.169.141:7863/v1',
  models: [
    { id: 'cn:hy3', name: 'Hy3', contextWindow: 192000, maxTokens: 64000 },
    { id: 'cn:auto', contextWindow: 256000, internalField: 'drop me' },
  ],
  headers: { 'x-team': 'red' },
};

/** A settings descriptor as `settings.describe({redactSecrets:true})` returns one. */
function descriptor(overrides = {}) {
  return {
    ns: 'llm-pi-ai',
    revision: 3,
    applies: 'live',
    autoGenerate: true,
    schema: {},
    value: { providers: { 'workbuddy-api': { ...PROVIDER, secretDefault: 'x' } } },
    base: {},
    user: { providers: { 'workbuddy-api': PROVIDER } },
    ...overrides,
  };
}

test('plain: resolves config references and nested structures', () => {
  assert.deepEqual(plain({ a: ref({ b: ref(2) }), c: [ref(3)] }), { a: { b: 2 }, c: [3] });
});

test('mergeConfig: objects merge, arrays replace', () => {
  assert.deepEqual(mergeConfig({ a: { b: 1, c: 2 } }, { a: { c: 3 }, d: [1] }), { a: { b: 1, c: 3 }, d: [1] });
});

test('isExpression: !!js nodes are recognised so they are never serialized', () => {
  assert.equal(isExpression({ __jsExpr: 'ctx.get("x")' }), true);
  assert.equal(isExpression({ apiKeyEnv: 'X' }), false);
});

test('catalog: reads the user layer through settings.describe', async () => {
  const catalog = await readCatalog(
    fakeCtx({ settings: [descriptor()], directory: [{ provider: 'workbuddy-api', displayName: 'WorkBuddy API', settingsNs: 'llm-pi-ai' }] }),
    { withSecrets: true },
  );
  assert.equal(catalog.sources.tier, 'settings');
  const provider = catalog.providers.get('workbuddy-api');
  assert.equal(provider.api, 'openai-completions');
  assert.equal(provider.baseURL, 'http://121.40.169.141:7863/v1');
  assert.equal(provider.apiKeyEnv, 'WORKBUDDY_API_API_KEY');
  /* headers are an adapter field; a field only the effective layer carries is not exported */
  assert.deepEqual(provider.profile.headers, { 'x-team': 'red' });
  assert.equal(provider.profile.secretDefault, undefined);
  assert.deepEqual(provider.models.map((model) => model.id), ['cn:hy3', 'cn:auto']);
  assert.equal(provider.models[0].origin, 'declared');
  assert.equal(provider.models[1].fields.internalField, undefined);
  assert.equal(provider.hasCredential, false);
});

test('catalog: credentials resolve to a value only when secrets are requested', async () => {
  const ctx = () => fakeCtx({ settings: [descriptor()], credentials: { WORKBUDDY_API_API_KEY: 'sk-live' } });
  const withSecret = await readCatalog(ctx(), { withSecrets: true });
  assert.equal(withSecret.secretsAvailable, true);
  assert.deepEqual(withSecret.secrets, { WORKBUDDY_API_API_KEY: 'sk-live' });

  const withoutSecret = await readCatalog(ctx());
  assert.equal(withoutSecret.secretsAvailable, true);
  assert.deepEqual(withoutSecret.secrets, {});
  assert.equal(withoutSecret.providers.get('workbuddy-api').hasCredential, true);
});

test('catalog: a provider with no declared models inherits the catalog list without pinning it', async () => {
  const inherited = descriptor({
    user: { providers: { relay: { api: 'anthropic-messages', baseURL: 'http://relay' } } },
    value: { providers: { relay: { api: 'anthropic-messages', baseURL: 'http://relay', models: [{ id: 'claude-x', contextWindow: 200000 }] } } },
  });
  const catalog = await readCatalog(fakeCtx({ settings: [inherited] }));
  const relay = catalog.providers.get('relay');
  assert.equal(relay.inheritsModels, true);
  assert.deepEqual(relay.models.map((model) => model.id), ['claude-x']);
  assert.equal(relay.models[0].origin, 'catalog');
  assert.deepEqual(relay.models[0].fields, {});
});

test('catalog: dormant directory routes are reported apart, never as rejections', async () => {
  const catalog = await readCatalog(
    fakeCtx({
      settings: [descriptor()],
      directory: [
        { provider: 'openrouter', displayName: 'OpenRouter', settingsNs: 'llm-pi-ai' },
        { provider: 'workbuddy-api', displayName: 'WorkBuddy API', settingsNs: 'llm-pi-ai' },
      ],
    }),
  );
  assert.deepEqual(catalog.dormant.map((entry) => entry.id), ['openrouter']);
  assert.deepEqual(catalog.skipped, []);
});

test('catalog: a !!js expression provider is skipped, never exported', async () => {
  const expression = descriptor({
    user: { providers: { 'js-route': { __jsExpr: 'ctx.get("x")' }, 'workbuddy-api': PROVIDER } },
    value: { providers: { 'js-route': { __jsExpr: 'ctx.get("x")' }, 'workbuddy-api': PROVIDER } },
  });
  const catalog = await readCatalog(fakeCtx({ settings: [expression] }));
  assert.deepEqual(catalog.skipped.map((entry) => entry.id), ['js-route']);
  assert.match(catalog.skipped[0].reason, /!!js/);
  assert.deepEqual([...catalog.providers.keys()], ['workbuddy-api']);
});

test('catalog: a provider only the inheritance layer declares is not offered', async () => {
  const mixed = descriptor({
    user: { providers: { 'workbuddy-api': PROVIDER } },
    value: { providers: { 'workbuddy-api': PROVIDER, inherited: { api: 'openai-completions' } } },
  });
  const catalog = await readCatalog(fakeCtx({ settings: [mixed] }));
  assert.deepEqual(catalog.skipped.map((entry) => entry.id), ['inherited']);
  assert.match(catalog.skipped[0].reason, /inherited from another layer/);
});

test('catalog: falls back to configEditor, then to the loader, when settings is absent', async () => {
  const configEditor = {
    configuration: () => [
      {
        entry: { options: { id: 'llm-pi-ai', name: '@deepseek-ai/dsh-llm-pi-ai' } },
        inherited: {},
        override: { providers: { 'workbuddy-api': PROVIDER } },
      },
    ],
  };
  const viaEditor = await readCatalog(fakeCtx({ configEditor, withLlm: false }));
  assert.equal(viaEditor.sources.tier, 'configEditor');
  assert.equal(viaEditor.providers.get('workbuddy-api').api, 'openai-completions');

  const loader = {
    entries: () => [{ options: { id: 'llm-pi-ai', name: '@deepseek-ai/dsh-llm-pi-ai', config: ref({ providers: { 'workbuddy-api': PROVIDER } }) } }],
  };
  const viaLoader = await readCatalog(fakeCtx({ loader, withLlm: false }));
  assert.equal(viaLoader.sources.tier, 'loader');
  assert.deepEqual(viaLoader.providers.get('workbuddy-api').models.map((model) => model.id), ['cn:hy3', 'cn:auto']);
});

test('catalog: no source at all yields an empty catalogue, not a throw', async () => {
  const catalog = await readCatalog(fakeCtx({ withLlm: false, withCredentials: false }));
  assert.equal(catalog.providers.size, 0);
  assert.equal(catalog.sources.tier, 'none');
});

test('catalog: the namespace is read from the directory, not hardcoded', async () => {
  const renamed = descriptor({ ns: 'my-pi-ai' });
  const catalog = await readCatalog(
    fakeCtx({ settings: [renamed], directory: [{ provider: 'workbuddy-api', settingsNs: 'my-pi-ai' }] }),
  );
  assert.deepEqual(catalog.sources.namespaces, ['my-pi-ai']);
  assert.equal(catalog.providers.get('workbuddy-api').settingsNs, 'my-pi-ai');
});

test('catalog: targetOf mirrors what the receiving side owns', async () => {
  const catalog = await readCatalog(fakeCtx({ settings: [descriptor()] }));
  const target = targetOf(catalog.providers);
  const existing = target.get('workbuddy-api');
  assert.equal(existing.facts.api, 'openai-completions');
  assert.equal(existing.facts.baseURL, 'http://121.40.169.141:7863/v1');
  assert.deepEqual([...existing.models.keys()], ['cn:hy3', 'cn:auto']);
});

test('request: a credential value is only served to the DSH page itself', () => {
  const page = { headers: { origin: 'http://127.0.0.1:52809', host: '127.0.0.1:52809' } };
  const localProcess = { headers: { host: '127.0.0.1:52809' } };
  const foreignPage = { headers: { origin: 'http://evil.example', host: '127.0.0.1:52809' } };
  assert.equal(isBrowserSameOrigin(page), true);
  assert.equal(isBrowserSameOrigin(localProcess), false);
  assert.equal(isBrowserSameOrigin(foreignPage), false);
  assert.equal(isBrowserSameOrigin(undefined), false);
});

test('request: a malformed selection is refused before anything is exported', () => {
  assert.throws(() => normalizeRequest({ selection: [] }), /non-empty array/);
  assert.throws(() => normalizeRequest({ selection: [{ id: 'a', models: [] }] }), /at least one model/);
  assert.throws(() => normalizeRequest({ selection: [{ id: '', models: ['m'] }] }), /provider id/);
  assert.throws(() => normalizeRequest({ selection: [{ id: 'a', models: [1] }] }), /malformed model id/);
  assert.deepEqual(normalizeRequest({ selection: [{ id: 'a', models: ['m', 'm'] }], includeSecrets: true }), {
    selection: [{ id: 'a', models: ['m'] }],
    mode: 'auto',
    includeSecrets: true,
  });
  assert.equal(normalizeRequest({ selection: [{ id: 'a', models: ['m'] }], mode: 'always' }).mode, 'always');
  assert.equal(normalizeRequest({ selection: [{ id: 'a', models: ['m'] }], mode: 'nonsense' }).mode, 'auto');
});

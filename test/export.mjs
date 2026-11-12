/**
 * Export-composition tests: catalogue + selection -> YAML/JSON, with the
 * adaptive naming policy applied. Pure, so no harness is needed.
 *   node test/export.mjs
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildExport, composeEntry, reduceSelection, PATCH_ID, PATCH_NAME } from '../lib/host/export.js';

/** @param {any[]} providers */
function catalogOf(providers) {
  return new Map(providers.map((provider) => [provider.id, provider]));
}

const workbuddy = {
  id: 'workbuddy-api',
  displayName: 'WorkBuddy API',
  api: 'openai-completions',
  baseURL: 'http://121.40.169.141:7863/v1',
  apiKeyEnv: 'WORKBUDDY_API_API_KEY',
  models: [
    {
      id: 'cn:deepseek-v4.1-flash',
      fields: {
        name: 'Deepseek-V4.1-Flash',
        contextWindow: 1000000,
        maxTokens: 393216,
        input: ['text', 'image'],
        reasoningEfforts: { off: null, low: 'low', high: 'high' },
      },
    },
    { id: 'cn:hy3', fields: { name: 'Hy3', contextWindow: 192000 } },
    { id: 'cn:auto', fields: { contextWindow: 256000 } },
  ],
};

const relay = {
  id: 'relay',
  api: 'anthropic-messages',
  baseURL: 'http://relay.example',
  models: [{ id: 'claude-x', fields: { contextWindow: 200000 } }],
};

test('reduce: a null model list means every model of the provider', () => {
  const { providers, warnings } = reduceSelection(catalogOf([workbuddy]), [{ id: 'workbuddy-api' }]);
  assert.equal(providers.length, 1);
  assert.equal(providers[0].models.length, 3);
  assert.deepEqual(warnings, []);
});

test('reduce: unknown provider/model become warnings, never invented entries', () => {
  const { providers, warnings } = reduceSelection(catalogOf([workbuddy]), [
    { id: 'ghost' },
    { id: 'workbuddy-api', models: ['nope'] },
  ]);
  assert.equal(providers.length, 0);
  assert.deepEqual(warnings, [
    'unknown provider "ghost"',
    'unknown model "nope" for provider "workbuddy-api"',
    'provider "workbuddy-api" has no selected models and was skipped',
  ]);
});

test('compose: keeps connection facts ahead of the model list', () => {
  const entry = composeEntry([
    {
      id: 'workbuddy-api',
      facts: { apiKeyEnv: 'WORKBUDDY_API_API_KEY', api: 'openai-completions', baseURL: 'http://x/v1' },
      models: [{ id: 'cn:hy3', payload: { id: 'cn:hy3', contextWindow: 192000 } }],
    },
  ]);
  assert.equal(entry.id, PATCH_ID);
  assert.equal(entry.name, PATCH_NAME);
  assert.deepEqual(Object.keys(entry.config.providers['workbuddy-api']), [
    'apiKeyEnv',
    'api',
    'baseURL',
    'models',
  ]);
});

test('buildExport: emits a paste-ready YAML snippet and a JSON document', () => {
  const result = buildExport({
    catalog: catalogOf([workbuddy]),
    selection: [{ id: 'workbuddy-api', models: ['cn:deepseek-v4.1-flash', 'cn:auto'] }],
    generatedAt: '2026-11-12T00:00:00.000Z',
  });
  assert.match(result.yaml, /^# dsh-api-share/m);
  assert.match(result.yaml, /- id: llm-pi-ai/);
  assert.match(result.yaml, /name: "@deepseek-ai\/dsh-llm-pi-ai"/);
  assert.match(result.yaml, /baseURL: http:\/\/121\.40\.169\.141:7863\/v1/);
  assert.match(result.yaml, /- id: "cn:deepseek-v4\.1-flash"/);
  /* the model's own fields must survive the round trip */
  assert.match(result.yaml, /name: Deepseek-V4\.1-Flash/);
  assert.match(result.yaml, /contextWindow: 1000000/);
  assert.match(result.yaml, /maxTokens: 393216/);
  assert.match(result.yaml, /input: \[text, image\]/);
  /* the unselected model must not appear */
  assert.ok(!result.yaml.includes('cn:hy3'));
  const document = JSON.parse(result.json);
  assert.equal(document.format, 'dsh-api-share/v1');
  assert.equal(document.generatedAt, '2026-11-12T00:00:00.000Z');
  assert.deepEqual(document.patch[0].config.providers['workbuddy-api'].models.map((m) => m.id), [
    'cn:deepseek-v4.1-flash',
    'cn:auto',
  ]);
  assert.deepEqual(result.renames, []);
});

test('buildExport: an identical provider keeps its ids and is reported as identical', () => {
  const target = new Map([
    [
      'workbuddy-api',
      {
        facts: {
          apiKeyEnv: 'WORKBUDDY_API_API_KEY',
          api: 'openai-completions',
          baseURL: 'http://121.40.169.141:7863/v1',
          displayName: 'WorkBuddy API',
        },
        models: new Map([['cn:auto', { id: 'cn:auto', contextWindow: 256000 }]]),
      },
    ],
  ]);
  const result = buildExport({
    catalog: catalogOf([workbuddy]),
    selection: [{ id: 'workbuddy-api', models: ['cn:auto'] }],
    target,
  });
  assert.deepEqual(result.providerIds, ['workbuddy-api']);
  assert.deepEqual(result.identical, ['workbuddy-api']);
});

test('buildExport: a taken provider id with a different endpoint is renamed and flagged in both artefacts', () => {
  const target = new Map([
    ['workbuddy-api', { facts: { baseURL: 'http://old.example/v1' }, models: new Map() }],
  ]);
  const result = buildExport({
    catalog: catalogOf([workbuddy]),
    selection: [{ id: 'workbuddy-api', models: ['cn:auto'] }],
    target,
  });
  assert.deepEqual(result.providerIds, ['workbuddy-api-2']);
  assert.match(result.yaml, /#   provider workbuddy-api\/workbuddy-api -> workbuddy-api-2/);
  assert.match(result.yaml, /^ {6}workbuddy-api-2:$/m);
  const document = JSON.parse(result.json);
  assert.equal(document.meta.renames[0].to, 'workbuddy-api-2');
});

test('buildExport: a taken model id with a different payload is renamed inside its provider', () => {
  const target = new Map([
    [
      'workbuddy-api',
      {
        facts: {
          apiKeyEnv: 'WORKBUDDY_API_API_KEY',
          api: 'openai-completions',
          baseURL: 'http://121.40.169.141:7863/v1',
          displayName: 'WorkBuddy API',
        },
        models: new Map([['cn:auto', { id: 'cn:auto', contextWindow: 999 }]]),
      },
    ],
  ]);
  const result = buildExport({
    catalog: catalogOf([workbuddy]),
    selection: [{ id: 'workbuddy-api', models: ['cn:auto'] }],
    target,
  });
  assert.deepEqual(result.renames.map((rename) => rename.to), ['cn:auto-2']);
  assert.match(result.yaml, /- id: "cn:auto-2"/);
});

test('buildExport: mode off keeps every name as typed', () => {
  const target = new Map([['workbuddy-api', { facts: { baseURL: 'http://old/v1' }, models: new Map() }]]);
  const result = buildExport({
    catalog: catalogOf([workbuddy]),
    selection: [{ id: 'workbuddy-api', models: ['cn:auto'] }],
    target,
    options: { mode: 'off' },
  });
  assert.deepEqual(result.providerIds, ['workbuddy-api']);
  assert.deepEqual(result.renames, []);
});

test('buildExport: two providers export side by side in selection order', () => {
  const result = buildExport({
    catalog: catalogOf([workbuddy, relay]),
    selection: [{ id: 'relay', models: null }, { id: 'workbuddy-api', models: ['cn:hy3'] }],
  });
  assert.deepEqual(result.providerIds, ['relay', 'workbuddy-api']);
  const routes = Object.keys(JSON.parse(result.json).patch[0].config.providers);
  assert.deepEqual(routes, ['relay', 'workbuddy-api']);
});

test('buildExport: requested secrets are described as commented environment lines', () => {
  const result = buildExport({
    catalog: catalogOf([workbuddy]),
    selection: [{ id: 'workbuddy-api', models: ['cn:auto'] }],
    options: { secretRequested: true, secrets: { WORKBUDDY_API_API_KEY: 'sk-test' } },
  });
  assert.match(result.yaml, /#   WORKBUDDY_API_API_KEY=sk-test/);
  /* a secret never becomes a config field */
  assert.ok(!result.yaml.includes('apiKey: sk-test'));
  assert.equal(JSON.parse(result.json).meta.secretsIncluded, true);
});

test('buildExport: mode always suffixes every provider id, even when nothing collides', () => {
  const result = buildExport({
    catalog: catalogOf([relay]),
    selection: [{ id: 'relay', models: null }],
    options: { mode: 'always' },
  });
  assert.deepEqual(result.providerIds, ['relay-2']);
  assert.equal(JSON.parse(result.json).meta.naming, 'always');
  assert.match(result.yaml, /^ {6}relay-2:$/m);
  /* a renamed provider is a new route, so its models keep their ids */
  assert.match(result.yaml, /- id: claude-x/);
});

test('buildExport: refuses an empty selection instead of writing an empty patch', () => {
  assert.throws(
    () => buildExport({ catalog: catalogOf([workbuddy]), selection: [] }),
    /nothing to export/,
  );
});

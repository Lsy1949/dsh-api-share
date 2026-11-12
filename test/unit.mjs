/**
 * Unit tests for the two pure host modules (no harness needed).
 *   node --test test/unit.mjs
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { toYaml } from '../lib/host/yaml.js';
import { resolveNames, freeName, stableKey, sameFacts } from '../lib/host/naming.js';

test('yaml: writes the patch row shape cordis.patch.yml uses', () => {
  const entry = {
    id: 'llm-pi-ai',
    name: '@deepseek-ai/dsh-llm-pi-ai',
    config: {
      providers: {
        'workbuddy-api': {
          apiKeyEnv: 'WORKBUDDY_API_API_KEY',
          api: 'openai-completions',
          baseURL: 'http://121.40.169.141:7863/v1',
          models: [
            {
              id: 'cn:deepseek-v4.1-flash',
              name: 'Deepseek-V4.1-Flash',
              contextWindow: 1000000,
              maxTokens: 393216,
              input: ['text', 'image'],
              reasoningEfforts: { off: null, low: 'low', high: 'high' },
            },
            { id: 'cn:hy3', contextWindow: 192000 },
          ],
        },
      },
    },
  };
  const text = toYaml([entry]);
  assert.equal(
    text,
    [
      '- id: llm-pi-ai',
      '  name: "@deepseek-ai/dsh-llm-pi-ai"',
      '  config:',
      '    providers:',
      '      workbuddy-api:',
      '        apiKeyEnv: WORKBUDDY_API_API_KEY',
      '        api: openai-completions',
      '        baseURL: http://121.40.169.141:7863/v1',
      '        models:',
      '          - id: "cn:deepseek-v4.1-flash"',
      '            name: Deepseek-V4.1-Flash',
      '            contextWindow: 1000000',
      '            maxTokens: 393216',
      '            input: [text, image]',
      '            reasoningEfforts:',
      '              off: null',
      '              low: low',
      '              high: high',
      '          - id: "cn:hy3"',
      '            contextWindow: 192000',
      '',
    ].join('\n'),
  );
});

test('yaml: quotes what YAML would otherwise read back as something else', () => {
  const text = toYaml({ a: '', b: 'true', c: '1.5', d: 'has space', e: 'x #y', f: 'plain-id' });
  assert.match(text, /a: ""/);
  assert.match(text, /b: "true"/);
  assert.match(text, /c: "1\.5"/);
  assert.match(text, /d: "has space"/);
  assert.match(text, /e: "x #y"/);
  assert.match(text, /f: plain-id/);
});

test('yaml: empty collections and inline arrays', () => {
  assert.equal(toYaml({ a: [], b: {}, c: [1, 2, 3] }), 'a: []\nb: {}\nc: [1, 2, 3]\n');
});

test('yaml: nested sequence of mappings keeps the dash on the first key', () => {
  assert.equal(toYaml({ list: [{ a: 1, b: 2 }, { a: 3 }] }), 'list:\n  - a: 1\n    b: 2\n  - a: 3\n');
});

test('naming: an empty target renames nothing', () => {
  const selection = [
    { id: 'route', facts: { api: 'openai-completions', baseURL: 'http://x/v1' }, models: [{ id: 'm1', payload: { id: 'm1' } }] },
  ];
  const result = resolveNames({ providers: selection, target: new Map() });
  assert.deepEqual(result.renames, []);
  assert.equal(result.providers[0].id, 'route');
  assert.equal(result.providers[0].models[0].id, 'm1');
});

test('naming: identical facts keep the id and are reported as identical', () => {
  const facts = { api: 'openai-completions', baseURL: 'http://x/v1', apiKeyEnv: 'X_KEY' };
  const selection = [{ id: 'route', facts, models: [{ id: 'm1', payload: { id: 'm1' } }] }];
  const target = new Map([['route', { facts, models: new Map([['m1', { id: 'm1' }]]) }]]);
  const result = resolveNames({ providers: selection, target });
  assert.deepEqual(result.renames, []);
  assert.deepEqual(result.identical, ['route']);
  assert.equal(result.providers[0].id, 'route');
});

test('naming: a same-id provider with different connection is renamed', () => {
  const selection = [
    { id: 'route', facts: { baseURL: 'http://new/v1' }, models: [{ id: 'm1', payload: {} }] },
  ];
  const target = new Map([['route', { facts: { baseURL: 'http://old/v1' }, models: new Map() }]]);
  const result = resolveNames({ providers: selection, target });
  assert.equal(result.providers[0].id, 'route-2');
  assert.deepEqual(result.renames, [
    {
      kind: 'provider',
      provider: 'route',
      from: 'route',
      to: 'route-2',
      reason: 'receiving side already has a provider with this id and a different connection',
    },
  ]);
  /* a renamed provider is a new route: its models keep their ids */
  assert.equal(result.providers[0].models[0].id, 'm1');
});

test('naming: a colliding model id with a different payload is renamed inside the provider', () => {
  const facts = { baseURL: 'http://x/v1' };
  const selection = [
    {
      id: 'route',
      facts,
      models: [
        { id: 'm1', payload: { id: 'm1', contextWindow: 1000 } },
        { id: 'm2', payload: { id: 'm2' } },
      ],
    },
  ];
  const target = new Map([
    ['route', { facts, models: new Map([['m1', { id: 'm1', contextWindow: 2000 }]]) }],
  ]);
  const result = resolveNames({ providers: selection, target });
  assert.equal(result.providers[0].id, 'route');
  assert.deepEqual(result.providers[0].models.map((model) => model.id), ['m1-2', 'm2']);
  assert.equal(result.renames.length, 1);
  assert.equal(result.renames[0].kind, 'model');
  assert.equal(result.renames[0].from, 'm1');
  assert.equal(result.renames[0].to, 'm1-2');
});

test('naming: suffixes escalate and never collide', () => {
  const taken = new Set(['a', 'a-2', 'a-3']);
  assert.equal(freeName('a', taken), 'a-4');
  assert.equal(freeName('b', taken), 'b');
});

test('naming: mode off keeps every name', () => {
  const selection = [{ id: 'route', facts: { baseURL: 'http://new/v1' }, models: [{ id: 'm1', payload: {} }] }];
  const target = new Map([['route', { facts: { baseURL: 'http://old/v1' }, models: new Map() }]]);
  const result = resolveNames({ providers: selection, target, options: { mode: 'off' } });
  assert.equal(result.providers[0].id, 'route');
  assert.deepEqual(result.renames, []);
});

test('naming: fact comparison ignores empty values', () => {
  assert.equal(sameFacts({ api: 'openai-completions' }, { api: 'openai-completions', baseURL: '' }), true);
  assert.equal(sameFacts({ api: 'openai-completions' }, { api: 'anthropic-messages' }), false);
  assert.equal(stableKey({ b: 1, a: [1, { d: 2, c: 3 }] }), '{"a":[1,{"c":3,"d":2}],"b":1}');
});

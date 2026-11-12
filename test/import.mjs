/**
 * Import tests: the YAML reader, snippet intake, and the planning policy.
 * All pure — no harness, no filesystem.
 *   node test/import.mjs
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseYaml, YamlError } from '../lib/host/yaml-parse.js';
import { parseSnippet, planImport, planChanges, IMPORT_POLICIES } from '../lib/host/importer.js';

const SNIPPET = [
  '# dsh-api-share — 导出的模型配置 / exported model configuration',
  '# 生成时间 / generated: 2026-11-12T00:00:00.000Z',
  '- id: llm-pi-ai',
  '  name: "@deepseek-ai/dsh-llm-pi-ai"',
  '  config:',
  '    providers:',
  '      relay:',
  '        apiKeyEnv: RELAY_API_KEY',
  '        api: anthropic-messages',
  '        baseURL: http://relay.example',
  '        models:',
  '          - id: "claude-x"',
  '            name: Claude X',
  '            contextWindow: 200000',
  '            maxTokens: 64000',
  '            input: [text, image]',
  '            reasoningEfforts:',
  '              off: null',
  '              low: low',
  '',
].join('\n');

test('yaml: reads the snippet this plugin writes', () => {
  const parsed = parseYaml(SNIPPET);
  /* Comments are dropped, leaving the single patch entry. */
  assert.equal(parsed.length, 1);
  const entry = parsed[0];
  assert.equal(entry.id, 'llm-pi-ai');
  assert.equal(entry.name, '@deepseek-ai/dsh-llm-pi-ai');
  assert.equal(entry.config.providers.relay.baseURL, 'http://relay.example');
  assert.deepEqual(entry.config.providers.relay.models[0].input, ['text', 'image']);
  assert.deepEqual(entry.config.providers.relay.models[0].reasoningEfforts, { off: null, low: 'low' });
  assert.equal(entry.config.providers.relay.models[0].contextWindow, 200000);
});

test('yaml: scalars, quoting and empties', () => {
  const parsed = parseYaml(
    ['a: null', 'b: ~', 'c: true', 'd: false', 'e: 1.5', 'f: -3', 'g: "x # not a comment"', "h: 'it''s'", 'i: []', 'j: {}', 'k: plain with spaces'].join('\n'),
  );
  assert.equal(parsed.a, null);
  assert.equal(parsed.b, null);
  assert.equal(parsed.c, true);
  assert.equal(parsed.d, false);
  assert.equal(parsed.e, 1.5);
  assert.equal(parsed.f, -3);
  assert.equal(parsed.g, 'x # not a comment');
  assert.equal(parsed.h, "it's");
  assert.deepEqual(parsed.i, []);
  assert.deepEqual(parsed.j, {});
  assert.equal(parsed.k, 'plain with spaces');
});

test('yaml: a comment after a value is stripped, one inside quotes is not', () => {
  const parsed = parseYaml('url: http://x/v1 # endpoint\nlabel: "a # b"');
  assert.equal(parsed.url, 'http://x/v1');
  assert.equal(parsed.label, 'a # b');
});

test('yaml: nested sequences of mappings keep their alignment', () => {
  const parsed = parseYaml(['list:', '  - a: 1', '    b: 2', '  - a: 3'].join('\n'));
  assert.deepEqual(parsed.list, [{ a: 1, b: 2 }, { a: 3 }]);
});

test('yaml: a block value under a sequence dash is read', () => {
  const parsed = parseYaml(['- key:', '    nested: 1'].join('\n'));
  assert.deepEqual(parsed, [{ key: { nested: 1 } }]);
});

test('yaml: refusal is explicit, with the offending line', () => {
  assert.throws(() => parseYaml('\t- id: x'), (error) => error instanceof YamlError && /tabs/.test(error.message));
  assert.throws(() => parseYaml('a: 1\na: 2'), /duplicate key "a"/);
  assert.throws(() => parseYaml('a: {b: 1}'), /inline mappings are not supported/);
  assert.throws(() => parseYaml('a: [1, 2'), /unterminated inline sequence/);
  assert.throws(() => parseYaml(''), /empty/);
  assert.throws(() => parseYaml('a: 1\n   b: 2'), /unexpected indentation/);
});

test('snippet: the JSON document is accepted and its patch is read', () => {
  const document = {
    format: 'dsh-api-share/v1',
    patch: [{ id: 'llm-pi-ai', name: '@deepseek-ai/dsh-llm-pi-ai', config: { providers: { relay: { api: 'openai-completions', baseURL: 'http://x', models: [{ id: 'm' }] } } } }],
  };
  const result = parseSnippet(JSON.stringify(document));
  assert.equal(result.format, 'json');
  assert.equal(result.rows.length, 1);
  assert.deepEqual(Object.keys(result.rows[0].providers), ['relay']);
});

test('snippet: YAML, a bare patch array, and a single row are all accepted', () => {
  assert.equal(parseSnippet(SNIPPET).format, 'yaml');
  const bare = parseSnippet('- id: llm-pi-ai\n  config:\n    providers:\n      a:\n        api: openai-completions\n');
  assert.deepEqual(Object.keys(bare.rows[0].providers), ['a']);
  const single = parseSnippet('{ "id": "llm-pi-ai", "config": { "providers": { "b": { "api": "openai-completions" } } } }');
  assert.deepEqual(Object.keys(single.rows[0].providers), ['b']);
});

test('snippet: another plugin row, an empty body and junk are refused', () => {
  assert.throws(() => parseSnippet(''), /empty/);
  assert.throws(() => parseSnippet('hello'), /could not be read/);
  assert.throws(() => parseSnippet('{"a":1}'), /no provider configuration found/);
  assert.throws(() => parseSnippet('[]'), /no provider configuration found/);
  assert.throws(() => parseSnippet('{ bad json'), /not valid JSON/);
  assert.throws(
    () => parseSnippet(JSON.stringify({ patch: [{ id: 'llm-deepseek', name: '@deepseek-ai/dsh-llm-deepseek', config: { providers: { x: {} } } }] })),
    /no provider configuration found/,
  );
});

const currentProviders = {
  relay: { apiKeyEnv: 'RELAY_API_KEY', api: 'anthropic-messages', baseURL: 'http://old.example', models: [{ id: 'claude-x' }] },
};

/** @param {string} policy */
function plan(policy) {
  const parsed = parseSnippet(SNIPPET);
  return planImport({ rows: parsed.rows, current: currentProviders, policy: /** @type {any} */ (policy) });
}

test('plan: merge gives a colliding provider its own id and keeps the existing one', () => {
  const result = plan('merge');
  assert.deepEqual(result.summary, { create: 0, rename: 1, update: 0, unchanged: 0, skip: 0, invalid: 0 });
  assert.equal(result.entries[0].to, 'relay-2');
  assert.equal(result.next.relay.baseURL, 'http://old.example', 'the existing provider is untouched');
  assert.equal(result.next['relay-2'].baseURL, 'http://relay.example');
  assert.equal(planChanges(result), true);
});

test('plan: skip leaves the collision alone and creates nothing', () => {
  const result = plan('skip');
  assert.equal(result.entries[0].action, 'skip');
  assert.deepEqual(Object.keys(result.next), ['relay']);
  assert.equal(planChanges(result), false);
});

test('plan: overwrite replaces the provider wholesale', () => {
  const result = plan('overwrite');
  assert.equal(result.entries[0].action, 'update');
  assert.equal(result.next.relay.baseURL, 'http://relay.example');
  assert.equal(planChanges(result), true);
});

test('plan: an identical provider is unchanged, whatever the policy', () => {
  for (const policy of IMPORT_POLICIES) {
    const parsed = parseSnippet(SNIPPET);
    const same = planImport({ rows: parsed.rows, current: { relay: parsed.rows[0].providers.relay }, policy });
    assert.deepEqual(same.summary, { create: 0, rename: 0, update: 0, unchanged: 1, skip: 0, invalid: 0 }, policy);
    assert.equal(planChanges(same), false);
  }
});

test('plan: a new provider is created, and a catalog-served one is flagged', () => {
  const parsed = parseSnippet('- id: llm-pi-ai\n  config:\n    providers:\n      openrouter:\n        apiKeyEnv: OPENROUTER_API_KEY\n');
  const result = planImport({ rows: parsed.rows, current: {}, policy: 'merge' });
  assert.equal(result.summary.create, 1);
  assert.equal(result.next.openrouter.apiKeyEnv, 'OPENROUTER_API_KEY');
  assert.ok(result.warnings.some((warning) => warning.includes('内置 provider')), 'a snippet with no endpoint facts warns');
});

test('plan: unknown fields and duplicate models are dropped, not written', () => {
  const parsed = parseSnippet(
    [
      '- id: llm-pi-ai',
      '  config:',
      '    providers:',
      '      relay:',
      '        api: openai-completions',
      '        baseURL: http://x',
      '        secretSauce: nope',
      '        models:',
      '          - id: m1',
      '            bogus: 1',
      '          - id: m1',
      '',
    ].join('\n'),
  );
  const result = planImport({ rows: parsed.rows, current: {}, policy: 'merge' });
  const relay = result.next.relay;
  assert.equal(relay.secretSauce, undefined);
  assert.equal(relay.models.length, 1);
  assert.equal(relay.models[0].bogus, undefined);
  assert.ok(result.warnings.some((warning) => warning.includes('secretSauce')));
  assert.ok(result.warnings.some((warning) => warning.includes('duplicate model')));
});

test('plan: an unusable profile is reported instead of written', () => {
  const parsed = parseSnippet('- id: llm-pi-ai\n  config:\n    providers:\n      "  ":\n        api: openai-completions\n');
  const result = planImport({ rows: parsed.rows, current: {}, policy: 'merge' });
  assert.equal(result.summary.invalid, 1);
  assert.equal(result.entries[0].action, 'invalid');
});

test('plan: a !!js expression anywhere in the payload is dropped, never written', () => {
  const text = JSON.stringify({
    patch: [
      {
        id: 'llm-pi-ai',
        name: '@deepseek-ai/dsh-llm-pi-ai',
        config: {
          providers: {
            relay: {
              api: 'openai-completions',
              baseURL: 'http://x',
              headers: { 'x-team': { __jsExpr: 'process.exit(1)' } },
              models: [{ id: 'm', compat: { deep: { __jsExpr: 'require("fs")' } } }],
            },
          },
        },
      },
    ],
  });
  const parsed = parseSnippet(text);
  const result = planImport({ rows: parsed.rows, current: {}, policy: 'merge' });
  const relay = result.next.relay;
  /* An expression would come back as a `!!js` node that the Loader evaluates, so
     nothing below may survive the sanitiser. */
  assert.deepEqual(relay.headers, {});
  assert.deepEqual(relay.models[0].compat, {});
  assert.ok(result.warnings.some((warning) => /!!js expression/.test(warning)), 'the drop is reported');
});

test('plan: a provider whose value is an expression is invalid, not imported', () => {
  const text = JSON.stringify({
    patch: [{ id: 'llm-pi-ai', name: '@deepseek-ai/dsh-llm-pi-ai', config: { providers: { relay: { __jsExpr: 'boom()' } } } }],
  });
  const parsed = parseSnippet(text);
  const result = planImport({ rows: parsed.rows, current: {}, policy: 'merge' });
  assert.equal(result.summary.invalid, 1);
  assert.equal(result.next.relay, undefined);
});

test('plan: three colliding providers each get a distinct suffix', () => {
  const rows = [
    {
      id: 'llm-pi-ai',
      providers: {
        relay: { api: 'openai-completions', baseURL: 'http://one', models: [{ id: 'a' }] },
      },
    },
  ];
  const first = planImport({ rows, current: { relay: { api: 'openai-completions', baseURL: 'http://zero' }, 'relay-2': {} }, policy: 'merge' });
  assert.equal(first.entries[0].to, 'relay-3');
});

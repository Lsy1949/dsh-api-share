/**
 * Write-path tests: locating the pi-ai row, and handing a merged provider
 * dictionary to `configEditor.edit()` — the call that validates, locks and rolls
 * back. Everything here runs against a fake editor, so no profile is touched.
 *   node test/write.mjs
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { readProviderRow, writeProviders, canWrite, validateProviders, verifyProviders, WriteError } from '../lib/host/write.js';

/**
 * A fake `configEditor`: `configuration()` reports rows, `edit()` records the
 * change function and applies it the way the real one does.
 *
 * @param {object} [options]
 */
function fakeEditor(options = {}) {
  const calls = [];
  const row = {
    entry: {
      options: { id: 'llm-pi-ai', name: '@deepseek-ai/dsh-llm-pi-ai', config: options.config ?? { providers: {} } },
      fiber: options.fiber,
    },
    inherited: {},
    override: options.override ?? { providers: {} },
  };
  return {
    calls,
    configuration() {
      if (options.throws === true) throw new Error('configuration is not readable');
      return options.rows ?? [row];
    },
    async edit(entry, change) {
      calls.push({ entry, change });
      if (options.editThrows !== undefined) throw new Error(options.editThrows);
      return undefined;
    },
  };
}

/** @param {any} editor */
function ctxWith(editor) {
  return { get: (name) => (name === 'configEditor' ? editor : undefined) };
}

test('row: the pi-ai row is found by package name', () => {
  const editor = fakeEditor({ override: { providers: { relay: { api: 'openai-completions' } } } });
  const row = readProviderRow(ctxWith(editor));
  assert.equal(row.ns, 'llm-pi-ai');
  assert.deepEqual(Object.keys(row.providers), ['relay']);
});

test('row: a namespace filter selects the right mount when pi-ai is mounted twice', () => {
  const editor = fakeEditor({
    rows: [
      { entry: { options: { id: 'a-pi-ai', name: '@deepseek-ai/dsh-llm-pi-ai' } }, inherited: {}, override: { providers: { one: {} } } },
      { entry: { options: { id: 'b-pi-ai', name: '@deepseek-ai/dsh-llm-pi-ai' } }, inherited: {}, override: { providers: { two: {} } } },
    ],
  });
  const row = readProviderRow(ctxWith(editor), 'b-pi-ai');
  assert.equal(row.ns, 'b-pi-ai');
  assert.deepEqual(Object.keys(row.providers), ['two']);
});

test('row: another adapter is never mistaken for pi-ai', () => {
  const editor = fakeEditor({
    rows: [{ entry: { options: { id: 'llm-xdpool', name: 'dsh-xdpool' } }, inherited: {}, override: { providers: { x: {} } } }],
  });
  assert.equal(readProviderRow(ctxWith(editor)), null);
  assert.equal(canWrite(ctxWith(editor)), false);
});

test('row: a missing or unreadable editor is reported, not thrown', () => {
  assert.equal(readProviderRow({ get: () => undefined }), null);
  assert.equal(readProviderRow({ get: () => fakeEditor({ throws: true }) }), null);
  assert.equal(canWrite({ get: () => undefined }), false);
  assert.equal(canWrite({ get: () => fakeEditor() }), true);
});

test('write: the change keeps the rest of the row and replaces only providers', async () => {
  const editor = fakeEditor();
  const current = { providers: { old: { api: 'openai-completions' } }, retry: { attempts: 3 } };
  const change = await captureChange(editor, current, { next: {} });
  assert.deepEqual(change.providers, { next: {} });
  assert.deepEqual(change.retry, { attempts: 3 }, 'fields the import does not own survive');
});

test('write: the row entry itself is handed to edit(), so it edits the right row', async () => {
  const editor = fakeEditor();
  await writeProviders(ctxWith(editor), { relay: {} });
  assert.equal(editor.calls.length, 1);
  assert.equal(editor.calls[0].entry.options.id, 'llm-pi-ai');
});

test('write: no editor is a typed failure, not a thrown string', async () => {
  await assert.rejects(() => writeProviders({ get: () => undefined }, {}), (error) => {
    assert.ok(error instanceof WriteError);
    assert.equal(error.code, 'write-unavailable');
    return true;
  });
});

test('write: a stale entry is reported with its own code', async () => {
  const editor = fakeEditor({ editThrows: 'Configuration entry is no longer available' });
  await assert.rejects(() => writeProviders(ctxWith(editor), {}), (error) => {
    assert.equal(error.code, 'stale-entry');
    assert.match(error.message, /reopen the dialog/);
    return true;
  });
});

test('write: an override by a home patch is reported with its own code', async () => {
  const editor = fakeEditor({ editThrows: 'Configuration for "llm-pi-ai" is overridden by a home patch or command-line overlay' });
  await assert.rejects(() => writeProviders(ctxWith(editor), {}), (error) => error.code === 'overridden');
});

test('write: a schema refusal surfaces the adapter message', async () => {
  const editor = fakeEditor({ editThrows: 'llm-pi-ai: provider "relay" has an empty baseURL' });
  await assert.rejects(() => writeProviders(ctxWith(editor), { relay: {} }), (error) => {
    assert.equal(error.code, 'refused');
    assert.match(error.message, /empty baseURL/);
    return true;
  });
});

test('write: a non-object payload is refused before touching the editor', async () => {
  const editor = fakeEditor();
  await assert.rejects(() => writeProviders(ctxWith(editor), /** @type {any} */ (null)), (error) => error.code === 'invalid-providers');
  assert.equal(editor.calls.length, 0);
});

test('validate: the adapter gate runs without publishing, and reports its refusal', () => {
  const ok = fakeEditor({ fiber: { resolveConfig: () => ({}) } });
  assert.deepEqual(validateProviders(ctxWith(ok), { relay: {} }), { checked: true, error: '' });

  const bad = fakeEditor({
    fiber: {
      resolveConfig() {
        throw new Error('llm-pi-ai: provider "relay" has an empty baseURL');
      },
    },
  });
  const result = validateProviders(ctxWith(bad), { relay: {} });
  assert.equal(result.checked, true);
  assert.match(result.error, /empty baseURL/);
});

test('validate: without a fiber the check is skipped rather than guessed', () => {
  const result = validateProviders(ctxWith(fakeEditor()), { relay: {} });
  assert.deepEqual(result, { checked: false, error: '' });
});

test('write: an invalid candidate fails before the lock is taken', async () => {
  const editor = fakeEditor({
    fiber: {
      resolveConfig() {
        throw new Error('invalid config: providers.relay.api');
      },
    },
  });
  await assert.rejects(() => writeProviders(ctxWith(editor), { relay: {} }), (error) => error.code === 'invalid-config');
  assert.equal(editor.calls.length, 0, 'edit() is never called for a candidate the adapter refuses');
});

test('verify: a route the adapter never registered is reported, because pi-ai only logs collisions', async () => {
  const editor = fakeEditor({
    fiber: { resolveConfig: () => ({}) },
    override: { providers: {} },
  });
  const ctx = {
    get: (name) => {
      if (name === 'configEditor') return editor;
      if (name === 'llm') return { listProviders: () => [{ id: 'relay', name: 'Relay' }] };
      return undefined;
    },
  };
  const result = await writeProviders(ctx, { relay: {}, ghost: {} }, undefined, { routes: ['relay', 'ghost'] });
  assert.deepEqual(result.missing, ['ghost']);
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0], /ghost/);
});

test('verify: with no registry the write still succeeds, just without the extra check', async () => {
  const editor = fakeEditor({ fiber: { resolveConfig: () => ({}) } });
  const result = await writeProviders(ctxWith(editor), { relay: {} }, undefined, { routes: ['relay'] });
  assert.deepEqual(result.missing, []);
  assert.deepEqual(result.warnings, []);
});

/**
 * Run `writeProviders` against a fake editor that evaluates the change with a
 * given current value, and return what the change produced.
 * @param {any} editor
 * @param {any} current
 * @param {Record<string, unknown>} next
 */
async function captureChange(editor, current, next) {
  let produced = null;
  editor.edit = async (entry, change) => {
    produced = change(current);
  };
  await writeProviders({ get: () => editor }, next);
  return produced;
}

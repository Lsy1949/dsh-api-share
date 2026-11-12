/**
 * Client-half smoke test: runs the browser bundle the way the module loader
 * does — inside a fake `window.__ModuleLoader__`, with a stub `react` — and
 * checks that it activates, registers into the Models footer slot, and renders
 * without throwing. No browser, no jsdom.
 *   node test/client.mjs
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, '..', 'client.js'), 'utf8');

/**
 * A React stand-in that is just enough for this component: hooks return the
 * initial value and a no-op setter, elements are plain descriptors, and the
 * class base used by the error boundary is a minimal stub.
 */
function stubReact() {
  const elements = [];
  class Component {
    constructor(props) {
      this.props = props;
      this.state = {};
    }
  }
  return {
    elements,
    api: {
      createElement(type, props, ...children) {
        const element = {
          type,
          props: props ?? {},
          children: children.flat().filter((child) => child !== null && child !== undefined && child !== false),
        };
        elements.push(element);
        return element;
      },
      useState(initial) {
        const value = typeof initial === 'function' ? initial() : initial;
        return [value, () => {}];
      },
      useEffect() {},
      useMemo(factory) {
        return factory();
      },
      useCallback(fn) {
        return fn;
      },
      useRef(initial) {
        return { current: initial ?? null };
      },
      Component,
    },
  };
}

/** Everything the bundle logged through the stub console. */
const warnings = [];

/** Load the bundle and hand back its factory exports. */
function loadBundle() {
  let factory = null;
  const sandbox = {
    window: {
      __ModuleLoader__: {
        load(options) {
          factory = options.factory;
          assert.equal(options.id, 'dsh-api-share', 'the factory id must equal the package name');
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
    /* The bundle warns on purpose when a surface is missing; keep the test quiet
       and record what it said instead. */
    console: { log() {}, warn: (...args) => warnings.push(args.join(' ')), error: (...args) => warnings.push(args.join(' ')) },
    setTimeout,
    clearTimeout,
    fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) }),
    URL: { createObjectURL: () => 'blob:x', revokeObjectURL() {} },
    Blob: class {},
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: 'client.js' });
  assert.ok(factory !== null, 'the bundle must register itself with the module loader');

  return {
    warnings,
    exports: factory((name) => {
      assert.equal(name, 'react', `the bundle may only require the platform table, got "${name}"`);
      return stubReactApi;
    }),
  };
}

/** Captured from the last loadBundle() so both helpers see the same stubs. */
let stubReactApi = null;

/** Load the bundle with a fresh React stub. */
function load() {
  const react = stubReact();
  stubReactApi = react.api;
  const bundle = loadBundle();
  return { exports: bundle.exports, react };
}

/**
 * Render an element tree to a flat list of text, calling function components
 * the way React would. Hooks are the stub's, so state stays at its initial value.
 * @param {any} node
 * @returns {string[]}
 */
function texts(node) {
  if (node === null || node === undefined || node === false) return [];
  if (typeof node === 'string' || typeof node === 'number') return [String(node)];
  if (Array.isArray(node)) return node.flatMap(texts);
  if (typeof node === 'object' && typeof node.type === 'function') {
    const instance = new node.type(node.props ?? {});
    const rendered = typeof instance.render === 'function' ? instance.render() : node.type(node.props ?? {});
    return texts(rendered);
  }
  return [...texts(node.children ?? []), ...texts(node.props?.children)];
}

/** Apply the bundle to a recording context and return what it registered. */
function activate(exports) {
  const injections = [];
  const registrations = [];
  const ctx = {
    get: () => undefined,
    effect: (fn) => {
      if (typeof fn === 'function') fn();
    },
    slots: {
      inject(name, callback) {
        injections.push(name);
        return callback();
      },
      register(options, component) {
        registrations.push({ options, component });
        return () => {};
      },
      entries: () => [],
    },
  };
  exports.apply(ctx);
  return { injections, registrations };
}

test('client: the bundle declares only the slots service', () => {
  const { exports } = load();
  /* The array is built inside the vm realm, so compare its contents, not its prototype. */
  assert.equal(exports.inject.length, 1);
  assert.equal(exports.inject[0], 'slots');
  assert.equal(typeof exports.apply, 'function');
});

test('client: apply registers one entry into settings.models.footer', () => {
  const { exports } = load();
  const { injections, registrations } = activate(exports);
  assert.deepEqual(injections, ['settings.models.footer']);
  assert.equal(registrations.length, 1);
  assert.equal(registrations[0].options.name, 'settings.models.footer');
  assert.equal(registrations[0].options.id, 'dsh-api-share.footer');
  assert.equal(registrations[0].options.order, 100);
  assert.equal(typeof registrations[0].component, 'function');
});

test('client: a missing slots service never throws out of apply', () => {
  const { exports } = load();
  assert.doesNotThrow(() => exports.apply({ get: () => undefined, effect: () => {} }));
});

test('client: the footer renders its button and keeps the dialog closed', () => {
  const { exports, react } = load();
  const { registrations } = activate(exports);
  const Footer = registrations[0].component;
  const rendered = texts({ type: Footer, props: {} });
  assert.ok(rendered.some((text) => text.includes('导出配置')), 'the button label must be present');
  assert.ok(!rendered.some((text) => text.includes('导出模型配置')), 'the dialog stays closed until the button is used');
  assert.ok(react.elements.length > 0, 'the footer must produce elements');
});

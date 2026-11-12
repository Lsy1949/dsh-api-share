/**
 * A miniature renderer for the client bundle's tests.
 *
 * The plugin's client half is a plain CJS factory that talks to `react` through
 * the platform table. This module implements just enough of React — function
 * components, `useState` / `useEffect` / `useMemo` / `useCallback` / `useRef`,
 * a class component for the error boundary — to mount a surface, click it, type
 * into it, and read back the text a user would see. No browser, no jsdom.
 */

/** Compare hook dependency arrays. */
function sameDeps(left, right) {
  if (left === undefined || right === undefined) return false;
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (!Object.is(left[index], right[index])) return false;
  }
  return true;
}

/**
 * Create a React surface: the `react` module handed to the bundle, plus helpers
 * to mount, interact and inspect.
 *
 * @param {{ fetch?: (path: string, body: any) => any }} [options]
 */
export function createSurface(options = {}) {
  /** @type {Map<string, any[]>} hook cells per component instance path */
  const instances = new Map();
  let rendering = { path: '', cursor: 0, effects: [] };
  let dirty = false;
  let root = null;
  let rootComponent = null;
  let rootProps = null;

  function schedule() {
    dirty = true;
  }

  function cellsFor(path) {
    let cells = instances.get(path);
    if (cells === undefined) {
      cells = [];
      instances.set(path, cells);
    }
    return cells;
  }

  const hooks = {
    useState(initial) {
      const cells = cellsFor(rendering.path);
      const index = rendering.cursor;
      rendering.cursor += 1;
      if (cells[index] === undefined) {
        cells[index] = { value: typeof initial === 'function' ? initial() : initial };
      }
      const cell = cells[index];
      return [
        cell.value,
        (next) => {
          const value = typeof next === 'function' ? next(cell.value) : next;
          if (Object.is(value, cell.value)) return;
          cell.value = value;
          schedule();
        },
      ];
    },
    useEffect(fn, deps) {
      const cells = cellsFor(rendering.path);
      const index = rendering.cursor;
      rendering.cursor += 1;
      const previous = cells[index];
      if (previous === undefined || !sameDeps(previous.deps, deps)) {
        cells[index] = { deps: deps === undefined ? undefined : deps.slice() };
        rendering.effects.push(fn);
      }
    },
    useMemo(factory, deps) {
      const cells = cellsFor(rendering.path);
      const index = rendering.cursor;
      rendering.cursor += 1;
      const previous = cells[index];
      if (previous === undefined || !sameDeps(previous.deps, deps)) {
        cells[index] = { deps: deps === undefined ? undefined : deps.slice(), value: factory() };
      }
      return cells[index].value;
    },
    useCallback(fn, deps) {
      const cells = cellsFor(rendering.path);
      const index = rendering.cursor;
      rendering.cursor += 1;
      const previous = cells[index];
      if (previous === undefined || !sameDeps(previous.deps, deps)) {
        cells[index] = { deps: deps === undefined ? undefined : deps.slice(), value: fn };
      }
      return cells[index].value;
    },
    useRef(initial) {
      const cells = cellsFor(rendering.path);
      const index = rendering.cursor;
      rendering.cursor += 1;
      if (cells[index] === undefined) cells[index] = { current: initial === undefined ? null : initial };
      return cells[index];
    },
  };

  /** Minimal class base, enough for the bundle's error boundary. */
  class Component {
    constructor(props) {
      this.props = props;
      this.state = {};
    }
  }

  /**
   * @param {any} type
   * @param {any} props
   * @param {...any} children
   */
  function createElement(type, props, ...children) {
    const flat = children.flat(Infinity).filter((child) => child !== null && child !== undefined && child !== false);
    return { type, props: props === null || props === undefined ? {} : props, children: flat };
  }

  /** Stable id per component type, so two components never share hook cells. */
  const typeIds = new WeakMap();
  let nextTypeId = 0;
  function typeIdOf(type) {
    let id = typeIds.get(type);
    if (id === undefined) {
      nextTypeId += 1;
      id = nextTypeId;
      typeIds.set(type, id);
    }
    return id;
  }

  /**
   * Render one node.
   * @param {any} node
   * @param {string} path stable identity for hook storage
   * @returns {any}
   */
  function renderNode(node, path) {
    if (node === null || node === undefined || node === false) return null;
    if (typeof node === 'string' || typeof node === 'number') return String(node);
    if (Array.isArray(node)) return node.map((child, index) => renderNode(child, `${path}[${index}]`));
    if (typeof node.type === 'function') {
      /* The component identity belongs in the path: two different components can
         occupy the same child slot (the dialog swaps panels), and sharing hook
         cells across them would hand one component the other's state. */
      const ownPath = `${path}#${typeIdOf(node.type)}`;
      const owner = rendering;
      rendering = { path: ownPath, cursor: 0, effects: [] };
      let output;
      try {
        if (node.type.prototype?.render !== undefined) {
          const instance = new node.type(node.props);
          output = instance.render();
        } else {
          output = node.type(node.props);
        }
      } finally {
        const effects = rendering.effects;
        rendering = { path: owner.path, cursor: owner.cursor, effects: owner.effects };
        owner.effects.push(...effects);
      }
      return renderNode(output, ownPath);
    }
    const children = [];
    node.children.forEach((child, index) => {
      children.push(renderNode(child, `${path}.${index}`));
    });
    if (node.props !== undefined && node.props.children !== undefined) {
      children.push(renderNode(node.props.children, `${path}.props`));
    }
    return { type: node.type, props: node.props, children: children.flat(Infinity).filter((child) => child !== null) };
  }

  /**
   * Render the whole tree, then run the effects it asked for, repeating while
   * anything scheduled another render.
   */
  function render() {
    for (let pass = 0; pass < 25; pass += 1) {
      dirty = false;
      rendering = { path: '', cursor: 0, effects: [] };
      root = renderNode(createElement(rootComponent, rootProps), '');
      const effects = rendering.effects;
      rendering.effects = [];
      for (const effect of effects) {
        const cleanup = effect();
        if (typeof cleanup === 'function') {
          /* The plugin's effects are unsubscribe functions; the test surface
             keeps them so a later unmount could call them, but nothing here
             unmounts. */
        }
      }
      if (!dirty) break;
    }
    return root;
  }

  /**
   * Mount a component and return the surface handle.
   * @param {any} component
   * @param {any} [props]
   */
  function mount(component, props = {}) {
    rootComponent = component;
    rootProps = props;
    instances.clear();
    render();
    return handle;
  }

  /** Every text node in the tree, in order. */
  function textOf(node = root) {
    /** @type {string[]} */
    const out = [];
    const walk = (current) => {
      if (current === null || current === undefined) return;
      if (typeof current === 'string') {
        out.push(current);
        return;
      }
      if (Array.isArray(current)) {
        current.forEach(walk);
        return;
      }
      if (current.children !== undefined) current.children.forEach(walk);
    };
    walk(node);
    return out;
  }

  /** Every host element in the tree, in order. */
  function elementsOf(node = root) {
    /** @type {any[]} */
    const out = [];
    const walk = (current) => {
      if (current === null || current === undefined || typeof current === 'string') return;
      if (Array.isArray(current)) {
        current.forEach(walk);
        return;
      }
      out.push(current);
      (current.children ?? []).forEach(walk);
    };
    walk(node);
    return out;
  }

  /** Await pending promises and timers, then re-render. */
  async function flush(milliseconds = 400) {
    await new Promise((resolve) => setTimeout(resolve, milliseconds));
    return render();
  }

  const handle = {
    mount,
    render,
    flush,
    text: () => textOf().join(' '),
    /** The text content of one rendered element. */
    textOf: (node) => textOf(node).join(' '),
    texts: () => textOf(),
    elements: () => elementsOf(),
    /** All host elements whose type matches. */
    byType: (type) => elementsOf().filter((element) => element.type === type),
    /** The first element whose text content matches a pattern. */
    findByText: (pattern) => elementsOf().find((element) => textOf(element).join(' ').match(pattern) !== null),
    /** Click the first element matching a predicate over its text. */
    clickText: (pattern) => {
      const target = elementsOf().find((element) => {
        if (typeof element.props.onClick !== 'function') return false;
        return textOf(element).join(' ').match(pattern) !== null;
      });
      if (target === undefined) throw new Error(`no clickable element matching ${pattern}`);
      target.props.onClick({ preventDefault() {}, target: { value: '' } });
      return render();
    },
    /** Type into the first input/textarea whose props.onChange exists. */
    type: (target, value) => {
      if (typeof target.props.onChange !== 'function') throw new Error('that element has no onChange');
      target.props.onChange({ target: { value: value }, preventDefault() {} });
      return render();
    },
    react: { createElement, Component, ...hooks },
  };

  /* The bundle talks to the network through `fetch`; the tests substitute it. */
  handle.fetch = options.fetch;
  return handle;
}

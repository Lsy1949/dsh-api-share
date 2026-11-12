/**
 * dsh-api-share - dependency-free YAML emitter.
 *
 * Only the subset this plugin writes is supported: plain objects, arrays,
 * strings, finite numbers, booleans and null. That is deliberate - the plugin
 * ships no third-party parser/emitter, because a profile-installed plugin
 * cannot resolve packages that live inside the application archive.
 *
 * The output favours the shape `cordis.patch.yml` already uses: block mappings,
 * two-space indent, inline flow sequences for short scalar lists, one blank-free
 * line per field, `- ` for sequence items whose first mapping key stays on the
 * dash line.
 */

/** Words YAML would read as something other than a string. */
const RESERVED = new Set([
  'true', 'false', 'null', 'yes', 'no', 'on', 'off', 'y', 'n', '~',
  'True', 'False', 'Null', 'TRUE', 'FALSE', 'NULL', 'Yes', 'No', 'On', 'Off',
]);

/**
 * A bare scalar is safe when it is short, has no YAML metacharacters, does not
 * start with a reserved indicator (`@` and `` ` `` are reserved in YAML 1.2) and
 * carries no colon unless it is a URL scheme such as `http://`.
 */
const URL_LIKE = /^[a-z][a-z0-9+.-]*:\/\/[^\s]*$/i;

/**
 * Whether a string can be written without quotes.
 * @param {string} text
 * @param {boolean} asKey
 * @returns {boolean}
 */
function isPlain(text, asKey) {
  if (text.length === 0) return false;
  /* A reserved word as a *value* would come back as a boolean/null; as a key it
     keeps the plain spelling cordis.patch.yml already uses (`off: null`). */
  if (!asKey && RESERVED.has(text)) return false;
  /* 1.5 / 1e5 / -3 read back as numbers, not strings. */
  if (/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(text)) return false;
  /* A colon is only safe inside a URL: `cn:auto` and `a: b` both need quotes. */
  if (text.includes(':') && !URL_LIKE.test(text)) return false;
  if (text.includes(' #')) return false;
  return /^[A-Za-z0-9_./][A-Za-z0-9_./@:~+-]*$/.test(text);
}

/**
 * Quote a string for YAML, keeping the common case readable.
 * @param {string} text
 * @param {boolean} [asKey]
 * @returns {string}
 */
function scalar(text, asKey = false) {
  if (isPlain(text, asKey)) return text;
  /* Only printable ASCII needs no escaping; anything else goes through JSON,
     whose string escapes are a superset of YAML's double-quoted ones. */
  return JSON.stringify(text);
}

/**
 * Render one scalar (or a non-collection value) inline.
 * @param {unknown} value
 * @returns {string}
 */
function inlineScalar(value) {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'null';
  return scalar(String(value));
}

/**
 * Render a short scalar array as `[a, b]`; sequences of objects never inline.
 * @param {unknown[]} list
 * @returns {string | null} the inline form, or null when the array must be a block
 */
function inlineArray(list) {
  if (list.length === 0) return '[]';
  const parts = [];
  for (const item of list) {
    if (item !== null && typeof item === 'object') return null;
    parts.push(inlineScalar(item));
  }
  const text = `[${parts.join(', ')}]`;
  return text.length <= 96 ? text : null;
}

/** @param {unknown} value */
function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Render a value as block lines at `level` (2 spaces per level).
 * @param {unknown} value
 * @param {number} level
 * @param {string[]} out
 */
function emitValue(value, level, out) {
  const pad = '  '.repeat(level);
  if (Array.isArray(value)) {
    if (value.length === 0) {
      out.push(`${pad}[]`);
      return;
    }
    for (const item of value) {
      if (isPlainObject(item)) {
        emitSequenceMapping(item, level, out);
      } else if (Array.isArray(item)) {
        out.push(`${pad}-`);
        emitValue(item, level + 1, out);
      } else {
        out.push(`${pad}- ${inlineScalar(item)}`);
      }
    }
    return;
  }
  if (isPlainObject(value)) {
    emitMapping(value, level, out);
    return;
  }
  out.push(`${pad}${inlineScalar(value)}`);
}

/**
 * Render a mapping's `key: value` lines.
 * @param {Record<string, unknown>} mapping
 * @param {number} level
 * @param {string[]} out
 */
function emitMapping(mapping, level, out) {
  const pad = '  '.repeat(level);
  const keys = Object.keys(mapping);
  if (keys.length === 0) {
    out.push(`${pad}{}`);
    return;
  }
  for (const key of keys) {
    const value = mapping[key];
    const name = scalar(key, true);
    if (Array.isArray(value)) {
      const inline = inlineArray(value);
      if (inline !== null) out.push(`${pad}${name}: ${inline}`);
      else {
        out.push(`${pad}${name}:`);
        emitValue(value, level + 1, out);
      }
      continue;
    }
    if (isPlainObject(value)) {
      if (Object.keys(value).length === 0) out.push(`${pad}${name}: {}`);
      else {
        out.push(`${pad}${name}:`);
        emitMapping(value, level + 1, out);
      }
      continue;
    }
    out.push(`${pad}${name}: ${inlineScalar(value)}`);
  }
}

/**
 * Render a sequence item that is a mapping, keeping its first key on the dash
 * line (`- id: llm-pi-ai`) and aligning the rest under it.
 * @param {Record<string, unknown>} mapping
 * @param {number} level
 * @param {string[]} out
 */
function emitSequenceMapping(mapping, level, out) {
  const keys = Object.keys(mapping);
  if (keys.length === 0) {
    out.push(`${'  '.repeat(level)}- {}`);
    return;
  }
  const pad = '  '.repeat(level);
  const [first, ...rest] = keys;
  const firstValue = mapping[first];
  const firstInline = Array.isArray(firstValue) ? inlineArray(firstValue) : null;
  if (isPlainObject(firstValue) || (Array.isArray(firstValue) && firstInline === null)) {
    /* `- key:` then the nested block at the child level; the dash owns no value. */
    out.push(`${pad}- ${scalar(first, true)}:`);
    emitValue(firstValue, level + 2, out);
  } else if (Array.isArray(firstValue)) {
    out.push(`${pad}- ${scalar(first, true)}: ${firstInline}`);
  } else {
    out.push(`${pad}- ${scalar(first, true)}: ${inlineScalar(firstValue)}`);
  }
  if (rest.length === 0) return;
  const remainder = {};
  for (const key of rest) remainder[key] = mapping[key];
  emitMapping(remainder, level + 1, out);
}

/**
 * Serialize a plain value as a YAML document body.
 * @param {unknown} value
 * @returns {string} YAML text ending with a newline
 */
export function toYaml(value) {
  /** @type {string[]} */
  const lines = [];
  emitValue(value, 0, lines);
  return `${lines.join('\n')}\n`;
}

export default { toYaml };

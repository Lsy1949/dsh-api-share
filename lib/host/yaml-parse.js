/**
 * dsh-api-share — a YAML reader for exactly the dialect this plugin writes.
 *
 * A profile-installed plugin cannot reach a YAML library (they live inside
 * `app.asar` and plain Node resolution stops at the profile's `node_modules`),
 * so the import half parses with this instead. It is deliberately a *subset*:
 * block mappings, block sequences, inline flow sequences of scalars, quoted and
 * plain scalars, comments, and nothing else — no anchors, aliases, tags,
 * multi-document streams, block scalars or complex keys. Anything outside the
 * subset is reported as an error with a line number rather than guessed at, so a
 * half-understood file can never reach a profile.
 *
 * The output is plain JSON-shaped data, ready for the importer's whitelist.
 */

/** A parse failure with the line that caused it. */
export class YamlError extends Error {
  /**
   * @param {string} message
   * @param {number} line 1-based line number, 0 when unknown
   */
  constructor(message, line) {
    super(line > 0 ? `${message} (line ${line})` : message);
    this.name = 'YamlError';
    this.line = line;
  }
}

/**
 * Split the document into `{ indent, text, line }` tokens, dropping comments and
 * blank lines. Indentation is the count of leading spaces; a tab is refused,
 * because YAML does not allow tabs for indentation and silently accepting them
 * would mis-read the file.
 *
 * @param {string} source
 * @returns {Array<{ indent: number, text: string, line: number }>}
 */
function tokenize(source) {
  const tokens = [];
  const rawLines = source.split(/\r?\n/);
  for (let index = 0; index < rawLines.length; index += 1) {
    const raw = rawLines[index];
    const lineNumber = index + 1;
    if (raw.trim() === '') continue;
    if (/^\s*\t/.test(raw)) throw new YamlError('tabs are not allowed for indentation', lineNumber);
    const indent = raw.length - raw.trimStart().length;
    const text = stripComment(raw.trim()).trimEnd();
    if (text === '') continue;
    if (text === '---' || text === '...') continue;
    tokens.push({ indent, text, line: lineNumber });
  }
  return tokens;
}

/**
 * Remove a trailing `# comment`, leaving `#` inside quotes alone.
 * @param {string} text
 * @returns {string}
 */
function stripComment(text) {
  let quote = '';
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quote !== '') {
      if (character === '\\' && quote === '"') {
        index += 1;
        continue;
      }
      if (character === quote) quote = '';
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === '#' && (index === 0 || text[index - 1] === ' ')) return text.slice(0, index);
  }
  return text;
}

/**
 * Split `key: value` at the first colon that is outside quotes and followed by a
 * space or the end of the text. Returns null when the text is not a mapping pair.
 *
 * @param {string} text
 * @returns {{ key: string, rest: string } | null}
 */
function splitPair(text) {
  let quote = '';
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quote !== '') {
      if (character === '\\' && quote === '"') {
        index += 1;
        continue;
      }
      if (character === quote) quote = '';
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === ':' && (index === text.length - 1 || text[index + 1] === ' ')) {
      return { key: text.slice(0, index).trim(), rest: text.slice(index + 1).trim() };
    }
  }
  return null;
}

/**
 * Parse one scalar.
 * @param {string} text
 * @param {number} line
 * @returns {unknown}
 */
function parseScalar(text, line) {
  const value = text.trim();
  if (value === '' || value === '~' || value === 'null' || value === 'Null' || value === 'NULL') return null;
  if (value === '{}' ) return {};
  if (value === '[]') return [];
  if (value === 'true' || value === 'True' || value === 'TRUE') return true;
  if (value === 'false' || value === 'False' || value === 'FALSE') return false;
  if (value.startsWith('"')) {
    if (!value.endsWith('"') || value.length < 2) throw new YamlError('unterminated double-quoted string', line);
    try {
      return JSON.parse(value);
    } catch {
      throw new YamlError('invalid escape in a double-quoted string', line);
    }
  }
  if (value.startsWith("'")) {
    if (!value.endsWith("'") || value.length < 2) throw new YamlError('unterminated single-quoted string', line);
    return value.slice(1, -1).replaceAll("''", "'");
  }
  if (value.startsWith('[')) return parseFlowSequence(value, line);
  if (value.startsWith('{')) throw new YamlError('inline mappings are not supported; use a block mapping', line);
  if (/^[-+]?\d+$/.test(value)) return Number.parseInt(value, 10);
  if (/^[-+]?(\d+\.\d*|\.\d+)([eE][-+]?\d+)?$/.test(value)) return Number.parseFloat(value);
  if (/^[-+]?\d+[eE][-+]?\d+$/.test(value)) return Number(value);
  if (/^[&*!|>%@`]/.test(value)) throw new YamlError(`unsupported YAML feature "${value[0]}"`, line);
  return value;
}

/**
 * Parse `[a, b, "c"]`.
 * @param {string} text
 * @param {number} line
 * @returns {unknown[]}
 */
function parseFlowSequence(text, line) {
  if (!text.endsWith(']')) throw new YamlError('unterminated inline sequence', line);
  const body = text.slice(1, -1).trim();
  if (body === '') return [];
  /** @type {string[]} */
  const parts = [];
  let current = '';
  let quote = '';
  for (let index = 0; index < body.length; index += 1) {
    const character = body[index];
    if (quote !== '') {
      current += character;
      if (character === '\\' && quote === '"') {
        index += 1;
        current += body[index] ?? '';
        continue;
      }
      if (character === quote) quote = '';
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      current += character;
      continue;
    }
    if (character === ',') {
      parts.push(current);
      current = '';
      continue;
    }
    current += character;
  }
  if (quote !== '') throw new YamlError('unterminated string inside an inline sequence', line);
  parts.push(current);
  return parts.map((part) => {
    const trimmed = part.trim();
    if (trimmed === '') throw new YamlError('empty item in an inline sequence', line);
    return parseScalar(trimmed, line);
  });
}

/**
 * Parse a whole document. Supports a top-level mapping or sequence, which is
 * every shape an exported snippet can take.
 *
 * @param {string} source
 * @returns {unknown}
 */
export function parseYaml(source) {
  const tokens = tokenize(source);
  if (tokens.length === 0) throw new YamlError('the document is empty', 0);
  const state = { index: 0, tokens };
  const value = parseBlock(state, tokens[0].indent);
  const leftover = state.tokens[state.index];
  if (leftover !== undefined) {
    throw new YamlError(`unexpected indentation (expected ${tokens[0].indent} spaces or fewer)`, leftover.line);
  }
  return value;
}

/**
 * Parse the block that starts at `state.index` and lives at `indent`.
 * @param {{ index: number, tokens: Array<{ indent: number, text: string, line: number }> }} state
 * @param {number} indent
 * @returns {unknown}
 */
function parseBlock(state, indent) {
  const token = state.tokens[state.index];
  if (token === undefined) throw new YamlError('expected a value', 0);
  if (token.indent !== indent) {
    throw new YamlError(`expected indentation of ${indent} spaces, found ${token.indent}`, token.line);
  }
  if (isSequenceLine(token.text)) return parseSequence(state, indent);
  return parseMapping(state, indent);
}

/** @param {string} text */
function isSequenceLine(text) {
  return text === '-' || text.startsWith('- ');
}

/**
 * Parse a block mapping at `indent`, optionally seeded with a pair that was
 * already consumed from a sequence dash line.
 *
 * @param {{ index: number, tokens: Array<{ indent: number, text: string, line: number }> }} state
 * @param {number} indent
 * @param {{ key: string, rest: string, line: number } | null} [seed]
 * @returns {Record<string, unknown>}
 */
function parseMapping(state, indent, seed) {
  /** @type {Record<string, unknown>} */
  const result = {};
  /** @type {Array<{ key: string, rest: string, line: number }>} */
  const pairs = [];
  if (seed !== undefined && seed !== null) pairs.push(seed);

  while (pairs.length > 0 || state.index < state.tokens.length) {
    if (pairs.length === 0) {
      const token = state.tokens[state.index];
      if (token.indent < indent) break;
      if (token.indent > indent) throw new YamlError(`unexpected indentation of ${token.indent} spaces`, token.line);
      if (isSequenceLine(token.text)) break;
      const pair = splitPair(token.text);
      if (pair === null) throw new YamlError('expected "key: value"', token.line);
      state.index += 1;
      pairs.push({ key: pair.key, rest: pair.rest, line: token.line });
    }
    const pair = pairs.shift();
    if (pair === undefined) break;
    const key = parseScalar(pair.key, pair.line);
    if (typeof key !== 'string' && typeof key !== 'number') throw new YamlError('a mapping key must be a string', pair.line);
    const name = String(key);
    if (Object.prototype.hasOwnProperty.call(result, name)) throw new YamlError(`duplicate key "${name}"`, pair.line);

    if (pair.rest === '') {
      const next = state.tokens[state.index];
      if (next === undefined || next.indent <= indent) {
        result[name] = null;
        continue;
      }
      result[name] = parseBlock(state, next.indent);
      continue;
    }
    result[name] = parseScalar(pair.rest, pair.line);
  }

  if (pairs.length > 0) throw new YamlError('a mapping pair was not consumed', 0);
  return result;
}

/**
 * Parse a block sequence at `indent`.
 * @param {{ index: number, tokens: Array<{ indent: number, text: string, line: number }> }} state
 * @param {number} indent
 * @returns {unknown[]}
 */
function parseSequence(state, indent) {
  const items = [];
  while (state.index < state.tokens.length) {
    const token = state.tokens[state.index];
    if (token.indent < indent) break;
    if (token.indent > indent) throw new YamlError(`unexpected indentation of ${token.indent} spaces`, token.line);
    if (!isSequenceLine(token.text)) break;
    state.index += 1;

    const rest = token.text === '-' ? '' : token.text.slice(2).trim();
    if (rest === '') {
      const next = state.tokens[state.index];
      if (next === undefined || next.indent <= indent) {
        items.push(null);
        continue;
      }
      items.push(parseBlock(state, next.indent));
      continue;
    }

    const pair = splitPair(rest);
    if (pair === null) {
      items.push(parseScalar(rest, token.line));
      continue;
    }
    /* `- key: value` opens a mapping whose remaining keys align two columns
       further, under the first key — the shape this plugin's emitter writes. */
    items.push(parseMapping(state, indent + 2, { key: pair.key, rest: pair.rest, line: token.line }));
  }
  return items;
}

export default { parseYaml, YamlError };

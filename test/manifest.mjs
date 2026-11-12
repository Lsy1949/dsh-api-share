/**
 * Publication and compatibility guards.
 *
 * Everything here is a property the *official* DSH release expects from a
 * third-party package: the manifest fields it reads, a bundle patch it can
 * apply, a resolvable `./client` export, an `engines.dsh` range that admits the
 * release this plugin was verified against, and source files that never import a
 * package living inside `app.asar` (those are unresolvable from a profile).
 *
 *   node test/manifest.mjs
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

/** The DSH release this plugin was verified against (see README). */
const VERIFIED_DSH = '0.2.2-rc.1';

/**
 * Every file that ships, as relative POSIX paths.
 * @returns {string[]}
 */
function shippedSources() {
  const out = ['index.js', 'client.js'];
  for (const name of readdirSync(join(root, 'lib', 'host'))) {
    if (name.endsWith('.js')) out.push(`lib/host/${name}`);
  }
  return out;
}

/**
 * Minimal SemVer comparison for the shapes used here (`x.y.z[-pre]`).
 * @param {string} left
 * @param {string} right
 * @returns {number}
 */
function compareVersions(left, right) {
  const parse = (value) => {
    const [core, pre] = value.split('-');
    return { core: core.split('.').map(Number), pre: pre ?? '' };
  };
  const a = parse(left);
  const b = parse(right);
  for (let index = 0; index < 3; index += 1) {
    if (a.core[index] !== b.core[index]) return a.core[index] < b.core[index] ? -1 : 1;
  }
  /* A prerelease sorts before its release; two prereleases sort textually. */
  if (a.pre === b.pre) return 0;
  if (a.pre === '') return 1;
  if (b.pre === '') return -1;
  return a.pre < b.pre ? -1 : 1;
}

/**
 * Whether a simple `>=lower <upper` range admits a version.
 * @param {string} range
 * @param {string} version
 * @returns {boolean}
 */
function rangeAdmits(range, version) {
  const parts = range.trim().split(/\s+/);
  for (const part of parts) {
    const match = /^(>=|<=|>|<|=)?\s*(\S+)$/.exec(part);
    if (match === null) return false;
    const operator = match[1] ?? '=';
    const target = match[2];
    const order = compareVersions(version, target);
    if (operator === '>=' && order < 0) return false;
    if (operator === '>' && order <= 0) return false;
    if (operator === '<=' && order > 0) return false;
    if (operator === '<' && order >= 0) return false;
    if (operator === '=' && order !== 0) return false;
  }
  return true;
}

test('manifest: the fields DSH reads are present and well formed', () => {
  assert.equal(typeof pkg.name, 'string');
  assert.match(pkg.name, /^[a-z0-9][a-z0-9._-]*$/);
  assert.match(pkg.version, /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/);
  assert.equal(pkg.type, 'module');
  assert.equal(typeof pkg.main, 'string');
  assert.ok(existsSync(join(root, pkg.main)), `main "${pkg.main}" must exist`);

  const dsh = pkg.dsh;
  assert.equal(dsh.manifestVersion, 1, 'dsh.manifestVersion must be 1');
  assert.equal(typeof dsh.bundle.patch, 'string');
  assert.ok(existsSync(join(root, dsh.bundle.patch)), 'the bundle patch must exist');
  assert.equal(dsh.client.platform, 'web', 'a browser half must declare platform "web"');
});

test('manifest: exports resolve, including the ./client entry the host serves', () => {
  const exportsField = pkg.exports;
  for (const key of ['.', './client', './package.json']) {
    assert.equal(typeof exportsField[key], 'string', `exports["${key}"] must be a path`);
    assert.ok(existsSync(join(root, exportsField[key])), `exports["${key}"] -> ${exportsField[key]} must exist`);
  }
  assert.equal(exportsField['./client'], './client.js');
});

test('manifest: engines admit the verified official release and exclude the next minor', () => {
  assert.match(pkg.engines.node, />=\s*2[04]/);
  assert.equal(typeof pkg.engines.dsh, 'string', 'engines.dsh declares compatibility');
  assert.ok(rangeAdmits(pkg.engines.dsh, VERIFIED_DSH), `engines.dsh "${pkg.engines.dsh}" must admit ${VERIFIED_DSH}`);
  assert.ok(rangeAdmits(pkg.engines.dsh, '0.2.1-rc.2'), 'the declared range must admit the whole verified line');
  assert.ok(!rangeAdmits(pkg.engines.dsh, '0.3.0'), 'a range that silently admits 0.3.x overstates compatibility');
});

test('manifest: the published file list exists and covers every runtime file', () => {
  assert.ok(Array.isArray(pkg.files) && pkg.files.length > 0);
  for (const entry of pkg.files) {
    if (entry.includes('*')) continue;
    assert.ok(existsSync(join(root, entry)), `files entry "${entry}" must exist`);
  }
  for (const source of shippedSources()) {
    const covered = pkg.files.some((entry) => (entry.includes('*') ? source.startsWith(entry.split('**')[0]) : entry === source));
    assert.ok(covered, `${source} must be published`);
  }
  for (const doc of ['README.md', 'README.zh.md', 'LICENSE', 'CHANGELOG.md']) {
    assert.ok(existsSync(join(root, doc)), `${doc} must exist for a published package`);
  }
});

test('manifest: the bundle patch mounts this package by its own name', () => {
  const patch = readFileSync(join(root, pkg.dsh.bundle.patch), 'utf8');
  assert.match(patch, /- insert:/);
  assert.match(patch, new RegExp(`id: ${pkg.name}\\b`));
  assert.match(patch, new RegExp(`name: ${pkg.name}\\b`));
});

test('manifest: no source imports a package that lives inside app.asar', () => {
  for (const source of shippedSources()) {
    const text = readFileSync(join(root, source), 'utf8');
    assert.ok(!/from\s+['"]@deepseek-ai\//.test(text), `${source} must not import @deepseek-ai/*`);
    assert.ok(!/require\(\s*['"]@deepseek-ai\//.test(text), `${source} must not require @deepseek-ai/*`);
    assert.ok(!/from\s+['"](?:yaml|js-yaml)['"]/.test(text), `${source} must not import a YAML parser`);
    for (const match of text.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
      const specifier = match[1];
      assert.ok(specifier.startsWith('.') || specifier.startsWith('node:'), `${source} imports "${specifier}", which is not a relative path or node: builtin`);
    }
  }
});

test('client: the bundle only requires the platform table and registers under the package name', () => {
  const text = readFileSync(join(root, 'client.js'), 'utf8');
  const required = [...text.matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g)].map((match) => match[1]);
  assert.deepEqual([...new Set(required)], ['react'], 'the platform table is the only synchronous require');
  assert.ok(!/^\s*import\s/m.test(text), 'a browser bundle is a classic script with no import statements');
  assert.ok(!/\bexport\s+(default|const|function|\{)/.test(text), 'a browser bundle exports through module.exports');
  assert.match(text, /window\.__ModuleLoader__\.load\(\{/);
  assert.match(text, new RegExp(`id:\\s*'${pkg.name}'`), 'the factory id must equal the package name');
  assert.match(text, /exports\.inject\s*=\s*\[\s*'slots'\s*\]/, 'only the slots service may be injected');
});

test('client: registered slot ids are namespaced by the package', () => {
  const text = readFileSync(join(root, 'client.js'), 'utf8');
  const ids = [...text.matchAll(/id:\s*PACKAGE_ID\s*\+\s*'([^']+)'/g)].map((match) => match[1]);
  assert.deepEqual(ids, ['.footer']);
  assert.match(text, /var SLOT_MODELS_FOOTER = 'settings\.models\.footer'/, 'the Models footer is the only insertion point');
});

test('host: routes are namespaced and only registered as exact POST handlers', () => {
  const routes = readFileSync(join(root, 'lib', 'host', 'routes.js'), 'utf8');
  assert.match(routes, new RegExp(`ROUTE_PREFIX = '/${pkg.name}'`));
  for (const route of ['/catalog', '/export', '/import/preview', '/import/apply']) {
    assert.ok(routes.includes(`\${ROUTE_PREFIX}${route}\``), `the ${route} route must exist`);
  }
  const plugin = readFileSync(join(root, 'lib', 'host', 'plugin.js'), 'utf8');
  assert.match(plugin, /ctx\.inject\(\['webServer'\]/);
  assert.match(plugin, /kind: 'exact'/);
  assert.ok(!/ctx\.inject\.\w+\(|static inject/.test(plugin), 'no module-level inject: a missing service must not leave the entry pending');
});

/**
 * Strip `//` and block comments so a guard checks code, not prose. Good enough
 * for this repository: the sources hold no regular-expression literal that could
 * be mistaken for a comment, and strings are left intact on purpose.
 * @param {string} text
 * @returns {string}
 */
function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

test('host: the only write path is configEditor.edit()', () => {
  const write = stripComments(readFileSync(join(root, 'lib', 'host', 'write.js'), 'utf8'));
  assert.match(write, /editor\.edit\(row\.entry/);
  for (const source of shippedSources()) {
    const text = readFileSync(join(root, source), 'utf8');
    const code = stripComments(text);
    /* A third-party plugin must never hand-write the profile patch: it has no
       lock, no schema validation and no YAML parser for that document. */
    assert.ok(!/writeFile|appendFile|createWriteStream/.test(code), `${source} must not write files`);
    assert.ok(!/node:fs/.test(code), `${source} must not import the filesystem`);
    if (source !== 'lib/host/write.js') {
      assert.ok(!/\beditor\.edit\(|\bconfigEditor\.edit\(/.test(code), `${source} must not edit configuration directly`);
    }
  }
});

test('yaml: emitted text uses two-space indentation and no tabs', () => {
  const yaml = readFileSync(join(root, 'lib', 'host', 'yaml.js'), 'utf8');
  assert.ok(!/\t/.test(yaml), 'the emitter must never write a tab');
  assert.match(yaml, /const pad = '  '\.repeat\(level\)/);
  assert.ok(!/js-yaml|from 'yaml'/.test(yaml), 'the emitter is dependency-free');
});

test('client: the dialog columns are bounded so each column scrolls on its own', () => {
  const text = readFileSync(join(root, 'client.js'), 'utf8');
  /* A grid row sized by content makes a `flex:1; overflow:auto` child grow past
     the dialog, and the dialog's own `overflow:hidden` then clips the list — the
     list must scroll, so the row has to be explicitly bounded. */
  assert.match(text, /\.das-body\{[^}]*grid-template-rows:minmax\(0,1fr\)/);
  assert.match(text, /\.das-body\{[^}]*min-height:0/);
  assert.match(text, /\.das-col\{[^}]*min-height:0[^}]*overflow:hidden/);
  assert.match(text, /\.das-scroll\{[^}]*overflow-y:auto[^}]*min-height:0[^}]*flex:1 1 0/);
});

test('client: every API group starts collapsed', () => {
  const text = readFileSync(join(root, 'client.js'), 'utf8');
  assert.match(text, /open\[provider\.id\] = false;/, 'the seeding effect must collapse every group');
  assert.ok(!/open\[provider\.id\] = index === 0/.test(text), 'no group may be expanded by default');
});

test('package: every runtime file is present and non-empty', () => {
  for (const source of shippedSources()) {
    const size = statSync(join(root, source)).size;
    assert.ok(size > 0, `${relative(root, join(root, source))} is empty`);
  }
});

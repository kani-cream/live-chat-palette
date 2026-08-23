// Validates the source manifest, the built extension in dist/, and the zip package.
// Exits non-zero on the first category of failure; prints every failure it finds.
import { access, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { unzipSync } from 'fflate';
import { createPackage, ZIP_NAME } from './package.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');

const ALLOWED_PERMISSIONS = new Set(['storage']);
const FORBIDDEN_PERMISSIONS = [
  'tabs',
  'history',
  'cookies',
  'identity',
  'webRequest',
  'webRequestBlocking',
  'downloads',
  'clipboardRead',
  'clipboardWrite',
  'scripting',
  'activeTab',
  'declarativeNetRequest',
  'management',
  'nativeMessaging',
  'debugger',
  'proxy',
  'webNavigation',
];
const ALLOWED_MATCH_PATTERNS = /^https:\/\/www\.youtube\.com\//;
const FORBIDDEN_CODE = [
  { name: 'eval(', pattern: /\beval\s*\(/ },
  { name: 'new Function', pattern: /new\s+Function\s*\(/ },
  { name: 'remote script', pattern: /https?:\/\/[^"'`\s]+\.js\b/ },
  { name: 'importScripts', pattern: /\bimportScripts\s*\(/ },
  { name: 'document.execCommand', pattern: /\.execCommand\s*\(/ },
  { name: 'cookie access', pattern: /document\.cookie/ },
  { name: 'YouTube internal API', pattern: /youtubei\/v1/ },
];

const failures = [];
const fail = (message) => failures.push(message);
const exists = (file) =>
  access(file).then(
    () => true,
    () => false,
  );

const readJson = async (file) => JSON.parse(await readFile(file, 'utf8'));

const validateManifest = (manifest, label) => {
  if (manifest.manifest_version !== 3) fail(`${label}: manifest_version must be 3`);
  if (typeof manifest.name !== 'string' || manifest.name.length === 0)
    fail(`${label}: name missing`);
  if (!/^\d+(\.\d+){1,3}$/.test(manifest.version ?? '')) {
    fail(`${label}: version must be 1-4 dot-separated integers (got ${manifest.version})`);
  }
  if (typeof manifest.description !== 'string' || manifest.description.length > 132) {
    fail(`${label}: description missing or longer than 132 chars`);
  }
  for (const p of manifest.permissions ?? []) {
    if (!ALLOWED_PERMISSIONS.has(p)) fail(`${label}: permission "${p}" is not allowed`);
  }
  for (const p of FORBIDDEN_PERMISSIONS) {
    if (
      (manifest.permissions ?? []).includes(p) ||
      (manifest.optional_permissions ?? []).includes(p)
    ) {
      fail(`${label}: forbidden permission "${p}"`);
    }
  }
  if ((manifest.host_permissions ?? []).length > 0) {
    fail(`${label}: host_permissions must stay empty (content_scripts.matches is sufficient)`);
  }
  if (manifest.optional_host_permissions) fail(`${label}: optional_host_permissions not allowed`);
  if (!Array.isArray(manifest.content_scripts) || manifest.content_scripts.length === 0) {
    fail(`${label}: content_scripts missing`);
  }
  for (const cs of manifest.content_scripts ?? []) {
    for (const m of cs.matches ?? []) {
      if (!ALLOWED_MATCH_PATTERNS.test(m))
        fail(`${label}: content script match "${m}" not allowed`);
    }
  }
  if (typeof manifest.background?.service_worker !== 'string') {
    fail(`${label}: background.service_worker missing`);
  }
  if (manifest.background?.scripts) fail(`${label}: MV2-style background.scripts not allowed`);
  if (typeof manifest.options_ui?.page !== 'string') fail(`${label}: options_ui.page missing`);
  if (manifest.content_security_policy?.extension_pages?.includes('unsafe-eval')) {
    fail(`${label}: unsafe-eval CSP not allowed`);
  }
  if (manifest.web_accessible_resources) fail(`${label}: web_accessible_resources not expected`);
  for (const size of ['16', '48', '128']) {
    if (typeof manifest.icons?.[size] !== 'string') fail(`${label}: icons.${size} missing`);
  }
};

const manifestFiles = (manifest) =>
  [
    manifest.background?.service_worker,
    manifest.options_ui?.page,
    ...Object.values(manifest.icons ?? {}),
    ...(manifest.content_scripts ?? []).flatMap((cs) => [...(cs.js ?? []), ...(cs.css ?? [])]),
  ].filter(Boolean);

const listFiles = async (dir, base = '') => {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...(await listFiles(path.join(dir, entry.name), rel)));
    else out.push(rel);
  }
  return out;
};

const validateSourceManifest = async () => {
  const manifest = await readJson(path.join(root, 'manifest.json'));
  validateManifest(manifest, 'manifest.json');
  const pkg = await readJson(path.join(root, 'package.json'));
  if (pkg.license !== 'Apache-2.0') fail('package.json: license must be Apache-2.0');
  if (pkg.version !== manifest.version) fail('package.json version differs from manifest.json');
  if (!(await exists(path.join(root, 'LICENSE')))) fail('LICENSE file missing');
  const license = await readFile(path.join(root, 'LICENSE'), 'utf8');
  if (!license.includes('Apache License') || !license.includes('Version 2.0')) {
    fail('LICENSE is not Apache License 2.0');
  }
  const lock = await exists(path.join(root, 'package-lock.json'));
  if (!lock) fail('package-lock.json missing (CI uses npm ci)');
};

const validateDist = async () => {
  if (!(await exists(dist))) {
    fail('dist/ missing; run `npm run build` first');
    return null;
  }
  const manifest = await readJson(path.join(dist, 'manifest.json'));
  validateManifest(manifest, 'dist/manifest.json');
  const files = await listFiles(dist);
  for (const required of [...manifestFiles(manifest), 'LICENSE']) {
    if (!files.includes(required)) fail(`dist/: required file "${required}" missing`);
  }
  for (const file of files) {
    if (!/\.(js|html|css|json|png|map)$|^LICENSE$/.test(file))
      fail(`dist/: unexpected file "${file}"`);
    if (/\.(js|html)$/.test(file)) {
      const content = await readFile(path.join(dist, file), 'utf8');
      for (const { name, pattern } of FORBIDDEN_CODE) {
        if (pattern.test(content)) fail(`dist/${file}: contains forbidden pattern (${name})`);
      }
      if (file.endsWith('.html') && /<script[^>]+src=["']https?:/.test(content)) {
        fail(`dist/${file}: loads a remote script`);
      }
      if (
        file.endsWith('.js') &&
        /^\s*import\s.+from\s+['"]/m.test(content) &&
        !file.startsWith('options/')
      ) {
        fail(`dist/${file}: content scripts / service worker must be self-contained bundles`);
      }
    }
  }
  return manifest;
};

const validatePackage = async (manifest) => {
  const { out, fileCount } = await createPackage();
  const zip = unzipSync(new Uint8Array(await readFile(out)));
  const entries = Object.keys(zip);
  if (entries.length !== fileCount) fail(`${ZIP_NAME}: entry count mismatch`);
  if (!entries.includes('manifest.json'))
    fail(`${ZIP_NAME}: manifest.json must be at the zip root`);
  for (const required of [...manifestFiles(manifest), 'LICENSE']) {
    if (!entries.includes(required)) fail(`${ZIP_NAME}: missing "${required}"`);
  }
  const zipped = JSON.parse(new TextDecoder().decode(zip['manifest.json']));
  if (zipped.version !== manifest.version) fail(`${ZIP_NAME}: manifest version mismatch`);
};

await validateSourceManifest();
const distManifest = await validateDist();
if (distManifest) await validatePackage(distManifest);

if (failures.length > 0) {
  console.error('Validation failed:');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('validation passed: manifest, dist/, package');

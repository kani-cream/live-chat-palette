// Builds the extension into dist/ with Vite.
// Content scripts and the service worker must be self-contained (no code splitting),
// so each entry is built as its own IIFE bundle; the options page is a regular Vite HTML build.
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const mode = process.env.NODE_ENV === 'development' ? 'development' : 'production';

const SCRIPT_ENTRIES = [
  { entry: 'src/content/chat/chatContent.ts', out: 'content/chat' },
  { entry: 'src/content/watch/watchContent.ts', out: 'content/watch' },
  { entry: 'src/background/serviceWorker.ts', out: 'background/serviceWorker' },
];

const common = {
  root,
  mode,
  configFile: false,
  logLevel: 'warn',
  define: { 'import.meta.env.VITEST': 'false' },
};

const buildScript = async ({ entry, out }) => {
  await build({
    ...common,
    build: {
      outDir: dist,
      emptyOutDir: false,
      sourcemap: false,
      minify: false,
      target: 'es2022',
      lib: {
        entry: path.join(root, entry),
        formats: ['iife'],
        name: 'LiveChatPalette',
        fileName: () => `${out}.js`,
      },
    },
  });
};

const buildOptionsPage = async () => {
  await build({
    ...common,
    root: path.join(root, 'src/options'),
    base: './',
    build: {
      outDir: path.join(dist, 'options'),
      emptyOutDir: false,
      sourcemap: false,
      minify: false,
      target: 'es2022',
      rollupOptions: { input: path.join(root, 'src/options/index.html') },
    },
  });
};

const copyStatic = async () => {
  const manifest = JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8'));
  const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  if (manifest.version !== pkg.version) {
    throw new Error(
      `manifest.json version ${manifest.version} != package.json version ${pkg.version}`,
    );
  }
  await writeFile(path.join(dist, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  await cp(path.join(root, 'public/icons'), path.join(dist, 'icons'), { recursive: true });
  await cp(path.join(root, 'LICENSE'), path.join(dist, 'LICENSE'));
};

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
for (const entry of SCRIPT_ENTRIES) await buildScript(entry);
await buildOptionsPage();
await copyStatic();
console.log(`built ${mode} extension into ${path.relative(root, dist)}/`);

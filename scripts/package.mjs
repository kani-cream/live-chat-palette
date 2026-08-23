// Packages dist/ into live-chat-palette.zip (Chrome Web Store / manual install artifact).
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { zipSync } from 'fflate';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
export const ZIP_NAME = 'live-chat-palette.zip';

const collect = async (dir, base = '') => {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = {};
  for (const entry of entries) {
    const rel = base ? `${base}/${entry.name}` : entry.name;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) Object.assign(files, await collect(abs, rel));
    else files[rel] = new Uint8Array(await readFile(abs));
  }
  return files;
};

export const createPackage = async () => {
  await stat(dist).catch(() => {
    throw new Error('dist/ not found; run `npm run build` first');
  });
  const files = await collect(dist);
  const zip = zipSync(files, { level: 6, mtime: new Date('2000-01-01T00:00:00Z') });
  const out = path.join(root, ZIP_NAME);
  await writeFile(out, zip);
  return { out, fileCount: Object.keys(files).length, bytes: zip.byteLength };
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await createPackage();
  console.log(
    `packaged ${result.fileCount} files (${result.bytes} bytes) -> ${path.basename(result.out)}`,
  );
}

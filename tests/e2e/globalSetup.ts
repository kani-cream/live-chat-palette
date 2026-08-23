import { execFileSync } from 'node:child_process';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { DIST, ROOT } from './extension';

/** E2E always runs against a fresh production build so it tests what ships. */
export default async function globalSetup(): Promise<void> {
  if (process.env.LCP_E2E_SKIP_BUILD === '1') {
    await access(path.join(DIST, 'manifest.json'));
    return;
  }
  execFileSync('node', [path.join(ROOT, 'scripts/build.mjs')], { cwd: ROOT, stdio: 'inherit' });
}

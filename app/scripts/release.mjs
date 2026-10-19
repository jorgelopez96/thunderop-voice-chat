// npm run release -- midominio.duckdns.org: arma el instalador apuntando al servidor.
// Queda en src-tauri/target/release/bundle/nsis/.
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dominio = process.argv[2];
if (!dominio) {
  console.error('Uso: npm run release -- midominio.duckdns.org');
  process.exit(1);
}
const conf = JSON.parse(readFileSync(new URL('../src-tauri/tauri.conf.json', import.meta.url), 'utf8'));
const csp = conf.app.security.csp
  .replaceAll('http://127.0.0.1:8090', `https://${dominio}`)
  .replaceAll('ws://127.0.0.1:7880', `wss://${dominio}`);
const extra = join(tmpdir(), 'thunderop-release.json');
writeFileSync(extra, JSON.stringify({ app: { security: { csp } } }));

const tauri = fileURLToPath(new URL('../node_modules/@tauri-apps/cli/tauri.js', import.meta.url));
execFileSync(process.execPath, [tauri, 'build', '--bundles', 'nsis', '--config', extra], {
  stdio: 'inherit',
  env: { ...process.env, VITE_PB_URL: `https://${dominio}` },
});

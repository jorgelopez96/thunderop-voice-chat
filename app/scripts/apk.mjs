// npm run apk -- midominio.duckdns.org: arma el APK de Android apuntando al servidor y lo deja en app/release/thunderop.apk.
// Necesita JDK, SDK y NDK de Android (JAVA_HOME, ANDROID_HOME, NDK_HOME) y la firma en ~/.tauri/thunderop-android.properties.
// En el celular no hay autoactualizador: cada versión nueva se instala bajando el APK (con la misma firma, encima de la vieja).
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dominio = process.argv.slice(2).find((x) => !x.startsWith('--'));
if (!dominio) {
  console.error('Uso: npm run apk -- midominio.duckdns.org');
  process.exit(1);
}
const conf = JSON.parse(readFileSync(new URL('../src-tauri/tauri.conf.json', import.meta.url), 'utf8'));
const csp = conf.app.security.csp
  .replaceAll('http://127.0.0.1:8090', `https://${dominio}`)
  .replaceAll('ws://127.0.0.1:7880', `wss://${dominio}`);
const extra = join(tmpdir(), 'thunderop-apk.json');
// El transmisor nativo es de Windows: en el celular no va.
writeFileSync(extra, JSON.stringify({ app: { security: { csp } }, bundle: { externalBin: [] } }));

const tauri = fileURLToPath(new URL('../node_modules/@tauri-apps/cli/tauri.js', import.meta.url));
execFileSync(process.execPath, [tauri, 'android', 'build', '--apk', '--target', 'aarch64', 'armv7', '--config', extra], {
  stdio: 'inherit',
  env: { ...process.env, VITE_PB_URL: `https://${dominio}` },
});

const apk = fileURLToPath(new URL('../src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release.apk', import.meta.url));
const salida = fileURLToPath(new URL('../release/', import.meta.url));
mkdirSync(salida, { recursive: true });
copyFileSync(apk, join(salida, 'thunderop.apk'));
console.log(`\nListo: ${join(salida, 'thunderop.apk')} (versión ${conf.version})`);

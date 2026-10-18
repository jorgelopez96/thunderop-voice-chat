import { defineConfig } from '@playwright/test';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Micrófono falso con un tono continuo de 440 Hz. El pitido por defecto de Chromium dura unos ms por
// intervalo y no llega al mínimo de tiempo con voz que LiveKit exige para marcar a alguien "hablando".
const tono = join(dirname(fileURLToPath(import.meta.url)), 'node_modules', '.cache', 'dm-tono.wav');
if (!existsSync(tono)) {
  const sr = 48000, n = sr; // 1 s, ciclos enteros: el loop no tiene saltos
  const b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(sr, 24);
  b.writeUInt32LE(sr * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 440 * i) / sr) * 12000), 44 + i * 2);
  mkdirSync(dirname(tono), { recursive: true });
  writeFileSync(tono, b);
}

export default defineConfig({
  testDir: 'e2e',
  testMatch: /.*\.spec\.ts/,
  globalSetup: './e2e/global-setup.ts',
  workers: 1,
  timeout: 90_000,
  use: {
    channel: 'msedge',
    baseURL: 'http://127.0.0.1:1430',
    permissions: ['microphone'],
    launchOptions: {
      args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${tono}`],
    },
  },
  webServer: {
    command: 'npm run dev -- --port 1430 --strictPort', // 1420 queda para `tauri dev`
    url: 'http://127.0.0.1:1430',
    reuseExistingServer: false,
    env: { VITE_PB_URL: 'http://127.0.0.1:8091' },
  },
});

import { test, expect } from '@playwright/test';
import { createServer, type Server } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// La versión web como la sirve Vercel: `build/` (npm run build:web) con las cabeceras de vercel.json.
// Los demás e2e corren con `vite dev`, sin esas cabeceras: esto es lo único que prueba que la CSP deja arrancar la app.
const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const build = join(raiz, 'build');
const TIPOS: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
let servidor: Server;
let url = '';

test.beforeAll(async () => {
  if (!existsSync(join(build, 'index.html'))) throw new Error('Falta build/: correr `npm run build:web` antes de este test.');
  const cabeceras: { key: string; value: string }[] = JSON.parse(readFileSync(join(raiz, 'vercel.json'), 'utf8')).headers[0].headers;
  servidor = createServer((req, res) => {
    let ruta = join(build, decodeURIComponent(new URL(req.url!, 'http://x').pathname));
    if (!existsSync(ruta) || statSync(ruta).isDirectory()) ruta = join(build, 'index.html');
    for (const c of cabeceras) res.setHeader(c.key, c.value);
    res.setHeader('Content-Type', TIPOS[extname(ruta)] ?? 'application/octet-stream');
    res.end(readFileSync(ruta));
  });
  await new Promise<void>((ok) => servidor.listen(0, '127.0.0.1', ok));
  url = `http://127.0.0.1:${(servidor.address() as { port: number }).port}/`;
});
test.afterAll(() => new Promise<void>((ok) => servidor.close(() => ok())));

test('la app compilada para la web arranca con las cabeceras de Vercel', async ({ page }) => {
  const bloqueos: string[] = [];
  page.on('console', (m) => { if (/Content Security Policy/i.test(m.text())) bloqueos.push(m.text()); });
  await page.goto(url);
  await expect(page.getByRole('tab', { name: 'Entrar' })).toBeVisible({ timeout: 15_000 });
  expect(bloqueos).toEqual([]);
});

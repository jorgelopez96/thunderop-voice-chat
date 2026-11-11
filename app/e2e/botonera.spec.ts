import { test, expect, type Page } from '@playwright/test';
import PocketBase from 'pocketbase';
import { grupoDeTres } from './cuentas';

/** WAV mono de 8 kHz con un tono de `segundos` (11 s pesan ~176 KB). */
function wav(segundos: number) {
  const sr = 8000, n = sr * segundos;
  const b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(sr, 24);
  b.writeUInt32LE(sr * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 440 * i) / sr) * 8000), 44 + i * 2);
  return b;
}
const reproducidos = (p: Page) => p.evaluate(() => (globalThis as unknown as { __botonera: { reproducidos: number } }).__botonera.reproducidos);
const entrar = (p: Page) => p.getByRole('button', { name: 'Sala de voz General' }).click();

async function subir(p: Page, nombre: string, segundos: number) {
  await p.getByRole('button', { name: 'Nuevo sonido' }).click();
  await p.getByLabel('Nombre del sonido').fill(nombre);
  await p.getByLabel('Archivo de audio').setInputFiles({ name: `${nombre}.wav`, mimeType: 'audio/wav', buffer: wav(segundos) });
  await p.getByRole('button', { name: 'Subir' }).click();
}

test('un sonido de la botonera lo escuchan los de la sala', async ({ browser }) => {
  const [a, b, c] = await grupoDeTres(browser, 'Ruidos');

  // Ana y Beto entran a la voz; Caro se queda afuera.
  for (const p of [a, b]) await entrar(p);
  for (const p of [a, b]) await expect(p.locator('section.voz .franja li')).toHaveCount(2, { timeout: 10_000 });

  // Ana sube un sonido de 1 s y les aparece a los dos (en el panelcito de Sonidos del dock).
  for (const p of [a, b]) await p.getByRole('button', { name: 'Sonidos', exact: true }).click();
  await subir(a, 'Bocina', 1);
  const boton = (p: Page) => p.getByRole('button', { name: 'Bocina', exact: true });
  await expect(boton(a)).toBeVisible({ timeout: 5000 });
  await expect(boton(b)).toBeEnabled({ timeout: 5000 });

  // Ana lo aprieta: a Beto le suena una vez; a Caro, que no está en la sala, no.
  const [antesB, antesC] = [await reproducidos(b), await reproducidos(c)];
  await boton(a).click();
  await expect.poll(() => reproducidos(b), { timeout: 5000 }).toBe(antesB + 1);
  await c.waitForTimeout(1500);
  expect(await reproducidos(c)).toBe(antesC);
  expect(await reproducidos(b)).toBe(antesB + 1);

  // Uno de 11 s se recorta a los primeros 10 s y se sube.
  await a.getByRole('button', { name: 'Nuevo sonido' }).click();
  await a.getByLabel('Nombre del sonido').fill('Larguísimo');
  await a.getByLabel('Archivo de audio').setInputFiles({ name: 'Larguísimo.wav', mimeType: 'audio/wav', buffer: wav(11) });
  await expect(a.getByRole('slider', { name: 'Fin del recorte' })).toHaveAttribute('aria-valuenow', '10');
  await a.getByRole('slider', { name: 'Fin del recorte' }).press('ArrowRight');
  await expect(a.getByRole('slider', { name: 'Inicio del recorte' })).toHaveAttribute('aria-valuenow', '0.1');
  await a.getByRole('button', { name: 'Subir' }).click();
  await expect(a.getByRole('button', { name: 'Larguísimo', exact: true })).toBeVisible({ timeout: 5000 });
});

test('sonidos de otros grupos: Ana toca uno de su otro grupo y Beto, que no es de ese grupo, lo escucha', async ({ browser }) => {
  const nombre = `Otros${Math.random().toString(36).slice(2, 6)}`;
  const [a, b] = await grupoDeTres(browser, nombre);
  // El otro grupo de Ana, con un sonido (armado por el superuser: solo importa que exista).
  const admin = new PocketBase(`http://127.0.0.1:${process.env.E2E_PB_PORT ?? 8091}`);
  await admin.collection('_superusers').authWithPassword('admin@test.local', 'admin-pass-1234');
  const g1 = await admin.collection('groups').getFirstListItem(`name = "${nombre}"`);
  const g2 = await admin.collection('groups').create({ name: `${nombre}B`, owner: g1.owner, members: [g1.owner] });
  const d = new FormData();
  d.append('group', g2.id); d.append('owner', g1.owner); d.append('name', 'Trompeta');
  d.append('file', new Blob([wav(1)], { type: 'audio/wav' }), 'trompeta.wav');
  await admin.collection('sonidos').create(d);

  for (const p of [a, b]) await entrar(p);
  for (const p of [a, b]) await expect(p.locator('section.voz .franja li')).toHaveCount(2, { timeout: 10_000 });
  await a.getByRole('button', { name: 'Sonidos', exact: true }).click();
  await a.getByRole('tab', { name: `${nombre}B` }).click();
  await expect(a.getByRole('button', { name: 'Nuevo sonido' })).toHaveCount(0); // en los ajenos solo se toca
  const antes = await reproducidos(b);
  await a.getByRole('button', { name: 'Trompeta', exact: true }).click();
  await expect.poll(() => reproducidos(b), { timeout: 8000 }).toBe(antes + 1);
  // Beto no tiene la pestaña: no es de ese grupo.
  await b.getByRole('button', { name: 'Sonidos', exact: true }).click();
  await expect(b.getByRole('tab', { name: `${nombre}B` })).toHaveCount(0);
});

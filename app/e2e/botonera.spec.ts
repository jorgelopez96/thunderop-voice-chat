import { test, expect, type Page } from '@playwright/test';
import { grupoDeTres } from './cuentas';

/** WAV mono de 8 kHz con un tono de `segundos` (11 s pesan ~176 KB: pasa el tope de 1 MB y falla solo por duración). */
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

  // Uno de 11 s no pasa.
  await subir(a, 'Larguísimo', 11);
  await expect(a.locator('dialog').getByRole('alert')).toHaveText('El sonido dura más de 10 segundos.');
  await a.getByRole('button', { name: 'Cancelar' }).click();
  await expect(a.getByRole('button', { name: 'Larguísimo', exact: true })).toHaveCount(0);
});

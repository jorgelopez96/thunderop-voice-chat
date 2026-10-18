import { test, expect, type Page } from '@playwright/test';
import { grupoDeTres } from './cuentas';

type M = { __musica: { reproductor: boolean; tiempo(): number; videoId: string | null } };
const tiempo = (p: Page) => p.evaluate(() => (globalThis as unknown as M).__musica.tiempo());
const videoId = (p: Page) => p.evaluate(() => (globalThis as unknown as M).__musica.videoId);
const reproductor = (p: Page) => p.evaluate(() => (globalThis as unknown as M).__musica.reproductor);
const entrar = (p: Page) => p.getByRole('button', { name: '🔊 General' }).click();
const actual = (p: Page) => p.locator('section.voz strong.titulo');

test('cola de música compartida', async ({ browser }) => {
  // Reproductor falso (no toca YouTube ni suena). Dura mucho hasta que el test lo acorte.
  const [a, b, c] = await grupoDeTres(browser, 'Musiqueros',
    (p) => p.addInitScript(() => { (globalThis as unknown as { __ytFalso: object }).__ytFalso = { duracion: 600 }; }));
  for (const p of [a, b]) await entrar(p);
  for (const p of [a, b]) await expect(p.locator('section.voz li.tarjeta')).toHaveCount(2, { timeout: 10_000 });

  // Ana agrega dos links (el título viene del stub de oEmbed: no se salió a internet).
  const link = a.getByLabel('Pegá un link de YouTube');
  const agregar = a.getByRole('button', { name: 'Agregar' });
  await expect(agregar).toBeEnabled({ timeout: 10_000 });
  await link.fill('https://www.youtube.com/watch?v=aaaaaaaaaaa');
  await agregar.click();
  await expect(link).toHaveValue('');
  await link.fill('https://youtu.be/bbbbbbbbbbb');
  await agregar.click();
  await expect(link).toHaveValue('');

  // Beto ve la cola y la que suena.
  await expect(actual(b)).toHaveText('Tema aaaaaaaaaaa', { timeout: 5000 });
  await expect(b.locator('section.voz li span.titulo')).toHaveText(['Tema aaaaaaaaaaa', 'Tema bbbbbbbbbbb']);
  for (const p of [a, b]) await expect.poll(() => videoId(p), { timeout: 5000 }).toBe('aaaaaaaaaaa');
  await expect.poll(() => tiempo(a), { timeout: 5000 }).toBeGreaterThan(0.5);

  // Beto pausa: Ana ve "Reanudar" y su reproductor se queda quieto. Ana reanuda.
  await b.getByRole('button', { name: 'Pausar' }).click();
  await expect(a.getByRole('button', { name: 'Reanudar' })).toBeVisible({ timeout: 5000 });
  const quieto = await tiempo(a);
  await a.waitForTimeout(1000);
  expect(Math.abs((await tiempo(a)) - quieto)).toBeLessThan(0.3);
  await a.getByRole('button', { name: 'Reanudar' }).click();
  await expect(b.getByRole('button', { name: 'Pausar' })).toBeVisible({ timeout: 5000 });
  await expect.poll(() => tiempo(a), { timeout: 5000 }).toBeGreaterThan(quieto + 0.5);

  // Caro entra tarde y queda a ±2 s de Ana.
  await entrar(c);
  await expect.poll(() => videoId(c), { timeout: 10_000 }).toBe('aaaaaaaaaaa');
  await expect.poll(() => tiempo(c), { timeout: 5000 }).toBeGreaterThan(0);
  const [ta, tc] = await Promise.all([tiempo(a), tiempo(c)]);
  expect(Math.abs(ta - tc)).toBeLessThanOrEqual(2);

  // Beto salta: todos pasan a la segunda.
  await b.getByRole('button', { name: 'Saltar' }).click();
  for (const p of [a, b, c]) await expect.poll(() => videoId(p), { timeout: 5000 }).toBe('bbbbbbbbbbb');
  for (const p of [a, b, c]) await expect(actual(p)).toHaveText('Tema bbbbbbbbbbb');

  // La segunda dura 3 s: al terminar no queda reproductor en nadie.
  for (const p of [a, b, c]) await p.evaluate(() => { (globalThis as unknown as { __ytFalso: { duracion: number } }).__ytFalso.duracion = 3; });
  for (const p of [a, b, c]) await expect.poll(() => reproductor(p), { timeout: 15_000 }).toBe(false);
  for (const p of [a, b, c]) await expect(actual(p)).toHaveCount(0);

  // Un tema que YouTube no deja embeber (150 en el falso): queda marcado en la cola y sigue el siguiente.
  for (const p of [a, b, c]) await p.evaluate(() => { Object.assign((globalThis as unknown as { __ytFalso: object }).__ytFalso, { duracion: 600, errores: { ccccccccccc: 150 } }); });
  for (const id of ['ccccccccccc', 'ddddddddddd']) {
    await link.fill(`https://www.youtube.com/watch?v=${id}`);
    await agregar.click();
    await expect(link).toHaveValue('');
  }
  for (const p of [a, b, c]) await expect.poll(() => videoId(p), { timeout: 10_000 }).toBe('ddddddddddd');
  await expect(b.locator('section.voz li span.titulo')).toHaveText(['Tema ccccccccccc — No se puede reproducir acá', 'Tema ddddddddddd']);
  await expect(b.getByRole('button', { name: 'Quitar Tema ccccccccccc' })).toHaveCount(0);
  await b.getByRole('button', { name: 'Saltar' }).click();
  for (const p of [a, b, c]) await expect.poll(() => reproductor(p), { timeout: 5000 }).toBe(false);

  // Un link que no es de YouTube.
  await link.fill('https://example.com/watch?v=aaaaaaaaaaa');
  await agregar.click();
  await expect(a.getByRole('alert')).toHaveText('Ese link no es de YouTube.');
});

import { test, expect, type Page } from '@playwright/test';
import { crearCuenta, crearGrupo, de, unirse } from './cuentas';

type Stats = { mic: boolean; remotos: Record<string, { mic: boolean; bytes: number }> };
const stats = (p: Page) => p.evaluate(() => (window as unknown as { __voz: { stats(): Promise<Stats> } }).__voz.stats());
const bytesDe = async (p: Page, nombre: string) => de((await stats(p)).remotos, nombre)?.bytes ?? 0;
const tarjeta = (p: Page, nombre: string) => p.locator('section.voz li', { hasText: nombre });
const entrar = (p: Page) => p.getByRole('button', { name: 'Sala de voz General' }).click();

/** Los bytes recibidos de `nombre` en `p` crecen (o no) en ~2 s. */
async function audioLlega(p: Page, nombre: string) {
  const antes = await bytesDe(p, nombre);
  await p.waitForTimeout(2000);
  return (await bytesDe(p, nombre)) > antes;
}

test('tres personas en una sala de voz', async ({ browser }) => {
  const [a, b, c] = await Promise.all([0, 1, 2].map(async () => (await browser.newContext()).newPage()));

  await crearCuenta(a, 'Ana');
  const link = await crearGrupo(a, 'Voces');
  await crearCuenta(b, 'Beto');
  await unirse(b, link);
  await crearCuenta(c, 'Caro');
  await unirse(c, link);

  // Beto tiene guardados dispositivos que ya no existen: entra igual con los predeterminados.
  await b.evaluate(() => localStorage.setItem('dm.voz', JSON.stringify({ supresion: false, entrada: 'no-existe', salida: 'no-existe' })));

  // Los tres entran y cada uno ve a los tres.
  for (const p of [a, b, c]) await entrar(p);
  for (const p of [a, b, c]) await expect(p.locator('section.voz li')).toHaveCount(3, { timeout: 10_000 });
  await expect.poll(async () => (await stats(b)).mic, { timeout: 10_000 }).toBe(true);
  await expect(b.getByRole('alert')).toHaveCount(0);

  // El audio llega de verdad.
  await expect.poll(async () => Object.values((await stats(a)).remotos).filter((r) => r.bytes > 0).length, { timeout: 10_000 }).toBe(2);

  // El tono del micrófono falso enciende el borde "hablando" de Beto (se observa cada 50 ms por si es breve).
  await a.waitForFunction(() => [...document.querySelectorAll('section.voz li.hablando')].some((e) => e.textContent?.includes('Beto')),
    null, { polling: 50, timeout: 15_000 });

  // Ana silencia a Beto: Caro ve 🔇, Beto deja de publicar y su audio deja de llegar.
  await tarjeta(a, 'Beto').click({ button: 'right' });
  await a.getByRole('button', { name: 'Silenciar', exact: true }).click();
  await expect(tarjeta(c, 'Beto').getByLabel('Silenciado')).toBeVisible({ timeout: 5000 });
  await expect.poll(async () => de((await stats(c)).remotos, 'Beto')?.mic, { timeout: 5000 }).toBe(false);
  await expect.poll(async () => (await stats(b)).mic, { timeout: 5000 }).toBe(false);
  await expect(b.getByText('El dueño te silenció.')).toBeVisible();
  expect(await audioLlega(c, 'Beto')).toBe(false);

  // Beto sale y vuelve: sigue silenciado y no puede publicar.
  await b.getByRole('button', { name: 'Desconectarse', exact: true }).click();
  await expect(c.locator('section.voz li')).toHaveCount(2, { timeout: 10_000 });
  await expect(b.getByRole('alert')).toHaveCount(0); // salir a propósito no es un error
  await entrar(b);
  await expect(c.locator('section.voz li')).toHaveCount(3, { timeout: 10_000 });
  await expect(tarjeta(c, 'Beto').getByLabel('Silenciado')).toBeVisible();
  await expect(tarjeta(b, 'Beto').getByLabel('Silenciado')).toBeVisible({ timeout: 5000 });
  await b.waitForTimeout(2000); // le da tiempo a intentar publicar (y a que el 403 lo frene)
  expect((await stats(b)).mic).toBe(false);
  expect(de((await stats(c)).remotos, 'Beto')?.mic).toBe(false);
  expect(await audioLlega(c, 'Beto')).toBe(false);
  await expect(b.getByText('El dueño te silenció.')).toBeVisible();

  // Ana echa a Caro: Caro queda fuera de la llamada en menos de 15 s.
  await a.getByRole('button', { name: /^Participantes · / }).click();
  await a.locator('aside.participantes li', { hasText: 'Caro' }).click({ button: 'right' });
  await a.getByRole('button', { name: 'Expulsar del grupo' }).click();
  await a.getByRole('button', { name: 'Confirmar' }).click();
  await expect(c.getByRole('button', { name: 'Desconectarse', exact: true })).toHaveCount(0, { timeout: 15_000 });
  await expect(c.getByRole('alert')).toContainText('Te sacaron de la llamada.');
  await expect(a.locator('section.voz li')).toHaveCount(2, { timeout: 10_000 });

  // Ana le quita el silencio a Beto: vuelve a publicar.
  await tarjeta(a, 'Beto').click({ button: 'right' });
  await a.getByRole('button', { name: 'Quitar silencio' }).click();
  await expect.poll(async () => de((await stats(a)).remotos, 'Beto')?.mic, { timeout: 10_000 }).toBe(true);
  await expect(b.getByText('El dueño te silenció.')).toHaveCount(0);
  await expect.poll(() => audioLlega(a, 'Beto'), { timeout: 10_000 }).toBe(true);

  // Ana (supresión prendida por defecto) la apaga y la vuelve a prender: el audio sigue fluyendo en los dos sentidos.
  await a.getByRole('button', { name: 'Opciones del micrófono' }).click();
  const supresion = a.getByRole('button', { name: 'Supresión de ruido' });
  await expect(supresion).toHaveAttribute('aria-pressed', 'true');
  await supresion.click();
  await expect(supresion).toHaveAttribute('aria-pressed', 'false');
  expect(await audioLlega(b, 'Ana')).toBe(true);
  await supresion.click();
  await expect(supresion).toHaveAttribute('aria-pressed', 'true');
  expect(await audioLlega(a, 'Beto')).toBe(true);
  expect(await audioLlega(b, 'Ana')).toBe(true);
  await expect(a.getByRole('alert')).toHaveCount(0);

  // Desde otra página (Ana, sin entrar a la voz), la presencia lista a los conectados.
  const otra = await a.context().newPage();
  await otra.goto('/');
  await otra.getByRole('button', { name: 'Voces' }).click();
  const presencia = otra.locator('li.sala', { has: otra.getByRole('button', { name: 'Sala de voz General' }) }).locator('.quienes');
  await expect.poll(async () => (await presencia.getByRole('listitem').evaluateAll((li) => li.map((x) => (x as HTMLElement).title))).map((t) => t.slice(0, -4)).sort(), { timeout: 10_000 }).toEqual(['Ana', 'Beto']); // sin el sufijo de crearCuenta
});

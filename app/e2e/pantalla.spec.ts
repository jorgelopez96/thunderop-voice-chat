import { test, expect, type Page } from '@playwright/test';
import { crearCuenta, unirse } from './cuentas';

type Stats = { pantallas: Record<string, { frames: number }>; transmitiendo: boolean };
const stats = (p: Page) => p.evaluate(() => (window as unknown as { __voz: { stats(): Promise<Stats> } }).__voz.stats());
const framesDe = async (p: Page, nombre: string) => (await stats(p)).pantallas[nombre]?.frames ?? 0;
const tarjeta = (p: Page, nombre: string) => p.locator('section.voz li', { hasText: nombre });
const entrar = (p: Page) => p.getByRole('button', { name: '🔊 General' }).click();

test('transmitir y ver una pantalla', async ({ browser }) => {
  const [a, b, c] = await Promise.all([0, 1, 2].map(async () => (await browser.newContext()).newPage()));

  await crearCuenta(a, 'Ana');
  await a.getByRole('button', { name: 'Crear grupo' }).click();
  await a.getByPlaceholder('Nombre del grupo').fill('Pantallas');
  await a.getByRole('button', { name: 'Crear', exact: true }).click();
  await a.getByRole('button', { name: 'Invitar' }).click();
  const link = (await a.getByTestId('link-invitacion').textContent())!.trim();
  await crearCuenta(b, 'Beto');
  await unirse(b, link);
  await crearCuenta(c, 'Caro');
  await unirse(c, link);

  await entrar(a);
  await entrar(b);
  await expect(b.locator('section.voz li')).toHaveCount(2, { timeout: 10_000 });

  // Ana transmite en 720p: su tarjeta muestra "En vivo" y no hay avisos (fuera de Tauri no hay aviso de sonido).
  await a.getByRole('button', { name: 'Transmitir' }).click();
  await a.getByLabel('Calidad').selectOption({ label: '720p · 30 fps' });
  await a.getByRole('button', { name: 'Empezar' }).click();
  await expect(tarjeta(a, 'Ana').getByText('📺 En vivo')).toBeVisible({ timeout: 10_000 });
  await expect(a.getByRole('button', { name: 'Dejar de transmitir' })).toBeVisible();
  await expect(a.getByRole('alert')).toHaveCount(0);

  // Beto la ve y los frames crecen.
  await tarjeta(b, 'Ana').getByRole('button', { name: 'Ver' }).click();
  await expect(b.getByLabel('Pantalla de Ana')).toBeVisible();
  await expect.poll(() => framesDe(b, 'Ana'), { timeout: 10_000 }).toBeGreaterThan(0);
  const antes = await framesDe(b, 'Ana');
  await b.waitForTimeout(3000);
  expect(await framesDe(b, 'Ana')).toBeGreaterThan(antes);

  // Caro entra después: ve "Ver" y no se suscribe sola.
  await entrar(c);
  await expect(tarjeta(c, 'Ana').getByRole('button', { name: 'Ver' })).toBeVisible({ timeout: 10_000 });
  await c.waitForTimeout(2000);
  expect(await framesDe(c, 'Ana')).toBe(0);

  // Ana corta: Beto pierde el video y el botón en menos de 5 s.
  await a.getByRole('button', { name: 'Dejar de transmitir' }).click();
  await expect(b.getByLabel('Pantalla de Ana')).toHaveCount(0, { timeout: 5000 });
  await expect(tarjeta(b, 'Ana').getByRole('button', { name: /^(Ver|Dejar de ver)$/ })).toHaveCount(0, { timeout: 5000 });

  // Ana transmite otra vez y se desconecta: el "En vivo" desaparece en Beto en menos de 10 s.
  await a.getByRole('button', { name: 'Transmitir' }).click();
  await a.getByRole('button', { name: 'Empezar' }).click();
  await expect(tarjeta(b, 'Ana').getByText('📺 En vivo')).toBeVisible({ timeout: 10_000 });
  await a.getByRole('button', { name: 'Desconectar' }).click();
  await expect(b.getByText('📺 En vivo')).toHaveCount(0, { timeout: 10_000 });
});

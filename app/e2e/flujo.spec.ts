import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { crearCuenta, crearGrupo, unirse } from './cuentas';

const img = fileURLToPath(new URL('../../server/tests/fixtures/img.png', import.meta.url));

test('cuentas, grupos, invitaciones y chat', async ({ browser }) => {
  const a = await (await browser.newContext()).newPage();
  const b = await (await browser.newContext()).newPage();

  // 1-2
  await crearCuenta(a, 'Ana');
  const link = await crearGrupo(a, 'Los pibes');

  // 3
  await crearCuenta(b, 'Beto');
  await unirse(b, link);
  await b.getByRole('button', { name: 'Sala de chat General' }).click();
  await a.getByRole('button', { name: 'Sala de chat General' }).click();

  // 4
  await b.getByPlaceholder(/Escribí un mensaje/).fill('hola');
  await b.getByRole('button', { name: 'Enviar' }).click();
  await expect(a.getByTestId('mensaje').filter({ hasText: 'hola' })).toBeVisible({ timeout: 3000 });

  // 5
  await a.getByTestId('adjuntar').setInputFiles(img);
  await a.getByRole('button', { name: 'Enviar' }).click();
  await expect(b.getByTestId('mensajes').locator('img[alt="Imagen adjunta"]')).toBeVisible({ timeout: 5000 });

  // 6
  const hola = a.getByTestId('mensaje').filter({ hasText: 'hola' });
  await hola.hover(); // las herramientas del mensaje aparecen al pasar el mouse
  await hola.getByRole('button', { name: 'Borrar' }).click();
  await a.getByRole('button', { name: 'Confirmar' }).click();
  await expect(b.getByTestId('mensaje').filter({ hasText: 'hola' })).toHaveCount(0);

  // 7
  await a.getByRole('listitem').filter({ hasText: 'Beto' }).click({ button: 'right' });
  await a.getByRole('button', { name: 'Expulsar del grupo' }).click();
  await a.getByRole('button', { name: 'Confirmar' }).click();
  await expect(b.getByRole('heading', { name: /^¡Hola/ })).toBeVisible({ timeout: 15_000 });
  await expect(b.getByRole('button', { name: 'Los pibes' })).toHaveCount(0);
});

test('sin tocar la PC 10 minutos se ve "Ausente" para los demás, y al volver "Disponible"', async ({ browser }) => {
  const a = await (await browser.newContext()).newPage();
  const b = await (await browser.newContext()).newPage();
  await b.clock.install();
  await crearCuenta(a, 'Ana');
  const link = await crearGrupo(a, 'Los quietos');
  await crearCuenta(b, 'Beto');
  await unirse(b, link);
  const luz = a.getByRole('listitem').filter({ hasText: 'Beto' }).locator('.luz');
  await expect(luz).toHaveAttribute('title', 'Disponible', { timeout: 10_000 });
  await b.clock.fastForward('10:05');
  await expect(luz).toHaveAttribute('title', 'Ausente', { timeout: 10_000 });
  await b.mouse.move(200, 200);
  await b.clock.fastForward(4_000);
  await expect(luz).toHaveAttribute('title', 'Disponible', { timeout: 10_000 });
});

test('al cerrar la app los demás lo ven desconectado en segundos, no al minuto y medio', async ({ browser }) => {
  const a = await (await browser.newContext()).newPage();
  const ctxB = await browser.newContext();
  const b = await ctxB.newPage();
  await crearCuenta(a, 'Ana');
  const link = await crearGrupo(a, 'Los que se van');
  await crearCuenta(b, 'Beto');
  await unirse(b, link);
  const luz = a.getByRole('listitem').filter({ hasText: 'Beto' }).locator('.luz');
  await expect(luz).toHaveAttribute('title', 'Disponible', { timeout: 10_000 });
  await b.reload(); // recargar corta y vuelve a conectar: no tiene que verse desconectado
  await a.waitForTimeout(6_000);
  await expect(luz).toHaveAttribute('title', 'Disponible');
  await ctxB.close(); // Beto latió hace segundos: sin el aviso de desconexión tardaría más de 80 s (la tarea arranca al minuto de prender el servidor)
  await expect(luz).toHaveAttribute('title', 'Desconectado', { timeout: 75_000 });
});

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

import { test, expect, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const img = fileURLToPath(new URL('../../server/tests/fixtures/img.png', import.meta.url));
const sufijo = Date.now();

async function crearCuenta(page: Page, nombre: string) {
  await page.goto('/');
  await page.getByRole('tab', { name: 'Crear cuenta' }).click();
  await page.getByLabel('Nombre').fill(nombre);
  await page.getByLabel('Email').fill(`${nombre}${sufijo}@test.local`);
  await page.getByLabel('Contraseña').fill('clave-segura-123');
  await page.getByRole('button', { name: 'Crear cuenta', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Mis grupos' })).toBeVisible();
}

test('cuentas, grupos, invitaciones y chat', async ({ browser }) => {
  const a = await (await browser.newContext()).newPage();
  const b = await (await browser.newContext()).newPage();

  // 1-2
  await crearCuenta(a, 'Ana');
  await a.getByRole('button', { name: 'Crear grupo' }).click();
  await a.getByPlaceholder('Nombre del grupo').fill('Los pibes');
  await a.getByRole('button', { name: 'Crear', exact: true }).click();
  await a.getByRole('button', { name: 'Invitar' }).click();
  const link = (await a.getByTestId('link-invitacion').textContent())!.trim();

  // 3
  await crearCuenta(b, 'Beto');
  await b.getByRole('button', { name: 'Unirme con código' }).click();
  await b.getByPlaceholder('Código o link de invitación').fill(link);
  await b.getByRole('button', { name: 'Unirme', exact: true }).click();
  await expect(b.getByRole('heading', { name: 'Salas de chat' })).toBeVisible();
  await b.getByRole('button', { name: '# General' }).click();
  await a.getByRole('button', { name: '# General' }).click();

  // 4
  await b.getByPlaceholder(/Escribí un mensaje/).fill('hola');
  await b.getByRole('button', { name: 'Enviar' }).click();
  await expect(a.getByTestId('mensaje').filter({ hasText: 'hola' })).toBeVisible({ timeout: 3000 });

  // 5
  await a.getByTestId('adjuntar').setInputFiles(img);
  await a.getByRole('button', { name: 'Enviar' }).click();
  await expect(b.getByTestId('mensajes').locator('img[alt="Imagen adjunta"]')).toBeVisible({ timeout: 5000 });

  // 6
  await a.getByTestId('mensaje').filter({ hasText: 'hola' }).getByRole('button', { name: 'Borrar' }).click();
  await expect(b.getByTestId('mensaje').filter({ hasText: 'hola' })).toHaveCount(0);

  // 7
  await a.getByRole('listitem').filter({ hasText: 'Beto' }).getByRole('button', { name: 'Echar' }).click();
  await a.getByRole('button', { name: 'Confirmar' }).click();
  await expect(b.getByRole('heading', { name: 'Mis grupos' })).toBeVisible({ timeout: 15_000 });
  await expect(b.getByRole('button', { name: 'Los pibes' })).toHaveCount(0);
});

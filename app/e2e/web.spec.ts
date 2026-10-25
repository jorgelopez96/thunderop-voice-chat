import { test, expect } from '@playwright/test';
import { crearCuenta, crearGrupo } from './cuentas';

// Versión web: lo que en el navegador se comporta distinto que en el escritorio.

test('sin permiso de micrófono: cartel claro y el chat sigue andando', async ({ browser }) => {
  const p = await (await browser.newContext()).newPage();
  await p.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('negado', 'NotAllowedError'));
  });
  await crearCuenta(p, 'Ana');
  await crearGrupo(p, 'Sin mic');
  await p.getByRole('button', { name: 'Sala de voz General' }).click();
  await expect(p.getByRole('alert').filter({ hasText: 'No hay permiso para usar el micrófono. Habilitalo en el navegador para hablar.' })).toBeVisible({ timeout: 15_000 });
  await p.getByRole('button', { name: 'Sala de chat general' }).click();
  await p.getByPlaceholder('Escribí un mensaje').fill('hola igual');
  await p.getByRole('button', { name: 'Enviar' }).click();
  await expect(p.getByTestId('mensaje').filter({ hasText: 'hola igual' })).toBeVisible();
});

test('notificaciones negadas en el navegador: llega el mensaje sin errores', async ({ browser }) => {
  const errores: string[] = [];
  const a = await (await browser.newContext()).newPage();
  const b = await (await browser.newContext()).newPage();
  await b.addInitScript(() => {
    Object.defineProperty(window, 'Notification', { value: Object.assign(function () { throw new Error('no debería crearse'); }, { permission: 'denied', requestPermission: () => Promise.resolve('denied') }) });
  });
  b.on('pageerror', (e) => errores.push(e.message));
  await crearCuenta(a, 'Ana');
  const link = await crearGrupo(a, 'Avisos');
  await crearCuenta(b, 'Beto');
  await b.getByRole('button', { name: 'Unirme con código' }).click();
  await b.getByPlaceholder('Código o link de invitación').fill(link);
  await b.getByRole('button', { name: 'Unirme', exact: true }).click();
  await b.getByRole('button', { name: 'Sala de chat general' }).click();
  await b.getByRole('button', { name: /^Inicio$/ }).first().click().catch(() => {}); // fuera del chat para que avise
  await a.getByRole('button', { name: 'Sala de chat general' }).click();
  await a.getByPlaceholder('Escribí un mensaje').fill('che');
  await a.getByRole('button', { name: 'Enviar' }).click();
  await expect(a.getByTestId('mensaje').filter({ hasText: 'che' })).toBeVisible();
  await b.waitForTimeout(1500);
  expect(errores).toEqual([]);
});

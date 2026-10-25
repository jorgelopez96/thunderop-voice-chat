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

// Pantalla compartida falsa (un canvas animado) o un selector cancelado, en lugar del diálogo real del navegador.
const pantallaFalsa = () => {
  navigator.mediaDevices.getDisplayMedia = async () => {
    const c = Object.assign(document.createElement('canvas'), { width: 640, height: 360 });
    const g = c.getContext('2d')!;
    let n = 0;
    setInterval(() => { g.fillStyle = `hsl(${(n += 7) % 360} 60% 50%)`; g.fillRect(0, 0, 640, 360); }, 50);
    return c.captureStream(30);
  };
};
const selectorCancelado = () => {
  navigator.mediaDevices.getDisplayMedia = () => Promise.reject(new DOMException('cancelado', 'NotAllowedError'));
};

async function dosEnLaSala(browser: import('@playwright/test').Browser, alAna: () => void) {
  const a = await (await browser.newContext()).newPage();
  const b = await (await browser.newContext()).newPage();
  await a.addInitScript(alAna);
  await crearCuenta(a, 'Ana');
  const link = await crearGrupo(a, 'Pantallas web');
  await crearCuenta(b, 'Beto');
  await b.getByRole('button', { name: 'Unirme con código' }).click();
  await b.getByPlaceholder('Código o link de invitación').fill(link);
  await b.getByRole('button', { name: 'Unirme', exact: true }).click();
  for (const p of [a, b]) await p.getByRole('button', { name: 'Sala de voz General' }).click();
  await expect(b.locator('section.voz li')).toHaveCount(2, { timeout: 15_000 });
  return { a, b };
}

test('transmitir desde el navegador: el otro ve EN VIVO y puede mirarla', async ({ browser }) => {
  const { a, b } = await dosEnLaSala(browser, pantallaFalsa);
  await a.getByRole('button', { name: 'Transmitir', exact: true }).click();
  await a.getByRole('combobox').selectOption('720p30');
  await expect(a.locator('dialog.fuentes .grilla')).toHaveCount(0); // el navegador elige qué compartir
  await a.getByRole('button', { name: 'Empezar' }).click();
  const tarjeta = b.locator('section.voz li', { hasText: 'Ana' });
  await expect(tarjeta.getByText('EN VIVO')).toBeVisible({ timeout: 15_000 });
  await tarjeta.getByRole('button', { name: 'Ver' }).click();
  await expect(b.locator('.escenario video')).toBeVisible({ timeout: 15_000 });
});

test('cancelar el selector del navegador no deja nada a medias', async ({ browser }) => {
  const { a } = await dosEnLaSala(browser, selectorCancelado);
  await a.getByRole('button', { name: 'Transmitir', exact: true }).click();
  await a.getByRole('button', { name: 'Empezar' }).click();
  await a.waitForTimeout(1500);
  await expect(a.getByText('EN VIVO')).toHaveCount(0);
  await expect(a.getByRole('alert')).toHaveCount(0);
  await expect(a.getByRole('button', { name: 'Transmitir', exact: true })).toBeVisible();
});

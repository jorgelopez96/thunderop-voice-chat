import { test, expect } from '@playwright/test';
import { crearCuenta, crearGrupo, unirse } from './cuentas';

test('foto de perfil: un GIF de 3 MB se sube y se muestra entero (animado, sin miniatura)', async ({ page }) => {
  await crearCuenta(page, 'Gifo');
  // GIF de 1×1 válido + relleno después del final: pesa 3 MB y sigue siendo image/gif.
  const gif = Buffer.concat([Buffer.from('R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==', 'base64'), Buffer.alloc(3 * 1024 * 1024)]);
  await page.getByRole('button', { name: /Gifo/ }).first().click();
  await page.getByRole('button', { name: 'Editar perfil' }).click();
  await page.getByLabel('Foto de perfil', { exact: true }).setInputFiles({ name: 'baile.gif', mimeType: 'image/gif', buffer: gif });
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.getByText('Perfil guardado.')).toBeVisible();
  // El avatar de la barra de arriba ya es el del servidor: el GIF entero, no la miniatura (que queda quieta).
  const delServidor = page.locator('img[src*="/api/files/"][src*=".gif"]').first();
  await expect(delServidor).toBeVisible();
  expect(await delServidor.getAttribute('src')).not.toContain('thumb=');
});

test('en la sala: mensaje privado a un amigo, ancho del chat y configuración con Guardar', async ({ browser }) => {
  const [a, b] = await Promise.all([0, 1].map(async () => (await browser.newContext()).newPage()));
  await crearCuenta(a, 'Ana');
  const link = await crearGrupo(a, 'Interfaz');
  await crearCuenta(b, 'Beto');
  await unirse(b, link);

  // Ana le manda solicitud a Beto desde los participantes y Beto la acepta.
  await a.locator('aside.participantes li', { hasText: 'Beto' }).click({ button: 'right' });
  await a.getByRole('button', { name: 'Agregar amigo' }).click();
  await b.getByRole('button', { name: /^Notificaciones/ }).click();
  await b.getByRole('button', { name: 'Aceptar' }).click();

  for (const p of [a, b]) await p.getByRole('button', { name: 'Sala de voz General' }).click();
  await expect(a.locator('section.voz li')).toHaveCount(2, { timeout: 10_000 });

  // Clic derecho en la tarjeta de Beto → Enviar mensaje abre el privado encima de la sala.
  await a.locator('section.voz li', { hasText: 'Beto' }).click({ button: 'right' });
  await a.getByRole('button', { name: 'Enviar mensaje' }).click();
  const privado = a.locator('dialog.privado');
  await expect(privado).toBeVisible();
  await expect(privado.locator('.nombre-chat')).toContainText('Beto');
  await privado.getByLabel('Cerrar chat').click();
  await expect(privado).toBeHidden();
  await expect(a.locator('section.voz')).toBeVisible();

  // El chat de la sala se agranda arrastrando su borde y queda guardado.
  const chat = a.locator('aside.chatSala');
  const antes = (await chat.boundingBox())!.width;
  const borde = (await a.getByRole('separator', { name: 'Ancho del chat' }).boundingBox())!;
  await a.mouse.move(borde.x + 4, borde.y + 200);
  await a.mouse.down();
  await a.mouse.move(borde.x - 196, borde.y + 200, { steps: 5 });
  await a.mouse.up();
  await expect.poll(async () => (await chat.boundingBox())!.width).toBeGreaterThan(antes + 150);
  expect(Number(await a.evaluate(() => localStorage.getItem('dm.anchoChatSala')))).toBeGreaterThan(antes + 150);
  // Achicarlo de más no lo deja por debajo del ancho de siempre.
  const borde2 = (await a.getByRole('separator', { name: 'Ancho del chat' }).boundingBox())!;
  await a.mouse.move(borde2.x + 4, borde2.y + 200);
  await a.mouse.down();
  await a.mouse.move(borde2.x + 600, borde2.y + 200, { steps: 5 });
  await a.mouse.up();
  await expect.poll(async () => Math.round((await chat.boundingBox())!.width)).toBe(Math.round(antes));

  // El menú del micrófono marca con tilde el que está elegido.
  await a.getByRole('button', { name: 'Opciones del micrófono' }).first().click();
  const marcado = a.locator('.menu:popover-open button[aria-pressed="true"]');
  await expect(marcado).toHaveCount(1);
  await expect(marcado.locator('svg')).toBeVisible();
  await a.screenshot({ path: 'test-results/z-menu-mic.png' });
  await a.keyboard.press('Escape');

  // Configuración: se ve todo sin scroll (en 1280×720) y Guardar la cierra. El nombre del Predeterminado lo prueba dispositivos.test.ts.
  await a.getByRole('button', { name: 'Configuración' }).click();
  const config = a.locator('dialog.config');
  for (const solapa of ['Cuenta', 'Audio', 'Transmisión', 'Notificaciones', 'Apariencia y rendimiento']) {
    await config.getByRole('tab', { name: solapa }).click();
    expect(await config.evaluate((d) => d.scrollHeight - d.clientHeight), solapa).toBeLessThanOrEqual(1);
  }
  await config.getByRole('button', { name: 'Guardar' }).click();
  await expect(config).toBeHidden();
});

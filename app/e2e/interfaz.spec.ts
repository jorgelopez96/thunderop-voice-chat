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
  await page.keyboard.press('Escape');

  // La foto del grupo, igual: 3 MB y el GIF entero.
  await crearGrupo(page, 'Gifs');
  await page.getByRole('button', { name: 'Gifs', exact: true }).click();
  await page.getByRole('button', { name: 'Configuraciones' }).click();
  await page.locator('dialog.config input[type="file"]').setInputFiles({ name: 'grupo.gif', mimeType: 'image/gif', buffer: gif });
  const delGrupo = page.locator('dialog.config .foto img');
  await expect(delGrupo).toHaveAttribute('src', /\.gif/);
  expect(await delGrupo.getAttribute('src')).not.toContain('thumb=');
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

  // Beto cambia la foto: Ana la ve al toque en la tarjeta de la llamada, sin recargar.
  const fotoDeBeto = a.locator('section.voz li', { hasText: 'Beto' }).locator('img.avatar');
  await expect(fotoDeBeto).toHaveAttribute('src', /^data:/); // todavía la inicial
  await b.getByRole('button', { name: /Beto/ }).first().click();
  await b.getByRole('button', { name: 'Editar perfil' }).click();
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  await b.getByLabel('Foto de perfil', { exact: true }).setInputFiles({ name: 'nueva.png', mimeType: 'image/png', buffer: png });
  await b.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(b.getByText('Perfil guardado.')).toBeVisible();
  await expect(fotoDeBeto).toHaveAttribute('src', /\/api\/files\/.*nueva/, { timeout: 3000 });

  // Y el nombre: Ana lo ve cambiado en la tarjeta de la llamada y en los participantes, sin recargar.
  await b.getByLabel('Apodo').fill('Bertito');
  await b.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(a.locator('section.voz li', { hasText: 'Bertito' })).toBeVisible({ timeout: 3000 });
  await expect(a.locator('aside.participantes li', { hasText: 'Bertito' })).toHaveCount(1);
});

test('con una versión nueva bajada aparece el botón Actualizar al lado de la campanita', async ({ page }) => {
  await crearCuenta(page, 'Upda');
  await expect(page.getByRole('button', { name: 'Actualizar' })).toHaveCount(0);
  // En el navegador no hay actualizador: se simula que el chequeo de fondo ya la bajó.
  await page.evaluate(async () => { (await import('/src/lib/actualizacion.svelte.ts')).actualizacion.pendiente = '9.9.9'; });
  await page.getByRole('button', { name: 'Actualizar' }).click();
  await expect(page.getByText('con la versión 9.9.9')).toBeVisible();
  await page.screenshot({ path: 'test-results/z-actualizar.png' });
});

test('seleccionar texto en un modal y soltar afuera no lo cierra; un clic afuera sí', async ({ browser }) => {
  const p = await (await browser.newContext()).newPage();
  await crearCuenta(p, 'Ana');
  await crearGrupo(p, 'Modales');
  await p.getByRole('button', { name: 'Modales', exact: true }).click();
  await p.getByRole('button', { name: 'Configuraciones' }).click();
  const modal = p.locator('dialog.config');
  await expect(modal).toBeVisible();
  const campo = (await modal.getByLabel('Nombre del grupo').boundingBox())!;
  const caja = (await modal.boundingBox())!;
  // Arrastra desde adentro del campo hasta el fondo, como al seleccionar texto.
  await p.mouse.move(campo.x + 5, campo.y + campo.height / 2);
  await p.mouse.down();
  await p.mouse.move(caja.x + caja.width + 40, caja.y + 10, { steps: 6 });
  await p.mouse.up();
  await expect(modal).toBeVisible();
  // Clic de verdad en el fondo: se cierra.
  await p.mouse.click(caja.x + caja.width + 40, caja.y + 10);
  await expect(modal).toBeHidden();
});

test('modo moderno: el modal se cierra con animación y después no traba los clics', async ({ browser }) => {
  const p = await (await browser.newContext()).newPage();
  await p.addInitScript(() => { try { localStorage.setItem('dm.modo', 'moderno'); } catch { /* sin almacenamiento */ } });
  await crearCuenta(p, 'Ana');
  expect(await p.evaluate(() => document.documentElement.dataset.modo)).toBe('moderno');
  await p.getByRole('button', { name: 'Configuración' }).click();
  await expect(p.locator('dialog.config')).toBeVisible();
  await p.keyboard.press('Escape');
  await expect(p.locator('dialog.config')).toBeHidden();
  // Enseguida se puede usar lo de atrás (el modal que se va no se queda tapando).
  await p.getByRole('button', { name: 'Crear mi grupo' }).click({ timeout: 2000 });
  await expect(p.getByPlaceholder('Nombre del grupo nuevo')).toBeVisible();
});

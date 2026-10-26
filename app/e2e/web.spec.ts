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

/** Celular: vuelve a la lista de salas del grupo con el ‹ de la cabecera (si ya está en la lista, no hace nada). */
async function aLaLista(p: import('@playwright/test').Page) {
  const v = p.locator('h2.titulo, section.voz header').getByRole('button', { name: 'Volver', exact: true });
  if (await v.count()) await v.first().click();
}

const CELULAR = { width: 390, height: 844 };
const sinScrollLateral = (p: import('@playwright/test').Page) => p.evaluate(() => document.documentElement.scrollWidth <= innerWidth);

test('celular: pestañas abajo con Inicio, Grupos, Amigos y Perfil', async ({ browser }) => {
  const p = await (await browser.newContext({ viewport: CELULAR })).newPage();
  await crearCuenta(p, 'Ana');
  const pestanas = p.getByRole('navigation', { name: 'Secciones' });
  for (const n of ['Inicio', 'Grupos', 'Amigos', 'Perfil']) await expect(pestanas.getByRole('button', { name: n })).toBeVisible();
  expect(await sinScrollLateral(p)).toBe(true);
  await pestanas.getByRole('button', { name: 'Amigos' }).click();
  await expect(p.getByRole('button', { name: 'Agregar amigo' }).first()).toBeVisible();
  expect(await sinScrollLateral(p)).toBe(true);
  await pestanas.getByRole('button', { name: 'Perfil' }).click();
  await expect(p.getByLabel('Apodo')).toBeVisible();
  // Configuración y notificaciones van arriba (engranaje y campanita), no repetidas en Perfil.
  await expect(p.locator('.perfil-movil').getByRole('button', { name: 'Cerrar sesión', exact: true })).toBeVisible();
  for (const n of ['Configuración', 'Notificaciones']) await expect(p.locator('.perfil-movil').getByRole('button', { name: n, exact: true })).toHaveCount(0);
  await expect(p.locator('.barra-movil').getByRole('button', { name: 'Configuración' })).toBeVisible();
  expect(await sinScrollLateral(p)).toBe(true);
});

test('PC: sin pestañas, con la barra de siempre', async ({ browser }) => {
  const p = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  await crearCuenta(p, 'Ana');
  await expect(p.getByRole('navigation', { name: 'Secciones' })).toHaveCount(0);
  await expect(p.getByRole('button', { name: 'Configuración' })).toBeVisible();
});

test('celular: grupo con la lista de salas a pantalla completa, ‹ y botón atrás', async ({ browser }) => {
  const p = await (await browser.newContext({ viewport: CELULAR })).newPage();
  await crearCuenta(p, 'Ana');
  await p.getByRole('button', { name: 'Crear mi grupo' }).click();
  await p.getByPlaceholder('Nombre del grupo nuevo').fill('Celus');
  await p.getByRole('button', { name: 'Crear grupo' }).click();
  // Entra a la lista de salas, a pantalla completa y sin pestañas (ya no hay cajón ☰).
  const chatGeneral = p.getByRole('button', { name: 'Sala de chat General' });
  await expect(chatGeneral).toBeInViewport();
  await expect(p.getByRole('button', { name: 'Sala de voz General' })).toBeInViewport();
  await expect(p.getByRole('navigation', { name: 'Secciones' })).toHaveCount(0);
  await expect(p.getByRole('button', { name: 'Abrir salas' })).toHaveCount(0);
  expect(await sinScrollLateral(p)).toBe(true);
  // Tocar el chat lo abre a pantalla completa; ‹ vuelve a la lista.
  await chatGeneral.click();
  const titulo = p.locator('h2.titulo', { hasText: '# General' });
  await expect(titulo).toBeVisible();
  await expect(chatGeneral).not.toBeInViewport();
  await aLaLista(p);
  await expect(chatGeneral).toBeInViewport();
  // Atrás del sistema también vuelve a la lista.
  await chatGeneral.click();
  await expect(titulo).toBeVisible();
  await p.goBack();
  await expect(chatGeneral).toBeInViewport();
  // 👥 desde la lista abre Participantes; atrás lo cierra.
  await p.getByRole('button', { name: 'Ver participantes' }).click();
  await expect(p.getByText(/^Participantes — /)).toBeInViewport();
  await p.goBack();
  await expect(p.getByText(/^Participantes — /)).not.toBeInViewport();
  // ‹ en la lista sale del grupo a las pestañas.
  await p.locator('.salas').getByRole('button', { name: 'Volver', exact: true }).click();
  await expect(p.getByRole('navigation', { name: 'Secciones' })).toBeVisible();
});

test('girar o achicar la pantalla no corta la llamada ni cambia el chat', async ({ browser }) => {
  const p = await (await browser.newContext({ viewport: CELULAR })).newPage();
  await crearCuenta(p, 'Ana');
  await p.getByRole('button', { name: 'Crear mi grupo' }).click();
  await p.getByPlaceholder('Nombre del grupo nuevo').fill('Giro');
  await p.getByRole('button', { name: 'Crear grupo' }).click();
  await aLaLista(p);
  await p.getByRole('button', { name: 'Sala de voz General' }).click();
  await expect(p.getByRole('button', { name: 'Desconectarse' })).toBeVisible({ timeout: 15_000 });
  for (const v of [{ width: 1280, height: 800 }, CELULAR]) {
    await p.setViewportSize(v);
    await expect(p.getByRole('button', { name: 'Desconectarse' })).toBeVisible();
  }
});

test('celular: la llamada con su dock, el chat de la sala y la barrita en otras pantallas', async ({ browser }) => {
  const p = await (await browser.newContext({ viewport: CELULAR })).newPage();
  await crearCuenta(p, 'Ana');
  await p.getByRole('button', { name: 'Crear mi grupo' }).click();
  await p.getByPlaceholder('Nombre del grupo nuevo').fill('Llamadas');
  await p.getByRole('button', { name: 'Crear grupo' }).click();
  await aLaLista(p);
  await p.getByRole('button', { name: 'Sala de voz General' }).click();
  // En la sala: grilla de 2 columnas y el dock de llamada en lugar de las pestañas.
  const dock = p.getByRole('toolbar', { name: 'Llamada' });
  for (const n of ['Silenciarme', 'Ensordecerme', 'Música', 'Chat de la sala', 'Desconectarse']) await expect(dock.getByRole('button', { name: n })).toBeVisible({ timeout: 15_000 });
  expect(await p.locator('section.voz .franja').evaluate((e) => getComputedStyle(e).gridTemplateColumns.split(' ').length)).toBe(2);
  expect(await sinScrollLateral(p)).toBe(true);
  // El chat de la sala a pantalla completa; atrás lo cierra.
  await dock.getByRole('button', { name: 'Chat de la sala' }).click();
  await expect(p.locator('h2.titulo', { hasText: 'Chat de la sala' })).toBeInViewport();
  await p.goBack();
  await expect(p.locator('h2.titulo', { hasText: 'Chat de la sala' })).not.toBeInViewport();
  // En otro chat: la barrita de llamada; afuera del grupo también, arriba de las pestañas.
  await aLaLista(p);
  await p.getByRole('button', { name: 'Sala de chat general' }).click();
  const barrita = p.getByRole('button', { name: 'Volver a la llamada' });
  await expect(barrita).toBeVisible();
  await expect(dock).toHaveCount(0);
  await p.goBack(); // a la lista
  await p.goBack(); // afuera del grupo
  await expect(p.getByRole('navigation', { name: 'Secciones' })).toBeVisible();
  await expect(barrita).toBeVisible();
  // Tocarla vuelve a la sala; colgar desde la barrita sale de la llamada.
  await barrita.click();
  await expect(dock).toBeVisible();
  await aLaLista(p);
  await p.getByRole('button', { name: 'Sala de chat general' }).click();
  await p.locator('.barra-llamada').getByRole('button', { name: 'Desconectarse' }).click();
  await expect(barrita).toHaveCount(0);
});

/** Mantener apretado con el dedo (eventos de puntero táctil) ~650 ms sobre el centro del elemento. */
async function mantenerApretado(l: import('@playwright/test').Locator) {
  const c = (await l.boundingBox())!;
  const pos = { clientX: c.x + c.width / 2, clientY: c.y + c.height / 2, pointerType: 'touch', isPrimary: true, bubbles: true };
  await l.dispatchEvent('pointerdown', pos);
  await l.page().waitForTimeout(650);
  await l.dispatchEvent('pointerup', pos);
}

test('celular: mantener apretado abre las acciones de mensajes y personas', async ({ browser }) => {
  const p = await (await browser.newContext({ viewport: CELULAR, hasTouch: true })).newPage();
  await crearCuenta(p, 'Ana');
  await p.getByRole('button', { name: 'Crear mi grupo' }).click();
  await p.getByPlaceholder('Nombre del grupo nuevo').fill('Toques');
  await p.getByRole('button', { name: 'Crear grupo' }).click();
  await p.getByRole('button', { name: 'Sala de chat General' }).click();
  await p.getByPlaceholder('Escribí un mensaje').fill('hola');
  await p.getByRole('button', { name: 'Enviar' }).click();
  // Mensaje propio: reaccionar, responder, editar y borrar.
  await mantenerApretado(p.getByTestId('mensaje').filter({ hasText: 'hola' }));
  const hoja = p.getByRole('menu');
  for (const n of ['Reaccionar', 'Responder', 'Editar', 'Borrar']) await expect(hoja.getByRole('button', { name: n })).toBeVisible();
  await p.goBack();
  await expect(hoja).toHaveCount(0);
  // Una persona (la propia, en Participantes): su menú con Ver perfil.
  await p.getByRole('button', { name: 'Ver participantes' }).click();
  await mantenerApretado(p.locator('aside.participantes li').first());
  await expect(p.getByRole('button', { name: 'Ver perfil' })).toBeVisible();
  await p.keyboard.press('Escape');
  await p.goBack();
  // En el celular las salas no se ordenan (eso es en la PC, arrastrando).
});

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

test('instalable: manifest con nombre, modo app e íconos', async ({ page }) => {
  await page.goto('/');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toBeTruthy();
  const m = await (await page.request.get(href!)).json();
  expect(m).toMatchObject({ name: 'Thunderop', display: 'standalone', start_url: '/' });
  expect(m.icons.map((i: { sizes: string }) => i.sizes)).toEqual(expect.arrayContaining(['192x192', '512x512']));
  for (const i of m.icons) expect((await page.request.get(i.src)).ok()).toBe(true);
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);
});

for (const [nombre, ua, texto] of [
  ['Android', undefined, 'Si bloqueás la pantalla o cambiás de app, la llamada puede cortarse.'],
  ['iPhone', IPHONE, 'En iPhone, la llamada se corta si bloqueás la pantalla o cambiás de app.'],
] as const) {
  test(`celular (${nombre}): aviso de la llamada al entrar, una vez por sesión`, async ({ browser }) => {
    const p = await (await browser.newContext({ viewport: CELULAR, ...(ua ? { userAgent: ua } : {}) })).newPage();
    await crearCuenta(p, 'Ana');
    await p.getByRole('button', { name: 'Crear mi grupo' }).click();
    await p.getByPlaceholder('Nombre del grupo nuevo').fill('Avisos');
    await p.getByRole('button', { name: 'Crear grupo' }).click();
    await aLaLista(p);
    await p.getByRole('button', { name: 'Sala de voz General' }).click();
    await expect(p.getByText(texto)).toBeVisible({ timeout: 15_000 });
    await p.getByRole('button', { name: 'Entendido' }).click();
    await p.getByRole('button', { name: 'Desconectarse' }).first().click();
    await aLaLista(p);
    await p.getByRole('button', { name: 'Sala de voz General' }).click();
    await expect(p.getByRole('toolbar', { name: 'Llamada' })).toBeVisible({ timeout: 15_000 });
    await expect(p.getByText(texto)).toHaveCount(0);
  });
}

test('celular: las cabeceras del chat y la sala y la caja de mensaje reservan el notch y la barra de gestos', async ({ browser }) => {
  const p = await (await browser.newContext({ viewport: CELULAR })).newPage();
  await crearCuenta(p, 'Ana');
  await p.getByRole('button', { name: 'Crear mi grupo' }).click();
  await p.getByPlaceholder('Nombre del grupo nuevo').fill('Notch');
  await p.getByRole('button', { name: 'Crear grupo' }).click();
  await p.getByRole('button', { name: 'Sala de chat General' }).click();
  await expect(p.locator('h2.titulo')).toBeVisible();
  // Chromium no simula el notch (env() da 0): se comprueba que las reglas lo usen.
  const usa = (selector: string, prop: string) => p.evaluate(([sel, pr]) => [...document.styleSheets].flatMap((s) => [...s.cssRules])
    .some((r) => r instanceof CSSStyleRule && r.selectorText.includes(sel) && r.style.getPropertyValue(pr).includes('safe-area-inset')), [selector, prop]);
  expect(await usa('.titulo', 'padding-top')).toBe(true);
  expect(await usa('.composer', 'margin-bottom')).toBe(true);
  await aLaLista(p);
  await p.getByRole('button', { name: 'Sala de voz General' }).click();
  await expect(p.locator('section.voz header')).toBeVisible();
  expect(await usa('header', 'padding-top')).toBe(true);
});

test('entrar al grupo en vista de PC y pasar a celular: atrás vuelve a las pestañas, no sale de la app', async ({ browser }) => {
  const p = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  await crearCuenta(p, 'Ana');
  await p.getByRole('button', { name: 'Crear mi grupo' }).click();
  await p.getByPlaceholder('Nombre del grupo nuevo').fill('Rota');
  await p.getByRole('button', { name: 'Crear grupo' }).click();
  await p.setViewportSize(CELULAR);
  await expect(p.getByRole('button', { name: 'Sala de chat General' })).toBeInViewport();
  await p.evaluate(() => ((window as unknown as { marca: number }).marca = 1)); // si atrás recarga la página, se pierde
  await p.goBack();
  await expect(p.getByRole('navigation', { name: 'Secciones' })).toBeVisible();
  expect(await p.evaluate(() => (window as unknown as { marca?: number }).marca)).toBe(1);
});

test('celular apaisado: también usa la vista de celular', async ({ browser }) => {
  const p = await (await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true })).newPage();
  await crearCuenta(p, 'Ana');
  await expect(p.getByRole('navigation', { name: 'Secciones' })).toBeVisible();
});

test('transmitir desde el navegador pide excluir el audio de la propia pestaña (sin eco de la llamada)', async ({ browser }) => {
  const { a } = await dosEnLaSala(browser, () => {
    navigator.mediaDevices.getDisplayMedia = async (c?: DisplayMediaStreamOptions) => {
      (window as unknown as { pedido: unknown }).pedido = c;
      const lienzo = Object.assign(document.createElement('canvas'), { width: 320, height: 180 });
      lienzo.getContext('2d')!.fillRect(0, 0, 320, 180);
      return lienzo.captureStream(15);
    };
  });
  await a.getByRole('button', { name: 'Transmitir', exact: true }).click();
  await a.getByRole('button', { name: 'Empezar' }).click();
  await expect.poll(() => a.evaluate(() => (window as unknown as { pedido?: { audio?: { restrictOwnAudio?: boolean } } }).pedido?.audio?.restrictOwnAudio)).toBe(true);
});

test('celular: ‹ en el chat y en la sala vuelve a la lista; en la lista, a las pestañas', async ({ browser }) => {
  const p = await (await browser.newContext({ viewport: CELULAR })).newPage();
  await crearCuenta(p, 'Ana');
  await p.getByRole('button', { name: 'Crear mi grupo' }).click();
  await p.getByPlaceholder('Nombre del grupo nuevo').fill('Salida');
  await p.getByRole('button', { name: 'Crear grupo' }).click();
  await p.getByRole('button', { name: 'Sala de chat General' }).click();
  await p.locator('h2.titulo').getByRole('button', { name: 'Volver', exact: true }).click();
  await p.getByRole('button', { name: 'Sala de voz General' }).click();
  await p.locator('section.voz header').getByRole('button', { name: 'Volver', exact: true }).click();
  await expect(p.getByRole('button', { name: 'Sala de chat General' })).toBeInViewport();
  await p.locator('.salas').getByRole('button', { name: 'Volver', exact: true }).click();
  await expect(p.getByRole('navigation', { name: 'Secciones' })).toBeVisible();
});

test('dejar de transmitir pide confirmación; la cabecera de la sala no repite el link de invitación', async ({ browser }) => {
  const { a, b } = await dosEnLaSala(browser, pantallaFalsa);
  await expect(a.locator('section.voz header').getByRole('button', { name: 'Copiar link de invitación' })).toHaveCount(0);
  await a.getByRole('button', { name: 'Transmitir', exact: true }).click();
  await a.getByRole('button', { name: 'Empezar' }).click();
  const tarjeta = b.locator('section.voz li', { hasText: 'Ana' });
  await expect(tarjeta.getByText('EN VIVO')).toBeVisible({ timeout: 15_000 });
  await a.getByRole('button', { name: 'Dejar de transmitir' }).click();
  await a.getByRole('button', { name: 'Cancelar' }).click();
  await a.waitForTimeout(800);
  await expect(tarjeta.getByText('EN VIVO')).toBeVisible();
  await a.getByRole('button', { name: 'Dejar de transmitir' }).click();
  await a.getByRole('dialog').getByRole('button', { name: 'Dejar de transmitir' }).click();
  await expect(tarjeta.getByText('EN VIVO')).toHaveCount(0, { timeout: 15_000 });
});

/** Ana y Beto transmiten (pantalla falsa) y Caro los mira a los dos. */
async function dosTransmitiendo(browser: import('@playwright/test').Browser, viewport = { width: 1280, height: 800 }) {
  const [a, b, c] = await Promise.all([0, 1, 2].map(async () => (await browser.newContext({ viewport })).newPage()));
  for (const p of [a, b]) await p.addInitScript(pantallaFalsa);
  await crearCuenta(a, 'Ana');
  const link = await crearGrupo(a, 'Dos pantallas');
  for (const [p, n] of [[b, 'Beto'], [c, 'Caro']] as const) {
    await crearCuenta(p, n);
    await p.getByRole('button', { name: 'Unirme con código' }).click();
    await p.getByPlaceholder('Código o link de invitación').fill(link);
    await p.getByRole('button', { name: 'Unirme', exact: true }).click();
  }
  for (const p of [a, b, c]) await p.getByRole('button', { name: 'Sala de voz General' }).click();
  await expect(c.locator('section.voz li')).toHaveCount(3, { timeout: 15_000 });
  for (const p of [a, b]) {
    await p.getByRole('button', { name: 'Transmitir', exact: true }).click();
    await p.getByRole('button', { name: 'Empezar' }).click();
  }
  return { a, b, c };
}

test('tarjeta de quien transmite: EN VIVO, foto, nombre y botón no se pisan', async ({ browser }) => {
  const { c } = await dosTransmitiendo(browser, { width: 1000, height: 700 }); // tarjetas chicas, como en una ventana angosta
  const t = c.locator('section.voz li', { hasText: 'Ana' });
  await expect(t.getByText('EN VIVO')).toBeVisible({ timeout: 15_000 });
  const cajas = await Promise.all([t.locator('.chips-vivo'), t.locator('img.avatar'), t.locator('.etiqueta-nombre'), t.getByRole('button', { name: 'Ver' })].map((l) => l.boundingBox()));
  const pisan = (x: { x: number; y: number; width: number; height: number }, y: typeof x) => x.x < y.x + y.width && y.x < x.x + x.width && x.y < y.y + y.height && y.y < x.y + x.height;
  for (let i = 0; i < cajas.length; i++) for (let j = i + 1; j < cajas.length; j++) expect(pisan(cajas[i]!, cajas[j]!), `${i} y ${j} se pisan`).toBe(false);
});

test('dos transmisiones se ven juntas sin scroll (mitad y mitad) y se pueden ocultar los participantes', async ({ browser }) => {
  const { c } = await dosTransmitiendo(browser);
  for (const n of ['Ana', 'Beto']) {
    const t = c.locator('section.voz li', { hasText: n });
    await t.getByRole('button', { name: 'Ver' }).click({ timeout: 15_000 });
  }
  const pantallas = c.locator('.escenarios .escenario');
  await expect(pantallas).toHaveCount(2, { timeout: 15_000 });
  await c.getByRole('button', { name: 'Ocultar participantes' }).click();
  await expect(c.locator('section.voz .franja')).toBeHidden();
  const [x, y] = await Promise.all([pantallas.nth(0).boundingBox(), pantallas.nth(1).boundingBox()]);
  const alto = c.viewportSize()!.height;
  expect(x!.y + x!.height).toBeLessThanOrEqual(alto);
  expect(y!.y + y!.height).toBeLessThanOrEqual(alto);
  expect(Math.abs(x!.width - y!.width)).toBeLessThan(4); // mitad y mitad
  expect(Math.abs(x!.y - y!.y)).toBeLessThan(4); // lado a lado
  await c.getByRole('button', { name: 'Mostrar participantes' }).click();
  await expect(c.locator('section.voz .franja')).toBeVisible();
});

test('PC: el dueño ordena salas y secciones arrastrando con el mouse (sin Subir/Bajar)', async ({ browser }) => {
  const p = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  await crearCuenta(p, 'Ana');
  await crearGrupo(p, 'Orden');
  await p.getByRole('button', { name: 'Orden', exact: true }).click();
  await p.getByRole('button', { name: 'Nueva sala de chat' }).click();
  await p.getByPlaceholder('Nombre de la sala').fill('memes');
  await p.getByRole('button', { name: 'Crear', exact: true }).click();
  const orden = () => p.locator('.salas li.sala button.nombre').evaluateAll((b) => b.map((x) => x.getAttribute('aria-label')));
  await expect.poll(orden).toContain('Sala de chat memes');
  // Sin botones de subir/bajar en el menú de la sala.
  await p.getByRole('button', { name: 'Sala de chat memes' }).click({ button: 'right' });
  await expect(p.getByRole('button', { name: 'Subir' })).toHaveCount(0);
  await p.keyboard.press('Escape');
  // Arrastrar memes encima de General.
  await p.getByRole('button', { name: 'Sala de chat memes' }).dragTo(p.getByRole('button', { name: 'Sala de chat General' }));
  await expect.poll(async () => { const o = await orden(); return o.indexOf('Sala de chat memes') < o.indexOf('Sala de chat General'); }).toBe(true);
  // Arrastrar la sección Chats encima de Salas de voz: los chats pasan arriba.
  await p.getByRole('heading', { name: 'Chats' }).dragTo(p.getByRole('heading', { name: 'Salas de voz' }));
  await expect.poll(async () => (await orden())[0]?.startsWith('Sala de chat')).toBe(true);
});

test('tocar una notificación de mención lleva a ese chat', async ({ browser }) => {
  const a = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  const b = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  await crearCuenta(a, 'Ana');
  const link = await crearGrupo(a, 'Avisame');
  const nombreAna = (await a.locator('button.yo > span:not(.caja)').first().textContent())!.trim();
  await crearCuenta(b, 'Beto');
  await b.getByRole('button', { name: 'Unirme con código' }).click();
  await b.getByPlaceholder('Código o link de invitación').fill(link);
  await b.getByRole('button', { name: 'Unirme', exact: true }).click();
  await b.getByRole('button', { name: 'Sala de chat general' }).click();
  await a.getByRole('button', { name: 'Inicio' }).first().click(); // Ana fuera del chat
  await b.getByPlaceholder('Escribí un mensaje').fill(`@${nombreAna} mirá esto`);
  await b.getByPlaceholder('Escribí un mensaje').press('Escape');
  await b.getByRole('button', { name: 'Enviar' }).click();
  await a.getByRole('button', { name: /^Notificaciones/ }).click();
  await a.locator('#campanita').getByRole('button', { name: /te mencionó/ }).click();
  await expect(a.getByTestId('mensaje').filter({ hasText: 'mirá esto' })).toBeVisible({ timeout: 10_000 });
  await expect(a.locator('h2.titulo', { hasText: '# General' })).toBeVisible();
});

test('celular: Google es solo el logo y la Configuración entra en la pantalla con solapas deslizables', async ({ browser }) => {
  const p = await (await browser.newContext({ viewport: CELULAR })).newPage();
  await p.goto('/');
  const google = p.getByRole('button', { name: 'Entrar con Google' });
  await expect(google).toBeVisible();
  expect((await google.textContent())!.trim()).toBe('');
  expect((await google.boundingBox())!.width).toBeLessThanOrEqual(56);
  await crearCuenta(p, 'Ana');
  await p.locator('.barra-movil').getByRole('button', { name: 'Configuración' }).click();
  const modal = p.locator('dialog.config');
  await expect(modal).toBeVisible();
  const caja = (await modal.boundingBox())!;
  expect(caja.x).toBeGreaterThanOrEqual(0);
  expect(caja.x + caja.width).toBeLessThanOrEqual(CELULAR.width);
  const solapas = modal.locator('.solapas');
  expect(await solapas.evaluate((e) => getComputedStyle(e).overflowX)).toBe('auto');
  expect(await solapas.evaluate((e) => getComputedStyle(e).scrollbarWidth)).toBe('none');
  const icono = modal.getByRole('tab', { name: 'Apariencia y rendimiento' }).locator('svg');
  expect((await icono.boundingBox())!.width).toBeGreaterThanOrEqual(15);
  expect(await sinScrollLateral(p)).toBe(true);
});

test('celular: los modales entran en la pantalla (confirmar borrar un mensaje)', async ({ browser }) => {
  const p = await (await browser.newContext({ viewport: { width: 360, height: 740 }, hasTouch: true })).newPage();
  await crearCuenta(p, 'Ana');
  await p.getByRole('button', { name: 'Crear mi grupo' }).click();
  await p.getByPlaceholder('Nombre del grupo nuevo').fill('Modales');
  await p.getByRole('button', { name: 'Crear grupo' }).click();
  await p.getByRole('button', { name: 'Sala de chat General' }).click();
  await p.getByPlaceholder('Escribí un mensaje').fill('borrame');
  await p.getByRole('button', { name: 'Enviar' }).click();
  await mantenerApretado(p.getByTestId('mensaje').filter({ hasText: 'borrame' }));
  await p.getByRole('menu').getByRole('button', { name: 'Borrar' }).click();
  const d = p.locator('dialog[open]').last();
  await expect(d).toBeVisible();
  const c = (await d.boundingBox())!;
  expect(c.x).toBeGreaterThanOrEqual(8);
  expect(c.x + c.width).toBeLessThanOrEqual(360 - 8);
  expect(await sinScrollLateral(p)).toBe(true);
});

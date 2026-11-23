import { test, expect, type Page } from '@playwright/test';
import { grupoDeTres } from './cuentas';

// Cámara, "Pantalla + cámara" y cómo se ve el estado de cada uno en la voz (muteado, ensordecido, cámara).

test.afterEach(async ({ browser }) => { for (const c of browser.contexts()) await c.close(); });

const unico = (n: string) => `${n}${Math.random().toString(36).slice(2, 6)}`;
const tarjeta = (p: Page, nombre: string) => p.locator('section.voz .franja li', { hasText: nombre });
const previa = (p: Page) => p.getByRole('dialog', { name: 'Vista previa de la cámara' });
/** Toca "Prender la cámara" y, en la vista previa, "Compartir cámara". */
const prender = async (p: Page) => {
  await p.getByRole('button', { name: 'Prender la cámara' }).click();
  await previa(p).getByRole('button', { name: 'Compartir cámara' }).click({ timeout: 15_000 });
};
type Fondo = { __voz: { fondo(): { modo: string; cuadros: number } | null } };
const fondo = (p: Page) => p.evaluate(() => (globalThis as unknown as Fondo).__voz.fondo());
const entrarVoz = async (ps: Page[]) => {
  for (const p of ps) await p.getByRole('button', { name: 'Sala de voz General' }).click();
  for (const p of ps) await expect(p.locator('section.voz .franja li')).toHaveCount(ps.length, { timeout: 15_000 });
};

test('ensordecido se ve en la tarjeta, la lista de salas y participantes, también desde afuera de la llamada', async ({ browser }) => {
  const [a, b, c] = await grupoDeTres(browser, unico('Sordos'));
  await entrarVoz([a, b]);
  await b.getByRole('button', { name: 'Ensordecerme' }).click();
  await expect(tarjeta(a, 'Beto').getByLabel('Ensordecido')).toBeVisible({ timeout: 10_000 });
  await expect(a.locator('ul.quienes li', { hasText: 'Beto' }).getByLabel('Ensordecido')).toBeVisible();
  // Caro no está en la llamada: lo ve por la presencia del servidor.
  await expect(c.locator('ul.quienes li', { hasText: 'Beto' }).getByLabel('Ensordecido')).toBeVisible({ timeout: 20_000 });
  await expect(c.locator('aside.participantes li', { hasText: 'Beto' }).getByLabel('Ensordecido')).toBeVisible();
});

test('ensordecerse corta el sonido de una (sin bajar de a poco) y lo devuelve igual', async ({ browser }) => {
  const [a, b] = await grupoDeTres(browser, unico('Corte'));
  await entrarVoz([a, b]);
  // Clic y lectura casi en el mismo instante: con la rampa de LiveKit, a los 30 ms seguía cerca del volumen de antes.
  const clicYGanancia = (boton: string | null) => b.evaluate(async (boton) => {
    if (boton) (document.querySelector(`[aria-label="${boton}"]`) as HTMLButtonElement).click();
    await new Promise((r) => setTimeout(r, 30));
    const g = (globalThis as unknown as { __voz: { ganancias(): Record<string, number | undefined> } }).__voz.ganancias();
    return Object.entries(g).find(([n]) => n.startsWith('Ana'))?.[1];
  }, boton);
  await expect.poll(() => clicYGanancia(null), { timeout: 15_000 }).toBeGreaterThan(0);
  await b.waitForTimeout(1000); // al entrar LiveKit también lo sube con rampa: que llegue a su valor
  const antes = await clicYGanancia(null);
  expect(await clicYGanancia('Ensordecerme')).toBe(0);
  expect(await clicYGanancia('Activar sonido')).toBe(antes);
});

test('al salir y volver a entrar ya no figura ensordecido', async ({ browser }) => {
  const [a, b] = await grupoDeTres(browser, unico('Vuelta'));
  await entrarVoz([a, b]);
  await b.getByRole('button', { name: 'Ensordecerme' }).click();
  await expect(tarjeta(a, 'Beto').getByLabel('Ensordecido')).toBeVisible({ timeout: 10_000 });
  await b.getByRole('button', { name: 'Desconectarse' }).first().click();
  await expect(a.locator('section.voz .franja li')).toHaveCount(1, { timeout: 15_000 });
  await b.getByRole('button', { name: 'Sala de voz General' }).click();
  await expect(a.locator('section.voz .franja li')).toHaveCount(2, { timeout: 15_000 });
  await expect(tarjeta(a, 'Beto').getByLabel('Ensordecido')).toHaveCount(0);
});

type Stats = { __voz: { stats(): Promise<{ camaras: Record<string, { frames: number }> }> } };
const framesDe = (p: Page, nombre: string) => p.evaluate(() => (globalThis as unknown as Stats).__voz.stats())
  .then((s) => Object.entries(s.camaras ?? {}).find(([n]) => n.startsWith(nombre))?.[1].frames ?? 0);

test('Ana prende la cámara y Beto ve su video en la tarjeta; al apagarla vuelve la foto', async ({ browser }) => {
  const [a, b] = await grupoDeTres(browser, unico('Camaras'));
  await entrarVoz([a, b]);
  await prender(a);
  await expect(tarjeta(b, 'Ana').locator('video')).toBeVisible({ timeout: 15_000 });
  await expect.poll(() => framesDe(b, 'Ana'), { timeout: 15_000 }).toBeGreaterThan(0);
  await expect(tarjeta(a, 'Ana').locator('video')).toBeVisible(); // la propia también
  await expect(b.locator('ul.quienes li', { hasText: 'Ana' }).getByLabel('Con la cámara prendida')).toBeVisible();
  await a.getByRole('button', { name: 'Apagar la cámara' }).click();
  await expect(tarjeta(b, 'Ana').locator('video')).toHaveCount(0, { timeout: 15_000 });
});

test('sin cámara: aviso claro, el botón queda apagado y la llamada sigue', async ({ browser }) => {
  const [a, b] = await grupoDeTres(browser, unico('SinCam'), async (p) => {
    await p.addInitScript(() => {
      const orig = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia = (c) => (c?.video ? Promise.reject(new DOMException('nada', 'NotFoundError')) : orig(c));
    });
  });
  await entrarVoz([a, b]);
  await a.getByRole('button', { name: 'Prender la cámara' }).click();
  await expect(a.getByRole('alert').filter({ hasText: 'No se encontró una cámara.' })).toBeVisible({ timeout: 10_000 });
  await expect(a.getByRole('button', { name: 'Prender la cámara' })).toBeVisible();
  await expect(b.locator('section.voz .franja li')).toHaveCount(2);
});

// Pantalla compartida falsa (un canvas animado) en lugar del selector del navegador.
const pantallaFalsa = async (p: Page) => p.addInitScript(() => {
  navigator.mediaDevices.getDisplayMedia = async () => {
    const c = Object.assign(document.createElement('canvas'), { width: 640, height: 360 });
    const g = c.getContext('2d')!;
    let n = 0;
    setInterval(() => { g.fillStyle = `hsl(${(n += 7) % 360} 60% 50%)`; g.fillRect(0, 0, 640, 360); }, 50);
    return c.captureStream(30);
  };
});

/** Ana transmite "Pantalla + cámara" (con la cámara prendida antes si `camaraAntes`) y Beto la mira. */
async function streamer(browser: import('@playwright/test').Browser, camaraAntes = false) {
  const [a, b] = await grupoDeTres(browser, unico('Stream'), pantallaFalsa);
  await entrarVoz([a, b]);
  if (camaraAntes) await prender(a);
  await a.getByRole('button', { name: 'Transmitir', exact: true }).click();
  await a.locator('label.modo', { hasText: 'Pantalla + cámara' }).click();
  await a.getByRole('button', { name: 'Empezar' }).click();
  await tarjeta(b, 'Ana').getByRole('button', { name: 'Ver' }).click({ timeout: 15_000 });
  return { a, b };
}
const encima = (p: Page) => p.locator('.escenario .cam-encima');

test('Pantalla + cámara: Beto ve la cámara de Ana abajo a la derecha, y la puede esconder solo para él', async ({ browser }) => {
  const { a, b } = await streamer(browser);
  await expect(encima(b).locator('video')).toBeVisible({ timeout: 15_000 });
  expect(await encima(b).evaluate((e) => [e.style.left, e.style.top, e.style.width])).toEqual(['73%', '71%', '25%']);
  await encima(b).getByRole('button', { name: 'Esconder la cámara' }).click();
  await expect(encima(b)).toHaveCount(0);
  await expect(a.locator('.propia .cam-mover')).toBeVisible();
});

test('la cámara sobre la pantalla no se re-engancha con cada cambio de la sala (titilaba)', async ({ browser }) => {
  const { a, b } = await streamer(browser);
  const video = encima(b).locator('video');
  await expect(video).toBeVisible({ timeout: 15_000 });
  await video.evaluate((v) => { (v as HTMLVideoElement & { cortes?: number }).cortes = 0; v.addEventListener('emptied', () => (v as HTMLVideoElement & { cortes: number }).cortes++); });
  // Muteos de Ana: cada uno actualiza la lista de la sala.
  for (let i = 0; i < 4; i++) await a.getByRole('button', { name: /^(Silenciarme|Activar micrófono)$/ }).first().click();
  await expect(tarjeta(b, 'Ana').getByLabel('Silenciado')).toHaveCount(0, { timeout: 10_000 });
  expect(await video.evaluate((v) => (v as HTMLVideoElement & { cortes: number }).cortes)).toBe(0);
});

test('Ana acomoda la ventanita en su vista previa y a Beto se le mueve', async ({ browser }) => {
  const { a, b } = await streamer(browser);
  await expect(encima(b).locator('video')).toBeVisible({ timeout: 15_000 });
  const caja = (await a.locator('.propia .cam-mover').boundingBox())!;
  await a.mouse.move(caja.x + caja.width / 2, caja.y + caja.height / 2);
  await a.mouse.down();
  await a.mouse.move(caja.x - 200, caja.y - 150, { steps: 8 });
  await a.mouse.up();
  await expect.poll(async () => parseFloat(await encima(b).evaluate((e) => e.style.left)), { timeout: 10_000 }).toBeLessThan(73);
});

test('cortar la transmisión apaga la cámara si la prendió la transmisión', async ({ browser }) => {
  const { a } = await streamer(browser);
  await expect(a.getByRole('button', { name: 'Apagar la cámara' })).toBeVisible({ timeout: 15_000 });
  await a.getByRole('button', { name: 'Dejar de transmitir' }).click();
  await a.getByRole('button', { name: 'Dejar de transmitir' }).last().click();
  await expect(a.getByRole('button', { name: 'Prender la cámara' })).toBeVisible({ timeout: 10_000 });
});

test('si la cámara ya estaba prendida, cortar la transmisión la deja prendida', async ({ browser }) => {
  const { a } = await streamer(browser, true);
  await a.getByRole('button', { name: 'Dejar de transmitir' }).click();
  await a.getByRole('button', { name: 'Dejar de transmitir' }).last().click();
  await expect(a.getByRole('button', { name: 'Transmitir', exact: true })).toBeVisible({ timeout: 10_000 });
  await expect(a.getByRole('button', { name: 'Apagar la cámara' })).toBeVisible();
});

test('cortar la transmisión mientras la cámara todavía arranca no la deja prendida', async ({ browser }) => {
  const [a, b] = await grupoDeTres(browser, unico('Lenta'), async (p) => {
    await pantallaFalsa(p);
    await p.addInitScript(() => { // la cámara tarda 2,5 s en arrancar (como cuando el navegador pide permiso)
      const orig = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia = (c) => (c?.video ? new Promise((ok) => setTimeout(ok, 2500)).then(() => orig(c)) : orig(c));
    });
  });
  await entrarVoz([a, b]);
  await a.getByRole('button', { name: 'Transmitir', exact: true }).click();
  await a.locator('label.modo', { hasText: 'Pantalla + cámara' }).click();
  await a.getByRole('button', { name: 'Empezar' }).click();
  await a.getByRole('button', { name: 'Dejar de transmitir' }).click();
  await a.getByRole('button', { name: 'Dejar de transmitir' }).last().click();
  await a.waitForTimeout(4000);
  await expect(a.getByRole('button', { name: 'Prender la cámara' })).toBeVisible();
  await expect(tarjeta(b, 'Ana').locator('video')).toHaveCount(0);
});

test('cámara ocupada por otro programa: lo dice claro', async ({ browser }) => {
  const [a, b] = await grupoDeTres(browser, unico('Ocupada'), async (p) => {
    await p.addInitScript(() => {
      const orig = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia = (c) => (c?.video ? Promise.reject(new DOMException('ocupada', 'NotReadableError')) : orig(c));
    });
  });
  await entrarVoz([a, b]);
  await a.getByRole('button', { name: 'Prender la cámara' }).click();
  await expect(a.getByRole('alert').filter({ hasText: 'La cámara la está usando otro programa.' })).toBeVisible({ timeout: 10_000 });
});

test('la ventanita también se acomoda con el teclado', async ({ browser }) => {
  const { a, b } = await streamer(browser);
  await expect(encima(b).locator('video')).toBeVisible({ timeout: 15_000 });
  await a.locator('.propia .cam-mover').focus();
  for (let i = 0; i < 5; i++) await a.keyboard.press('ArrowLeft');
  await a.keyboard.press('+');
  await expect.poll(async () => parseFloat(await encima(b).evaluate((e) => e.style.left)), { timeout: 10_000 }).toBeLessThan(70);
  await expect.poll(async () => parseFloat(await encima(b).evaluate((e) => e.style.width)), { timeout: 10_000 }).toBeGreaterThan(25);
});

test('si apagás y prendés la cámara a mano durante la transmisión, al cortar queda prendida', async ({ browser }) => {
  const { a } = await streamer(browser);
  await expect(a.getByRole('button', { name: 'Apagar la cámara' })).toBeVisible({ timeout: 15_000 });
  await a.getByRole('button', { name: 'Apagar la cámara' }).click();
  await prender(a);
  await expect(a.getByRole('button', { name: 'Apagar la cámara' })).toBeVisible({ timeout: 10_000 });
  await a.getByRole('button', { name: 'Dejar de transmitir' }).click();
  await a.getByRole('button', { name: 'Dejar de transmitir' }).last().click();
  await expect(a.getByRole('button', { name: 'Transmitir', exact: true })).toBeVisible({ timeout: 10_000 });
  await a.waitForTimeout(1000);
  await expect(a.getByRole('button', { name: 'Apagar la cámara' })).toBeVisible();
});

test('Beto elige ver la cámara de Ana en calidad baja y la cámara agrandada tapa toda la ventana', async ({ browser }) => {
  const [a, b] = await grupoDeTres(browser, unico('CalCam'));
  await entrarVoz([a, b]);
  await prender(a);
  await expect(tarjeta(b, 'Ana').locator('video')).toBeVisible({ timeout: 15_000 });
  await tarjeta(b, 'Ana').click({ button: 'right' });
  const sel = b.getByLabel(/Calidad de la cámara de Ana/);
  await sel.selectOption('baja');
  expect(Object.values(await b.evaluate(() => JSON.parse(localStorage.getItem('dm.voz')!).calidadCam))).toEqual(['baja']);
  await b.keyboard.press('Escape');
  await tarjeta(b, 'Ana').getByRole('button', { name: /Agrandar la cámara/ }).click();
  await expect(tarjeta(b, 'Ana').locator('.cam.completa')).toBeVisible();
  const caja = await tarjeta(b, 'Ana').locator('.cam').boundingBox();
  expect(caja?.width).toBe(b.viewportSize()!.width);
  // Con el mouse encima el fondo sigue negro (el hover de los botones planos dejaba ver la app detrás).
  await tarjeta(b, 'Ana').locator('.cam').hover();
  await expect(tarjeta(b, 'Ana').locator('.cam')).toHaveCSS('background-color', 'rgb(0, 0, 0)');
  await a.getByRole('button', { name: 'Apagar la cámara' }).click();
  await expect.poll(() => b.evaluate(() => document.fullscreenElement)).toBeNull();
});

test('Ana, desde el celular, gira la cámara y Beto la ve de costado', async ({ browser }) => {
  const [a, b] = await grupoDeTres(browser, unico('Giro'));
  await entrarVoz([a, b]);
  await a.setViewportSize({ width: 390, height: 844 });
  await prender(a);
  const video = tarjeta(b, 'Ana').locator('video');
  await expect(video).toBeVisible({ timeout: 15_000 });
  await a.getByRole('button', { name: 'Más opciones' }).click();
  await a.getByRole('button', { name: 'Girar la cámara' }).click();
  await expect(tarjeta(b, 'Ana').locator('.cam')).toHaveAttribute('data-giro', '90', { timeout: 10_000 });
  // Girado 90°: ocupa la tarjeta entera (menos el borde del botón, 1 px por lado).
  const cam = (await tarjeta(b, 'Ana').locator('.cam').boundingBox())!, v = (await video.boundingBox())!;
  expect(Math.abs(v.width - cam.width)).toBeLessThanOrEqual(2);
  expect(Math.abs(v.height - cam.height)).toBeLessThanOrEqual(2);
  expect(await video.evaluate((e) => getComputedStyle(e).rotate)).toBe('90deg');
});

test('la vista previa no se comparte hasta tocar Compartir; Cancelar y Esc la apagan', async ({ browser }) => {
  const [a, b] = await grupoDeTres(browser, unico('Previa'));
  await entrarVoz([a, b]);
  for (const cerrar of ['Cancelar', 'Escape']) {
    await a.getByRole('button', { name: 'Prender la cámara' }).click();
    await expect(previa(a).locator('video')).toBeVisible({ timeout: 15_000 });
    await expect(previa(a).getByText('Solo vos ves esto')).toBeVisible();
    await b.waitForTimeout(3000);
    await expect(tarjeta(b, 'Ana').locator('video')).toHaveCount(0);
    if (cerrar === 'Escape') await a.keyboard.press('Escape');
    else await previa(a).getByRole('button', { name: 'Cancelar' }).click();
    await expect(previa(a)).toBeHidden();
    expect(await fondo(a)).toBeNull();
    await expect(a.getByRole('button', { name: 'Prender la cámara' })).toBeEnabled();
  }
});

test('doble clic abre una sola vista previa', async ({ browser }) => {
  const [a, b] = await grupoDeTres(browser, unico('Doble'));
  await entrarVoz([a, b]);
  await a.getByRole('button', { name: 'Prender la cámara' }).dblclick();
  await expect(previa(a).locator('video')).toBeVisible({ timeout: 15_000 });
  await expect(a.locator('dialog[open]')).toHaveCount(1);
  await previa(a).getByRole('button', { name: 'Compartir cámara' }).click();
  await expect(tarjeta(b, 'Ana').locator('video')).toHaveCount(1, { timeout: 15_000 });
  expect(await a.evaluate(() => (globalThis as unknown as { __voz: { pistasCamara(): number } }).__voz.pistasCamara())).toBe(1);
});

test('el fondo Fuerte procesa cuadros, se guarda y se puede cambiar en vivo', async ({ browser }) => {
  const [a, b] = await grupoDeTres(browser, unico('Fondo'));
  await entrarVoz([a, b]);
  await a.getByRole('button', { name: 'Prender la cámara' }).click();
  await previa(a).getByRole('button', { name: 'Fuerte' }).click();
  await expect.poll(async () => (await fondo(a))?.cuadros ?? 0, { timeout: 20_000 }).toBeGreaterThan(0);
  expect((await fondo(a))?.modo).toBe('fuerte');
  await expect(previa(a).getByText('Preparando el fondo…')).toBeHidden();
  await previa(a).getByRole('button', { name: 'Compartir cámara' }).click();
  await expect.poll(() => framesDe(b, 'Ana'), { timeout: 15_000 }).toBeGreaterThan(0);
  // En vivo, desde la flecha del botón de la cámara.
  await a.getByRole('button', { name: 'Fondo de la cámara' }).click();
  await a.getByRole('button', { name: 'Suave' }).click();
  expect((await fondo(a))?.modo).toBe('suave');
  await a.getByRole('button', { name: 'Apagar la cámara' }).click();
  await a.getByRole('button', { name: 'Prender la cámara' }).click();
  await expect(previa(a).getByRole('button', { name: 'Suave' })).toHaveAttribute('aria-pressed', 'true');
});

test('salir de la llamada con la vista previa abierta apaga la cámara', async ({ browser }) => {
  const [a, b] = await grupoDeTres(browser, unico('SalePrevia'));
  await entrarVoz([a, b]);
  await a.getByRole('button', { name: 'Prender la cámara' }).click();
  await expect(previa(a).locator('video')).toBeVisible({ timeout: 15_000 });
  await a.evaluate(() => (globalThis as unknown as { __voz: { caer(): void } }).__voz.caer());
  await expect(previa(a)).toBeHidden({ timeout: 10_000 });
  expect(await fondo(a)).toBeNull();
});

test('prender y apagar tres veces seguidas sigue andando', async ({ browser }) => {
  const [a, b] = await grupoDeTres(browser, unico('Vueltas'));
  await entrarVoz([a, b]);
  for (let i = 0; i < 3; i++) {
    await prender(a);
    await expect(tarjeta(b, 'Ana').locator('video')).toBeVisible({ timeout: 15_000 });
    await a.getByRole('button', { name: 'Apagar la cámara' }).click();
    await expect(tarjeta(b, 'Ana').locator('video')).toHaveCount(0, { timeout: 15_000 });
  }
  expect(await a.evaluate(() => (globalThis as unknown as { __voz: { pistasCamara(): number } }).__voz.pistasCamara())).toBe(0);
});

test('tocar la cámara mientras se comparte no publica una segunda', async ({ browser }) => {
  const [a, b] = await grupoDeTres(browser, unico('DosPub'));
  await entrarVoz([a, b]);
  await a.getByRole('button', { name: 'Prender la cámara' }).click();
  await expect(previa(a).getByRole('button', { name: 'Compartir cámara' })).toBeEnabled({ timeout: 15_000 });
  // Los dos clics en el mismo instante: el segundo cae mientras la publicación todavía está en camino.
  await a.evaluate(() => {
    (document.querySelector('dialog[open] button.primario') as HTMLButtonElement).click();
    // Un instante después (ya se dibujó el botón habilitado), mientras la publicación sigue en camino.
    return new Promise<void>((ok) => setTimeout(() => { (document.querySelector('[aria-label="Prender la cámara"]') as HTMLButtonElement).click(); ok(); }, 15));
  });
  await expect(tarjeta(b, 'Ana').locator('video')).toHaveCount(1, { timeout: 15_000 });
  await a.waitForTimeout(2000);
  await expect(a.locator('dialog[open]')).toHaveCount(0);
  expect(await a.evaluate(() => (globalThis as unknown as { __voz: { pistasCamara(): number } }).__voz.pistasCamara())).toBe(1);
});

test('si no carga el efecto de fondo, la cámara no queda prendida', async ({ browser }) => {
  const [a, b] = await grupoDeTres(browser, unico('SinEfecto'), async (p) => {
    await p.route('**/src/lib/fondo.ts*', (r) => r.abort());
    await p.addInitScript(() => { // anota las pistas de video que se abren, para ver si se apagan
      const orig = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      const w = window as unknown as { pistas: MediaStreamTrack[] };
      w.pistas = [];
      navigator.mediaDevices.getUserMedia = async (c) => { const s = await orig(c); w.pistas.push(...s.getVideoTracks()); return s; };
    });
  });
  await entrarVoz([a, b]);
  await a.getByRole('button', { name: 'Prender la cámara' }).click();
  await a.waitForTimeout(3000);
  await a.keyboard.press('Escape');
  await expect.poll(() => a.evaluate(() => (window as unknown as { pistas: MediaStreamTrack[] }).pistas.filter((t) => t.readyState === 'live').length), { timeout: 10_000 }).toBe(0);
});

test('cambiar el fondo mientras carga el difuminado aplica el último elegido', async ({ browser }) => {
  const [a, b] = await grupoDeTres(browser, unico('FondoTemprano'), async (p) => {
    await p.addInitScript(() => localStorage.setItem('dm.voz', JSON.stringify({ v: 3, fondoCam: 'fuerte' })));
    // El modelo tarda en bajar (como la primera vez con una conexión lenta).
    await p.route('**/fondo/selfie_segmenter.tflite', async (r) => { await new Promise((ok) => setTimeout(ok, 3000)); await r.continue(); });
  });
  await entrarVoz([a, b]);
  await a.getByRole('button', { name: 'Prender la cámara' }).click();
  await previa(a).getByRole('button', { name: 'Sin efecto' }).click();
  await expect(previa(a).locator('video')).toBeVisible({ timeout: 15_000 });
  await expect.poll(async () => (await fondo(a))?.modo, { timeout: 10_000 }).toBe('no');
});

test('con la cámara lista, Enter comparte', async ({ browser }) => {
  const [a, b] = await grupoDeTres(browser, unico('Enter'));
  await entrarVoz([a, b]);
  await a.getByRole('button', { name: 'Prender la cámara' }).click();
  await expect(previa(a).getByRole('button', { name: 'Compartir cámara' })).toBeEnabled({ timeout: 15_000 });
  await a.keyboard.press('Enter');
  await expect(tarjeta(b, 'Ana').locator('video')).toBeVisible({ timeout: 15_000 });
});

test('celular: en la vista previa y en vivo se pasa a la cámara trasera, sin espejo y sin perder el fondo', async ({ browser }) => {
  const [a, b] = await grupoDeTres(browser, unico('Trasera'));
  // Solo Ana es un iPhone (esCelular sale del navegador al cargar la app).
  await a.addInitScript(() => Object.defineProperty(navigator, 'userAgent', { get: () => 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148' }));
  await a.reload();
  await a.getByRole('button', { name: 'Abrir el grupo' }).click(); // al recargar vuelve al Inicio
  await entrarVoz([a, b]);
  await a.setViewportSize({ width: 390, height: 844 });
  type Cam = { __voz: { camara(): { trasera: boolean; facingMode: unknown } | null } };
  const cam = () => a.evaluate(() => (globalThis as unknown as Cam).__voz.camara());
  await a.getByRole('button', { name: 'Prender la cámara' }).click();
  await previa(a).getByRole('button', { name: 'Fuerte' }).click();
  await expect.poll(async () => (await fondo(a))?.cuadros ?? 0, { timeout: 20_000 }).toBeGreaterThan(0);
  await expect(previa(a).locator('video')).toHaveCSS('transform', 'matrix(-1, 0, 0, 1, 0, 0)');
  await previa(a).getByRole('button', { name: 'Usar la cámara trasera' }).click();
  await expect.poll(async () => (await cam())?.facingMode, { timeout: 10_000 }).toBe('environment');
  await expect(previa(a).locator('video')).toHaveCSS('transform', 'none');
  const antes = (await fondo(a))!.cuadros;
  await expect.poll(async () => (await fondo(a))?.cuadros ?? 0, { timeout: 10_000 }).toBeGreaterThan(antes);
  expect((await fondo(a))?.modo).toBe('fuerte');
  await previa(a).getByRole('button', { name: 'Compartir cámara' }).click();
  await expect(tarjeta(b, 'Ana').locator('video')).toBeVisible({ timeout: 15_000 });
  await a.getByRole('button', { name: 'Más opciones' }).click();
  await a.getByRole('button', { name: 'Usar la cámara frontal' }).click();
  await expect.poll(async () => (await cam())?.facingMode, { timeout: 10_000 }).toBe('user');
  await expect.poll(() => framesDe(b, 'Ana'), { timeout: 15_000 }).toBeGreaterThan(0);
});

test('en la PC no aparece el botón de cámara trasera', async ({ browser }) => {
  const [a, b] = await grupoDeTres(browser, unico('SinTrasera'));
  await entrarVoz([a, b]);
  await a.getByRole('button', { name: 'Prender la cámara' }).click();
  await expect(previa(a).getByRole('button', { name: 'Compartir cámara' })).toBeEnabled({ timeout: 15_000 });
  await expect(previa(a).getByRole('button', { name: /cámara trasera/ })).toHaveCount(0);
});

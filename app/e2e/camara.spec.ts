import { test, expect, type Page } from '@playwright/test';
import { grupoDeTres } from './cuentas';

// Cámara, "Pantalla + cámara" y cómo se ve el estado de cada uno en la voz (muteado, ensordecido, cámara).

test.afterEach(async ({ browser }) => { for (const c of browser.contexts()) await c.close(); });

const unico = (n: string) => `${n}${Math.random().toString(36).slice(2, 6)}`;
const tarjeta = (p: Page, nombre: string) => p.locator('section.voz .franja li', { hasText: nombre });
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
  await a.getByRole('button', { name: 'Prender la cámara' }).click();
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
  if (camaraAntes) await a.getByRole('button', { name: 'Prender la cámara' }).click();
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

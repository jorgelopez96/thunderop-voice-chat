import { test, expect, type Page } from '@playwright/test';
import { crearCuenta, crearGrupo, de, unirse } from './cuentas';

type Stats = { pantallas: Record<string, { frames: number }>; transmitiendo: boolean };
const stats = (p: Page) => p.evaluate(() => (window as unknown as { __voz: { stats(): Promise<Stats> } }).__voz.stats());
const framesDe = async (p: Page, nombre: string) => de((await stats(p)).pantallas, nombre)?.frames ?? 0;
const tarjeta = (p: Page, nombre: string) => p.locator('section.voz li', { hasText: nombre });
const entrar = (p: Page) => p.getByRole('button', { name: 'Sala de voz General' }).click();
// Lo que hace Windows al cortar la captura (cerrar la ventana compartida, Win+L...): la pista termina sola.
const terminarCaptura = (p: Page) => p.evaluate(() => (window as unknown as { __voz: { terminarCaptura(): void } }).__voz.terminarCaptura());
const mismoVideo = (p: Page) => p.getByLabel('Pantalla de Ana').evaluate((v: HTMLVideoElement) => {
  const w = window as unknown as { __src?: MediaProvider | null };
  const igual = w.__src === v.srcObject; w.__src = v.srcObject; return igual;
});

test('transmitir y ver una pantalla', async ({ browser }) => {
  const [a, b, c] = await Promise.all([0, 1, 2].map(async () => (await browser.newContext()).newPage()));

  await crearCuenta(a, 'Ana');
  const link = await crearGrupo(a, 'Pantallas');
  await crearCuenta(b, 'Beto');
  await unirse(b, link);
  await crearCuenta(c, 'Caro');
  await unirse(c, link);

  await entrar(a);
  await entrar(b);
  await expect(b.locator('section.voz li')).toHaveCount(2, { timeout: 10_000 });

  // Ana transmite en 720p: su tarjeta muestra "En vivo" y no hay avisos (fuera de Tauri no hay aviso de sonido).
  await a.getByRole('button', { name: 'Transmitir' }).click();
  await a.getByLabel('Calidad').selectOption({ label: '720p · 30 fps' });
  await a.getByRole('button', { name: 'Empezar' }).click();
  await expect(tarjeta(a, 'Ana').getByText('EN VIVO')).toBeVisible({ timeout: 10_000 });
  await expect(a.getByRole('button', { name: 'Dejar de transmitir' })).toBeVisible();
  await expect(a.getByRole('alert')).toHaveCount(0);

  // Vista previa propia: se ve con imagen y se puede ocultar y volver a mostrar.
  const previa = a.getByLabel('Vista previa de tu transmisión');
  await expect.poll(() => previa.evaluate((v: HTMLVideoElement) => v.videoWidth), { timeout: 5000 }).toBeGreaterThan(0);
  await a.getByRole('button', { name: 'Ocultar vista previa' }).click();
  await expect(previa).toHaveCount(0);
  await expect(a.getByRole('button', { name: 'Mostrar vista previa' })).toBeVisible();
  await a.getByRole('button', { name: 'Mostrar vista previa' }).click();
  await expect.poll(() => previa.evaluate((v: HTMLVideoElement) => v.videoWidth), { timeout: 5000 }).toBeGreaterThan(0);

  // Beto la ve y los frames crecen.
  await tarjeta(b, 'Ana').getByRole('button', { name: 'Ver' }).click();
  await expect(b.getByLabel('Pantalla de Ana')).toBeVisible();
  await expect.poll(() => framesDe(b, 'Ana'), { timeout: 10_000 }).toBeGreaterThan(0);
  const antes = await framesDe(b, 'Ana');
  await b.waitForTimeout(3000);
  expect(await framesDe(b, 'Ana')).toBeGreaterThan(antes);

  // Los cambios de la lista (silencios, quién habla) no re-enganchan el video.
  await mismoVideo(b);
  await a.getByRole('button', { name: 'Silenciarme' }).click();
  await expect(tarjeta(b, 'Ana').getByLabel('Silenciado')).toBeVisible({ timeout: 10_000 });
  await a.getByRole('button', { name: 'Activar micrófono' }).click();
  await expect(tarjeta(b, 'Ana').getByLabel('Silenciado')).toHaveCount(0, { timeout: 10_000 });
  expect(await mismoVideo(b)).toBe(true);

  // Ver → Dejar de ver → Ver rápido: la desuscripción vieja no se lleva el <video> nuevo.
  // La pista vieja termina ~100-250 ms después de dejar de ver: se vuelve a ver antes, con varias pausas.
  for (const ms of [0, 60]) {
    await b.evaluate(async (ms) => {
      const boton = (nombre: string) => [...document.querySelectorAll('section.voz li button')].find((x) => x.textContent === nombre) as HTMLButtonElement;
      boton('Dejar de ver').click();
      await new Promise((r) => setTimeout(r, ms));
      boton('Ver').click();
    }, ms);
    await b.waitForTimeout(1500);
    await expect(b.getByLabel('Pantalla de Ana'), `pausa ${ms} ms`).toBeVisible();
    await expect.poll(() => b.getByLabel('Pantalla de Ana').evaluate((v: HTMLVideoElement) => v.videoWidth), { timeout: 10_000 }).toBeGreaterThan(0);
  }

  // Caro entra después: ve "Ver" y no se suscribe sola.
  await entrar(c);
  await expect(tarjeta(c, 'Ana').getByRole('button', { name: 'Ver' })).toBeVisible({ timeout: 10_000 });
  await c.waitForTimeout(2000);
  expect(await framesDe(c, 'Ana')).toBe(0);

  // Ana corta: Beto pierde el video y el botón en menos de 5 s.
  await a.getByRole('button', { name: 'Dejar de transmitir' }).click();
  await expect(b.getByLabel('Pantalla de Ana')).toHaveCount(0, { timeout: 5000 });
  await expect(tarjeta(b, 'Ana').getByRole('button', { name: /^(Ver|Dejar de ver)$/ })).toHaveCount(0, { timeout: 5000 });

  // Ana transmite otra vez, Beto mira y Windows corta la captura: se despublica sola, sin avisos.
  await a.getByRole('button', { name: 'Transmitir' }).click();
  await a.getByRole('button', { name: 'Empezar' }).click();
  await tarjeta(b, 'Ana').getByRole('button', { name: 'Ver' }).click({ timeout: 10_000 });
  await expect.poll(() => framesDe(b, 'Ana'), { timeout: 10_000 }).toBeGreaterThan(0);
  await terminarCaptura(a);
  await expect.poll(async () => (await stats(a)).transmitiendo, { timeout: 10_000 }).toBe(false);
  await expect(a.getByRole('button', { name: 'Transmitir' })).toBeVisible();
  await expect(a.getByRole('alert')).toHaveCount(0);
  await expect(b.getByText('EN VIVO')).toHaveCount(0, { timeout: 10_000 });
  await expect(b.getByLabel('Pantalla de Ana')).toHaveCount(0);

  // Ana transmite otra vez y se desconecta: el "En vivo" desaparece en Beto en menos de 10 s.
  await a.getByRole('button', { name: 'Transmitir' }).click();
  await a.getByRole('button', { name: 'Empezar' }).click();
  await expect(tarjeta(b, 'Ana').getByText('EN VIVO')).toBeVisible({ timeout: 10_000 });
  await a.getByRole('button', { name: 'Salir', exact: true }).click();
  await expect(b.getByText('EN VIVO')).toHaveCount(0, { timeout: 10_000 });
  // El <audio> del micrófono de Ana se va con ella; queda solo el de Caro.
  await expect(b.locator('audio[data-voz]')).toHaveCount(1, { timeout: 10_000 });
});

import { expect, type Browser, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';

/** El nombre es único en el servidor: se le suma un sufijo al azar ("Ana3f2a"; un contador se reinicia si Playwright cambia de worker); los specs buscan "Ana" por subcadena. */
/** Lo de `nombre` en un registro por nombre de usuario (que lleva el sufijo de `crearCuenta`). */
export const de = <T>(r: Record<string, T>, nombre: string) => Object.entries(r).find(([k]) => k.startsWith(nombre))?.[1];

export async function crearCuenta(page: Page, nombre: string) {
  await page.goto('/');
  await page.getByRole('tab', { name: 'Crear cuenta' }).click();
  await page.getByLabel('Nombre').fill(`${nombre}${randomUUID().slice(0, 4)}`);
  await page.getByLabel('Email').fill(`${nombre}-${randomUUID()}@test.local`);
  await page.getByLabel('Contraseña').fill('clave-segura-123');
  await page.getByRole('button', { name: 'Crear cuenta', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Mis grupos' })).toBeVisible();
}

/** Crea el grupo desde la portada y deja el link de invitación a la vista; lo devuelve. */
export async function crearGrupo(page: Page, nombre: string) {
  await page.getByRole('button', { name: 'Crear mi grupo' }).click(); // cuentas nuevas: estado vacío
  await page.getByPlaceholder('Nombre del grupo nuevo').fill(nombre);
  await page.getByRole('button', { name: 'Crear grupo' }).click();
  await page.getByRole('button', { name: nombre, exact: true }).click(); // menú del nombre del grupo
  await page.getByRole('button', { name: 'Invitar al grupo' }).click();
  return (await page.getByTestId('link-invitacion').textContent())!.trim();
}

export async function unirse(page: Page, link: string) {
  await page.getByRole('button', { name: 'Unirme con código' }).click(); // cuentas nuevas: estado vacío
  await page.getByPlaceholder('Código o link de invitación').fill(link);
  await page.getByRole('button', { name: 'Unirme', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Salas de voz' })).toBeVisible();
}

/** Ana crea el grupo `nombre`; Beto y Caro se unen. Cada uno en su contexto; `antes` corre en cada página antes de navegar. */
export async function grupoDeTres(browser: Browser, nombre: string, antes?: (p: Page) => Promise<void>) {
  const [a, b, c] = await Promise.all([0, 1, 2].map(async () => {
    const p = await (await browser.newContext()).newPage();
    await antes?.(p);
    return p;
  }));
  await crearCuenta(a, 'Ana');
  const link = await crearGrupo(a, nombre);
  await crearCuenta(b, 'Beto');
  await unirse(b, link);
  await crearCuenta(c, 'Caro');
  await unirse(c, link);
  return [a, b, c] as const;
}

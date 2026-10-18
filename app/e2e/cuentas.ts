import { expect, type Browser, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';

export async function crearCuenta(page: Page, nombre: string) {
  await page.goto('/');
  await page.getByRole('tab', { name: 'Crear cuenta' }).click();
  await page.getByLabel('Nombre').fill(nombre);
  await page.getByLabel('Email').fill(`${nombre}-${randomUUID()}@test.local`);
  await page.getByLabel('Contraseña').fill('clave-segura-123');
  await page.getByRole('button', { name: 'Crear cuenta', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Mis grupos' })).toBeVisible();
}

export async function unirse(page: Page, link: string) {
  await page.getByRole('button', { name: 'Unirme con código' }).click();
  await page.getByPlaceholder('Código o link de invitación').fill(link);
  await page.getByRole('button', { name: 'Unirme', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Salas de chat' })).toBeVisible();
}

/** Ana crea el grupo `nombre`; Beto y Caro se unen. Cada uno en su contexto; `antes` corre en cada página antes de navegar. */
export async function grupoDeTres(browser: Browser, nombre: string, antes?: (p: Page) => Promise<void>) {
  const [a, b, c] = await Promise.all([0, 1, 2].map(async () => {
    const p = await (await browser.newContext()).newPage();
    await antes?.(p);
    return p;
  }));
  await crearCuenta(a, 'Ana');
  await a.getByRole('button', { name: 'Crear grupo' }).click();
  await a.getByPlaceholder('Nombre del grupo').fill(nombre);
  await a.getByRole('button', { name: 'Crear', exact: true }).click();
  await a.getByRole('button', { name: 'Invitar' }).click();
  const link = (await a.getByTestId('link-invitacion').textContent())!.trim();
  await crearCuenta(b, 'Beto');
  await unirse(b, link);
  await crearCuenta(c, 'Caro');
  await unirse(c, link);
  return [a, b, c] as const;
}

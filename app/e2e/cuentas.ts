import { expect, type Page } from '@playwright/test';
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

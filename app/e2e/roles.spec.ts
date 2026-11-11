import { test, expect, type Page } from '@playwright/test';
import PocketBase from 'pocketbase';
import { grupoDeTres } from './cuentas';

// Nombre de grupo único: la base de los e2e dura toda la corrida y la búsqueda por nombre no se puede confundir.
const unico = (n: string) => `${n}${Math.random().toString(36).slice(2, 6)}`;

// Roles: el admin los arma en Configuraciones → Roles y los da en Participantes; cada uno ve lo que su rol le deja.

test.afterEach(async ({ browser }) => { for (const c of browser.contexts()) await c.close(); });

const configuracion = async (p: Page, grupo: string, solapa?: string) => {
  await p.getByRole('button', { name: grupo, exact: true }).click();
  await p.getByRole('button', { name: 'Configuraciones' }).click();
  if (solapa) await p.getByRole('tab', { name: solapa }).click();
};

/** Ana crea un rol con `permisos` y se lo da a Beto. */
async function rolParaBeto(a: Page, grupo: string, nombre: string, permisos: string[]) {
  await configuracion(a, grupo, 'Roles');
  await a.getByRole('button', { name: 'Crear rol' }).click();
  await a.getByLabel('Nombre del rol').fill(nombre);
  await a.getByLabel('Nombre del rol').press('Tab');
  for (const x of permisos) await a.getByRole('checkbox', { name: x }).check();
  await expect(a.getByRole('button', { name: new RegExp(nombre) })).toBeVisible();
  await a.getByRole('tab', { name: 'Participantes' }).click();
  await a.getByRole('button', { name: /^Roles de Beto/ }).click();
  await a.getByRole('group', { name: /^Elegir roles de Beto/ }).getByRole('checkbox', { name: nombre }).check();
  await expect(a.locator('dialog.config li', { hasText: 'Beto' }).locator('.etiqueta', { hasText: nombre })).toBeVisible();
  await a.keyboard.press('Escape');
}

test('el admin crea el rol DJ y se lo da a Beto; Beto ve la etiqueta pero no la solapa Roles', async ({ browser }) => {
  const N = unico('G');
  const [a, b] = await grupoDeTres(browser, N);
  await rolParaBeto(a, N, 'DJ', ['Agregar canciones']);
  await configuracion(b, N, 'Participantes');
  await expect(b.locator('dialog.config li', { hasText: 'Beto' }).locator('.etiqueta', { hasText: 'DJ' })).toBeVisible();
  await expect(b.locator('dialog.config li', { hasText: 'Ana' }).getByText('ADMIN')).toBeVisible();
  await expect(b.getByRole('tab', { name: 'Roles' })).toHaveCount(0);
  await expect(b.getByRole('button', { name: /^Roles de/ })).toHaveCount(0);
});

test('borrar un rol se lo saca a todos', async ({ browser }) => {
  const N = unico('G');
  const [a] = await grupoDeTres(browser, N);
  await rolParaBeto(a, N, 'Moderador', ['Silenciar']);
  await configuracion(a, N, 'Roles');
  await a.getByRole('button', { name: /Moderador/ }).click();
  await a.getByRole('button', { name: 'Borrar rol' }).click();
  await a.getByRole('button', { name: /^(Sí|Borrar|Confirmar)/ }).last().click();
  await a.getByRole('tab', { name: 'Participantes' }).click();
  await expect(a.locator('dialog.config .etiqueta', { hasText: 'Moderador' })).toHaveCount(0);
});

test('Bloqueados: lista a quien no puede entrar a la voz, con quién lo hizo, y Desbloquear lo saca', async ({ browser }) => {
  const N = unico('G');
  const [a] = await grupoDeTres(browser, N);
  const admin = new PocketBase(`http://127.0.0.1:${process.env.E2E_PB_PORT ?? 8091}`);
  await admin.collection('_superusers').authWithPassword('admin@test.local', 'admin-pass-1234');
  const g = await admin.collection('groups').getFirstListItem(`name = "${N}"`, { expand: 'members' });
  const caro = g.expand!.members.find((m: { name: string }) => m.name.startsWith('Caro'));
  await admin.collection('groups').update(g.id, { bloqueados: [caro.id], bloqueadosInfo: { [caro.id]: { por: g.owner, fecha: new Date().toISOString() } } });
  await configuracion(a, N, 'Bloqueados');
  const fila = a.locator('dialog.config li', { hasText: 'Caro' });
  await expect(fila).toContainText('Por Ana');
  await fila.getByRole('button', { name: 'Desbloquear' }).click();
  await expect(a.getByText('No hay nadie bloqueado de la voz.')).toBeVisible();
  await expect(a.getByText('No hay nadie baneado.')).toBeVisible();
});

const entrarVoz = async (ps: Page[]) => {
  for (const p of ps) await p.getByRole('button', { name: 'Sala de voz General' }).click();
  for (const p of ps) await expect(p.locator('section.voz .franja li')).toHaveCount(ps.length, { timeout: 15_000 });
};
const panelMusica = (p: Page) => p.getByRole('button', { name: 'Música', exact: true }).click();

test('música: sin rol no se agrega; con DJ (agregar) sí, y los permisos cambian en vivo', async ({ browser }) => {
  const N = unico('G');
  const [a, b] = await grupoDeTres(browser, N);
  await entrarVoz([a, b]);
  await panelMusica(b);
  await expect(b.getByText('Para agregar canciones hace falta un rol que lo permita.')).toBeVisible();
  await expect(b.getByRole('button', { name: 'Agregar' })).toHaveCount(0);
  await b.keyboard.press('Escape');
  await rolParaBeto(a, N, 'DJ', ['Agregar canciones']);
  await panelMusica(b);
  await expect(b.getByRole('button', { name: 'Agregar' })).toBeVisible();
  await b.keyboard.press('Escape');
  // Ana le saca el rol: a Beto se le va el botón sin recargar.
  await configuracion(a, N, 'Participantes');
  await a.getByRole('button', { name: /^Roles de Beto/ }).click();
  await a.getByRole('group', { name: /^Elegir roles de Beto/ }).getByRole('checkbox', { name: 'DJ' }).uncheck();
  await panelMusica(b);
  await expect(b.getByRole('button', { name: 'Agregar' })).toHaveCount(0);
});

test('un Moderador silencia a Caro desde la llamada; sobre la admin no tiene opciones', async ({ browser }) => {
  const N = unico('G');
  const [a, b, c] = await grupoDeTres(browser, N);
  await rolParaBeto(a, N, 'Moderador', ['Silenciar']);
  await entrarVoz([a, b, c]);
  await b.locator('section.voz .franja li', { hasText: 'Caro' }).click({ button: 'right' });
  await b.getByRole('button', { name: 'Silenciar', exact: true }).click();
  const admin = new PocketBase(`http://127.0.0.1:${process.env.E2E_PB_PORT ?? 8091}`);
  await admin.collection('_superusers').authWithPassword('admin@test.local', 'admin-pass-1234');
  const g = await admin.collection('groups').getFirstListItem(`name = "${N}"`, { expand: 'members' });
  const caro = g.expand!.members.find((m: { name: string }) => m.name.startsWith('Caro'));
  await expect.poll(async () => (await admin.collection('groups').getOne(g.id)).silenciados).toContain(caro.id);
  await b.keyboard.press('Escape');
  await b.locator('section.voz .franja li', { hasText: 'Ana' }).click({ button: 'right' });
  await expect(b.getByRole('button', { name: 'Silenciar', exact: true })).toHaveCount(0);
  await expect(b.getByRole('button', { name: 'Desconectar de la llamada' })).toHaveCount(0);
});

test('sin "Subir sonidos" no aparece Nuevo sonido en la botonera', async ({ browser }) => {
  const N = unico('G');
  const [a, b] = await grupoDeTres(browser, N);
  await entrarVoz([a, b]);
  await b.getByRole('button', { name: 'Sonidos', exact: true }).click();
  await expect(b.getByRole('button', { name: 'Nuevo sonido' })).toHaveCount(0);
  await a.getByRole('button', { name: 'Sonidos', exact: true }).click();
  await expect(a.getByRole('button', { name: 'Nuevo sonido' })).toBeVisible();
});

test('la cuenta verificada muestra la tilde azul al lado del nombre, sin recargar', async ({ browser }) => {
  const N = unico('G');
  const [, b] = await grupoDeTres(browser, N);
  const admin = new PocketBase(`http://127.0.0.1:${process.env.E2E_PB_PORT ?? 8091}`);
  await admin.collection('_superusers').authWithPassword('admin@test.local', 'admin-pass-1234');
  const g = await admin.collection('groups').getFirstListItem(`name = "${N}"`);
  await configuracion(b, N, 'Participantes');
  const fila = b.locator('dialog.config li', { hasText: 'Ana' });
  await expect(fila.getByLabel('Cuenta verificada')).toHaveCount(0);
  await admin.collection('users').update(g.owner, { verificado: true });
  await expect(fila.getByLabel('Cuenta verificada')).toBeVisible({ timeout: 10_000 });
  await expect(b.locator('dialog.config li', { hasText: 'Beto' }).getByLabel('Cuenta verificada')).toHaveCount(0);
});

test('con "Borrar sonidos" se borra desde la botonera; sin el permiso no aparece el tachito', async ({ browser }) => {
  const N = unico('G');
  const [a, b, c] = await grupoDeTres(browser, N);
  const admin = new PocketBase(`http://127.0.0.1:${process.env.E2E_PB_PORT ?? 8091}`);
  await admin.collection('_superusers').authWithPassword('admin@test.local', 'admin-pass-1234');
  const g = await admin.collection('groups').getFirstListItem(`name = "${N}"`);
  const wav = Buffer.alloc(44 + 1600); wav.write('RIFF', 0); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(16000, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(1600, 40);
  const d = new FormData(); d.append('group', g.id); d.append('owner', g.owner); d.append('name', 'Corneta'); d.append('file', new Blob([wav], { type: 'audio/wav' }), 'c.wav');
  await admin.collection('sonidos').create(d);
  await rolParaBeto(a, N, 'Limpieza', ['Borrar sonidos']);
  for (const p of [b, c]) {
    await p.getByRole('button', { name: 'Sala de voz General' }).click();
    await p.getByRole('button', { name: 'Sonidos', exact: true }).click();
    await expect(p.getByRole('button', { name: 'Corneta', exact: true })).toBeVisible({ timeout: 10_000 });
  }
  await expect(c.getByRole('button', { name: 'Borrar Corneta' })).toHaveCount(0);
  await b.getByRole('button', { name: 'Borrar Corneta' }).click();
  await b.getByRole('button', { name: 'Borrar', exact: true }).click();
  await expect(b.getByRole('button', { name: 'Corneta', exact: true })).toHaveCount(0, { timeout: 10_000 });
  await expect(c.getByRole('button', { name: 'Corneta', exact: true })).toHaveCount(0, { timeout: 10_000 });
});

test('clic derecho en la lista de salas: el mismo menú, con volumen y roles en un renglón cada uno', async ({ browser }) => {
  const N = unico('G');
  const [a, b] = await grupoDeTres(browser, N);
  await configuracion(a, N, 'Roles');
  await a.getByRole('button', { name: 'Crear rol' }).click();
  await a.keyboard.press('Escape');
  for (const p of [a, b]) await p.getByRole('button', { name: 'Sala de voz General' }).click();
  await expect(a.locator('ul.quienes li', { hasText: 'Beto' })).toBeVisible({ timeout: 15_000 });
  await a.locator('ul.quienes li', { hasText: 'Beto' }).click({ button: 'right' });
  const menu = a.locator('.menu-persona:popover-open');
  await expect(menu.getByLabel(/^Volumen de Beto/)).toBeVisible();
  const rol = menu.locator('label.rol').first();
  const [casilla, nombre] = [await rol.locator('input').boundingBox(), await rol.locator('.nombre-rol').boundingBox()];
  expect(Math.abs((casilla!.y + casilla!.height / 2) - (nombre!.y + nombre!.height / 2))).toBeLessThan(6); // mismo renglón
  await rol.locator('input').check();
  await a.keyboard.press('Escape');
  await configuracion(a, N, 'Participantes');
  await expect(a.locator('dialog.config li', { hasText: 'Beto' }).locator('.etiqueta')).toHaveCount(1);
});

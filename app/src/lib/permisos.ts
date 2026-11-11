import type { RecordModel } from 'pocketbase';

// Roles y permisos de un grupo: mismas reglas que server/pb_hooks/roles.js (el servidor es el que manda; acá solo
// se decide qué mostrar). El admin (dueño) puede todo; el resto, lo del rol "todos" más lo de sus roles.

export type Permiso = 'silenciar' | 'desconectar' | 'bloquearVoz' | 'banear' | 'mensajes' | 'grupo' | 'salas'
  | 'agregarMusica' | 'cola' | 'youtube' | 'subirSonidos' | 'botonera';
export type Rol = { id: string; nombre: string; color: string; permisos: Permiso[] };

export const PERMISOS: { clave: Permiso; texto: string; grupo: 'Moderar' | 'Grupo' | 'Música' | 'Botonera' }[] = [
  { clave: 'silenciar', texto: 'Silenciar', grupo: 'Moderar' },
  { clave: 'desconectar', texto: 'Desconectar y mover de sala', grupo: 'Moderar' },
  { clave: 'bloquearVoz', texto: 'Bloquear la voz', grupo: 'Moderar' },
  { clave: 'banear', texto: 'Echar y banear', grupo: 'Moderar' },
  { clave: 'mensajes', texto: 'Borrar mensajes de otros', grupo: 'Moderar' },
  { clave: 'grupo', texto: 'Editar el grupo', grupo: 'Grupo' },
  { clave: 'salas', texto: 'Manejar las salas', grupo: 'Grupo' },
  { clave: 'agregarMusica', texto: 'Agregar canciones', grupo: 'Música' },
  { clave: 'cola', texto: 'Manejar la cola', grupo: 'Música' },
  { clave: 'youtube', texto: 'Videos de YouTube juntos', grupo: 'Música' },
  { clave: 'subirSonidos', texto: 'Subir sonidos', grupo: 'Botonera' },
  { clave: 'botonera', texto: 'Editar la botonera', grupo: 'Botonera' },
];
const CLAVES = new Set<string>(PERMISOS.map((p) => p.clave));
export const MAX_ROLES = 20, MAX_NOMBRE = 24;

/** Roles del grupo con "todos" primero (un grupo sin el campo, de antes de los roles, tiene solo "todos" vacío). */
export function rolesDe(g: RecordModel): Rol[] {
  const roles = Array.isArray(g.roles) ? (g.roles as Rol[]) : [];
  const todos = roles.find((r) => r?.id === 'todos') ?? { id: 'todos', nombre: 'Todos', color: '', permisos: [] };
  return [todos, ...roles.filter((r) => r && r.id !== 'todos')];
}

const asignados = (g: RecordModel, userId: string): string[] => (g.asignaciones && typeof g.asignaciones === 'object' ? g.asignaciones[userId] : null) ?? [];

/** Roles de un miembro, sin "todos" y sin los que ya no existen. */
export function rolesDeMiembro(g: RecordModel, userId: string): Rol[] {
  const ids = asignados(g, userId);
  return rolesDe(g).filter((r) => r.id !== 'todos' && ids.includes(r.id));
}

export function permisosDe(g: RecordModel, userId: string | undefined): Set<Permiso> {
  if (!userId) return new Set();
  if (g.owner === userId) return new Set(PERMISOS.map((p) => p.clave));
  const mios = [rolesDe(g)[0], ...rolesDeMiembro(g, userId)];
  return new Set(mios.flatMap((r) => r.permisos ?? []).filter((p): p is Permiso => CLAVES.has(p)));
}

export const puedo = (g: RecordModel, userId: string | undefined, p: Permiso) => permisosDe(g, userId).has(p);

export function resumen(rol: Rol): string {
  const textos = PERMISOS.filter((p) => rol.permisos?.includes(p.clave)).map((p) => p.texto);
  return textos.length ? textos.join(' · ') : 'Sin permisos';
}

export function nuevoId(): string {
  const abc = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from(crypto.getRandomValues(new Uint8Array(10)), (n) => abc[n % abc.length]).join('');
}

/** Colores para elegir al crear un rol. */
export const COLORES_ROL = ['#e5b84b', '#5bc77a', '#8b7cf6', '#e25c6f', '#4fb3e8', '#f08a4b', '#d46bd8', '#a1a6b9'];

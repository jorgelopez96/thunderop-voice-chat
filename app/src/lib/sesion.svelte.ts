import { ClientResponseError, type RecordModel } from 'pocketbase';
import { pb } from './pb';

// Svelte no permite reasignar un $state exportado: se expone como propiedad de un objeto.
export const sesion = $state<{ usuario: RecordModel | null }>({ usuario: pb.authStore.isValid ? pb.authStore.record : null });
pb.authStore.onChange(() => { sesion.usuario = pb.authStore.record; });

/** Revalida el token guardado contra el servidor; si falla (vencido, usuario borrado) cierra la sesión. */
export async function validarSesionAlIniciar() {
  if (!pb.authStore.token) return;
  try { await pb.collection('users').authRefresh(); } catch (e) {
    // Solo 401/403/404 invalidan la sesión; red caída (0) o 5xx conservan la guardada.
    if (e instanceof ClientResponseError && [401, 403, 404].includes(e.status)) pb.authStore.clear();
  }
}

export async function entrar(email: string, pass: string) {
  await pb.collection('users').authWithPassword(email, pass);
}

export async function registrarse(email: string, pass: string, name: string) {
  await pb.collection('users').create({ email, password: pass, passwordConfirm: pass, name });
  await entrar(email, pass);
}

export function salir() { pb.authStore.clear(); }

/** Mensaje de error del servidor en español; si no se reconoce, el mensaje original. */
export function mensajeError(e: unknown): string {
  if (!(e instanceof ClientResponseError)) return 'No se pudo conectar con el servidor.';
  if (e.status === 0) return 'No se pudo conectar con el servidor.';
  const campos = Object.entries(e.response?.data ?? {}) as [string, { code?: string; message?: string }][];
  const en = (c: string) => campos.find(([k]) => k === c)?.[1];
  if (en('email')?.code === 'validation_not_unique') return 'Ese email ya está registrado.';
  if (en('email')) return 'El email no es válido.';
  if (en('password')) return 'La contraseña debe tener al menos 8 caracteres.';
  if (en('name')) return 'El nombre debe tener entre 1 y 32 caracteres.';
  if (en('color')) return 'El color no es válido.';
  if (en('status')) return 'El estado puede tener hasta 80 caracteres.';
  if (en('avatar')) return 'La foto no es válida (PNG, JPG, WebP o GIF de hasta 2 MB).';
  if (e.status === 400 && /authenticate/i.test(e.message)) return 'Email o contraseña incorrectos.';
  if (e.status === 429) return 'Demasiados intentos, esperá un momento.';
  return e.message;
}

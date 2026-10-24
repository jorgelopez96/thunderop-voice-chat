import { ClientResponseError, type RecordModel } from 'pocketbase';
import { pb } from './pb';
import { cuenta, pedirCodigo, type Falta } from './cuenta.svelte';

// Svelte no permite reasignar un $state exportado: se expone como propiedad de un objeto.
export const sesion = $state<{ usuario: RecordModel | null }>({ usuario: pb.authStore.isValid ? pb.authStore.record : null });
pb.authStore.onChange(() => { sesion.usuario = pb.authStore.record; });

// "Recordar mi cuenta": la contraseña nunca se guarda; persiste el token (se renueva en cada arranque, dura 30 días).
// Sin recordar, `dm.recordar = '0'` y la bandera de sessionStorage marca que esta ejecución ya inició sesión:
// al reabrir la app no está y la sesión guardada se descarta.
const RECORDAR = 'dm.recordar', EN_CURSO = 'dm.sesion', EMAIL = 'dm.email';

export function anotar(recordar: boolean, email: string) {
  try {
    localStorage.setItem(RECORDAR, recordar ? '1' : '0');
    sessionStorage.setItem(EN_CURSO, '1');
    if (recordar) localStorage.setItem(EMAIL, email); else localStorage.removeItem(EMAIL);
  } catch { /* almacenamiento bloqueado: se comporta como recordar */ }
}

/** Email de la última sesión recordada ('' si no hay). */
export function emailRecordado(): string {
  try { return localStorage.getItem(EMAIL) ?? ''; } catch { return ''; }
}

/** Revalida el token guardado contra el servidor; si falla (vencido, usuario borrado) cierra la sesión. */
export async function validarSesionAlIniciar() {
  if (!pb.authStore.token) return;
  try {
    if (localStorage.getItem(RECORDAR) === '0' && !sessionStorage.getItem(EN_CURSO)) { pb.authStore.clear(); return; }
  } catch { /* sin almacenamiento: se sigue como recordar */ }
  try { await pb.collection('users').authRefresh(); } catch (e) {
    // Solo 401/403/404 invalidan la sesión; red caída (0) o 5xx conservan la guardada.
    if (e instanceof ClientResponseError && [401, 403, 404].includes(e.status)) pb.authStore.clear();
  }
}

/** `identidad` es el usuario o el mail. */
export async function entrar(identidad: string, pass: string, recordar = true) {
  await pb.collection('users').authWithPassword(identidad, pass);
  anotar(recordar, identidad);
}

/** Crea la cuenta y manda el código por mail; no entra hasta confirmarlo (después: `verificar` y `entrar`). */
export async function registrarse(datos: { email: string; username: string; name: string; password: string; nacimiento: string; terminos: number }, _recordar = true) {
  const { password, ...resto } = datos;
  await pb.collection('users').create({ ...resto, password, passwordConfirm: password });
  await pedirCodigo(datos.email, 'verificar');
}

export function salir() { pb.authStore.clear(); }

/** Mensaje de error del servidor en español; si no se reconoce, el mensaje original. */
export function mensajeError(e: unknown): string {
  if (!(e instanceof ClientResponseError)) return 'No se pudo conectar con el servidor.';
  if (e.status === 0) return 'No se pudo conectar con el servidor.';
  if (e.status === 403 && Array.isArray(e.response?.falta)) { cuenta.falta = e.response.falta as Falta[]; return 'Completá tu cuenta para seguir.'; }
  const campos = Object.entries(e.response?.data ?? {}) as [string, { code?: string; message?: string }][];
  const en = (c: string) => campos.find(([k]) => k === c)?.[1];
  if (en('username')?.code === 'validation_not_unique') return 'Ese usuario ya existe, probá con otro.';
  if (en('email')?.code === 'validation_not_unique') return 'Ese email ya está registrado.';
  if (en('email')) return 'El email no es válido.';
  if (en('password')) return 'La contraseña necesita 8 caracteres, una mayúscula, un número y un carácter especial.';
  if (en('name')) return 'El nombre debe tener entre 1 y 32 caracteres.';
  if (en('color')) return 'El color no es válido.';
  if (en('status')) return 'El estado puede tener hasta 80 caracteres.';
  if (en('avatar')) return 'La foto no es válida (imagen, hasta 2 MB).';
  if (en('file')) return 'El archivo no es válido (imagen o video, hasta 25 MB).';
  if (e.status === 400 && /authenticate/i.test(e.message)) return 'Usuario, email o contraseña incorrectos.';
  if (e.status === 429) return 'Demasiados intentos, esperá un momento.';
  return e.message;
}

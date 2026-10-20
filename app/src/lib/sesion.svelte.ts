import { ClientResponseError, type RecordModel } from 'pocketbase';
import { pb } from './pb';

// Svelte no permite reasignar un $state exportado: se expone como propiedad de un objeto.
export const sesion = $state<{ usuario: RecordModel | null }>({ usuario: pb.authStore.isValid ? pb.authStore.record : null });
pb.authStore.onChange(() => { sesion.usuario = pb.authStore.record; });

// "Recordar mi cuenta": la contraseña nunca se guarda; persiste el token (se renueva en cada arranque, dura 30 días).
// Sin recordar, `dm.recordar = '0'` y la bandera de sessionStorage marca que esta ejecución ya inició sesión:
// al reabrir la app no está y la sesión guardada se descarta.
const RECORDAR = 'dm.recordar', EN_CURSO = 'dm.sesion', EMAIL = 'dm.email';

function anotar(recordar: boolean, email: string) {
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

export async function entrar(email: string, pass: string, recordar = true) {
  await pb.collection('users').authWithPassword(email, pass);
  anotar(recordar, email);
}

export async function registrarse(email: string, pass: string, name: string, recordar = true) {
  await pb.collection('users').create({ email, password: pass, passwordConfirm: pass, name });
  await entrar(email, pass, recordar);
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
  if (en('name')?.code === 'validation_not_unique') return 'Ese nombre ya existe, probá con otro.';
  if (en('name')) return 'El nombre debe tener entre 1 y 32 caracteres.';
  if (en('color')) return 'El color no es válido.';
  if (en('status')) return 'El estado puede tener hasta 80 caracteres.';
  if (en('avatar')) return 'La foto no es válida (imagen, hasta 2 MB).';
  if (en('file')) return 'El archivo no es válido (imagen o video, hasta 25 MB).';
  if (e.status === 400 && /authenticate/i.test(e.message)) return 'Email o contraseña incorrectos.';
  if (e.status === 429) return 'Demasiados intentos, esperá un momento.';
  return e.message;
}

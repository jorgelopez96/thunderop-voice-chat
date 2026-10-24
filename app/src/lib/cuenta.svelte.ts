import { openUrl } from '@tauri-apps/plugin-opener';
import { pb } from './pb';
import { anotar, mensajeError } from './sesion.svelte';

export type Falta = 'verificar' | 'invitacion' | 'terminos' | 'perfil';

/** Lo que le falta a la cuenta actual (null = todavía no se consultó). */
export const cuenta = $state<{ falta: Falta[] | null; menor: boolean; terminosVigente: number; error: string }>({ falta: null, menor: false, terminosVigente: 0, error: '' });

// Un 403 de cuenta incompleta (también de pedidos en segundo plano) vuelve a la pantalla de completar.
// Se engancha acá y no en pb.ts: así pb.ts no importa nada y no hay ciclo al arrancar.
pb.afterSend = (res, data) => {
  if (res.status === 403 && Array.isArray(data?.falta)) cuenta.falta = data.falta;
  return data;
};

const post = (ruta: string, body: object) => pb.send(`/api/cuenta/${ruta}`, { method: 'POST', body });

/** No lanza. Si falla y ya había un estado, lo conserva (un corte suelto no saca de la pantalla actual); si no había,
 *  deja `falta` en null y el motivo en `cuenta.error` (la pantalla de carga ofrece reintentar o salir). */
export async function cargarEstado() {
  try {
    const e = await pb.send('/api/cuenta/estado', {});
    cuenta.falta = e.falta;
    cuenta.menor = e.menor;
    cuenta.terminosVigente = e.terminosVigente;
    cuenta.error = '';
  } catch (e) {
    if (cuenta.falta !== null) return;
    cuenta.error = mensajeError(e);
  }
}

/** Versión de términos vigente (sin sesión); es la que hay que mandar al registrarse. */
export async function leerTerminos(): Promise<number> {
  cuenta.terminosVigente = (await pb.send('/api/cuenta/terminos', {})).version;
  return cuenta.terminosVigente;
}

export const pedirCodigo = (email: string, tipo: 'verificar' | 'restablecer') => post('codigo', { email, tipo });
export const verificar = (email: string, codigo: string) => post('verificar', { email, codigo });
export const restablecer = (email: string, codigo: string, password: string) => post('restablecer', { email, codigo, password });

export async function ponerInvitacion(codigo: string) { await post('invitacion', { codigo }); await cargarEstado(); }
// authRefresh trae el usuario elegido (la sesión guardada tenía el que se puso al azar al entrar con Google/Microsoft).
export async function completar(datos: { username: string; nacimiento: string; terminos: number }) {
  await post('completar', datos);
  await pb.collection('users').authRefresh().catch(() => {}); // ya quedó completo: si falla, se ve al reabrir
  await cargarEstado();
}
export async function aceptarTerminos(version: number) { await post('terminos', { version }); await cargarEstado(); }

export async function entrarCon(proveedor: 'google' | 'microsoft') {
  await pb.collection('users').authWithOAuth2({ provider: proveedor, urlCallback: (url) => { void openUrl(url); } });
  anotar(true, '');
  await cargarEstado();
}

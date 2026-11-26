import type { RecordModel } from 'pocketbase';
import { invoke } from '@tauri-apps/api/core';
import { esEscritorio } from './plataforma.svelte';
import { pb } from './pb';
import { voz } from './voz.svelte';

// Presencia: cada cliente manda un latido cada 45 s (guarda `users.visto`); en línea = visto hace menos de 90 s.
// El realtime de `users` trae los `visto` de quienes puedo ver (compañeros de grupo y amigos).
const LATIDO_MS = 45_000;
const EN_LINEA_MS = 90_000;
// "Ausente" solo: sin tocar teclado ni mouse este rato (en la app de escritorio, en toda la PC). En una sala de voz no
// cuenta: escuchar o mirar una transmisión es estar.
const INACTIVO_MS = 10 * 60_000;

/** `visto` en ISO o en el formato de PocketBase (`2026-10-20 12:00:00.000Z`). Vacío o inválido → false. */
export function enLineaSegun(visto: string | undefined, ahora: number): boolean {
  const t = Date.parse((visto ?? '').replace(' ', 'T'));
  return Number.isFinite(t) && ahora - t < EN_LINEA_MS;
}

const vistos = $state<Record<string, string>>({});
// La foto también llega por el realtime: así se ve al toque en todos lados, sin esperar a que se recarguen
// los grupos, los amigos o los mensajes (que traen el usuario de cuando se cargaron).
const avatares = $state<Record<string, string>>({});
/** La foto más nueva que se conoce de `u` (vacío = sin foto). */
export const avatarActual = (u: RecordModel): string => avatares[u.id] ?? u.avatar;
const disponibilidades = $state<Record<string, string>>({});
const inactivos = $state<Record<string, boolean>>({});
const reloj = $state({ ahora: Date.now() });

// Nombre, color, descripción e insignia se leen en muchos lados: en vez de un mapa aparte, cada lista que guarda
// usuarios (grupos, amigos, chats abiertos) se anota acá y copia lo nuevo sobre sus registros.
const oyentesUsuario = new Set<(u: RecordModel) => void>();
export function alCambiarUsuario(f: (u: RecordModel) => void) { oyentesUsuario.add(f); return () => { oyentesUsuario.delete(f); }; }
const CAMPOS = ['name', 'color', 'status', 'avatar', 'fundador', 'verificado'] as const;
/** Si `u` es el usuario de `nuevo`, le copia los datos de perfil que cambiaron (sobre $state solo avisa lo que cambió). */
export function parchear(u: RecordModel | null | undefined, nuevo: RecordModel) {
  if (u?.id !== nuevo.id) return;
  for (const c of CAMPOS) if (c in nuevo && u[c] !== nuevo[c]) u[c] = nuevo[c];
}

/** Reactiva: usa el `visto` del realtime si llegó, si no el del registro. */
export function enLinea(u: RecordModel | string): boolean {
  const id = typeof u === 'string' ? u : u.id;
  return enLineaSegun(vistos[id] ?? (typeof u === 'string' ? undefined : u.visto), reloj.ahora);
}

export type Estado = 'disponible' | 'ausente' | 'ocupado' | 'desconectado';
/** Lo que muestra la lucecita: desconectado (o invisible, que no late) o el estado que eligió. */
export function estado(u: RecordModel): Estado {
  if (!enLinea(u)) return 'desconectado';
  const d = disponibilidades[u.id] ?? u.disponibilidad;
  if (d === 'ocupado') return d;
  return d === 'ausente' || (inactivos[u.id] ?? u.inactivo) ? 'ausente' : 'disponible';
}

let yoInactivo = false;
export const latir = () => pb.send('/api/latido', { method: 'POST', body: { inactivo: yoInactivo }, requestKey: null }).catch(() => {});

/** Arranca el latido, el realtime y el reloj. Devuelve la limpieza. */
export function iniciarPresencia(): () => void {
  void latir();
  const latido = setInterval(latir, LATIDO_MS);
  const tic = setInterval(() => (reloj.ahora = Date.now()), 15_000);
  // En el navegador solo se ve lo que pasa en la pestaña.
  let toque = Date.now();
  const toco = () => (toque = Date.now());
  const EVENTOS = ['pointermove', 'pointerdown', 'keydown', 'wheel'];
  for (const ev of EVENTOS) addEventListener(ev, toco, { passive: true });
  const quieto = () => (esEscritorio ? invoke<number>('inactivo_ms') : Promise.resolve(Date.now() - toque));
  const mirar = setInterval(() => quieto().then((ms) => {
    const si = ms >= INACTIVO_MS && !voz.salaId;
    if (si === yoInactivo) return;
    yoInactivo = si;
    const yo = pb.authStore.record?.id;
    if (yo) inactivos[yo] = si; // el propio se ve al instante
    void latir();
  }).catch(() => {}), 3_000);
  // Al cortarse la conexión el servidor la da por desconectada: al volver a conectar, latir para verse en línea ya.
  const reconexion = pb.realtime.subscribe('PB_CONNECT', () => void latir());
  const sub = pb.collection('users').subscribe('*', (e) => {
    vistos[e.record.id] = e.record.visto; disponibilidades[e.record.id] = e.record.disponibilidad; avatares[e.record.id] = e.record.avatar;
    inactivos[e.record.id] = e.record.inactivo;
    for (const f of oyentesUsuario) f(e.record);
  });
  return () => {
    clearInterval(latido);
    clearInterval(tic);
    clearInterval(mirar);
    for (const ev of EVENTOS) removeEventListener(ev, toco);
    sub.then((f) => f()).catch(() => {});
    reconexion.then((f) => f()).catch(() => {});
  };
}

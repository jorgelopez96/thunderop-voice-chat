import { pb } from './pb';
import { menciona } from './menciones';
import { avisar, ver, silenciadoHasta, resumen } from './notificaciones.svelte';

// Mensajes sin leer por sala (chats y chats de salas de voz). Lo leído se guarda en este dispositivo:
// `localStorage['dm.leido.<usuario>']` = { sala: fecha del último mensaje visto }.
// ponytail: por dispositivo; si piden que se sincronice entre PCs, una colección `lecturas` en PocketBase.
export const noLeidos = $state<{ salas: Record<string, number>; grupoDe: Record<string, string> }>({ salas: {}, grupoDe: {} });

const mirando = new Set<string>();
const clave = () => `dm.leido.${pb.authStore.record?.id}`;
const leer = (): Record<string, string> => { try { return JSON.parse(localStorage.getItem(clave()) ?? '{}'); } catch { return {}; } };
const guardar = (v: Record<string, string>) => { try { localStorage.setItem(clave(), JSON.stringify(v)); } catch { /* sin almacenamiento */ } };
const ahora = () => new Date().toISOString().replace('T', ' ');

/** Sin leer de un grupo (suma de sus salas). */
export const delGrupo = (groupId: string) =>
  Object.entries(noLeidos.salas).reduce((n, [sala, c]) => n + (noLeidos.grupoDe[sala] === groupId ? c : 0), 0);

/** La vista que muestra el chat de `sala` lo llama al abrirlo; devuelve la función para dejar de mirarla. */
export function mirar(sala: string) {
  mirando.add(sala);
  marcarLeida(sala);
  const dejar = ver(sala);
  return () => { mirando.delete(sala); dejar(); marcarLeida(sala); };
}

export function marcarLeida(sala: string) {
  guardar({ ...leer(), [sala]: ahora() });
  noLeidos.salas[sala] = 0;
}

/** Cuenta lo pendiente de cada sala y escucha los mensajes nuevos. Para el $effect de Principal. */
export function iniciarNoLeidos() {
  let vivo = true;
  const yo = pb.authStore.record?.id ?? '';
  (async () => {
    const salas = await pb.collection('rooms').getFullList({ fields: 'id,group' });
    const leido = leer();
    const faltan: Record<string, string> = {};
    for (const s of salas) {
      noLeidos.grupoDe[s.id] = s.group;
      // Sala nunca vista en este dispositivo: arranca leída (no se marcan como nuevos los mensajes viejos).
      if (!leido[s.id]) { faltan[s.id] = ahora(); continue; }
      if (mirando.has(s.id)) continue;
      const r = await pb.collection('messages').getList(1, 1, { filter: pb.filter('room = {:s} && author != {:yo} && created > {:c}', { s: s.id, yo, c: leido[s.id] }), fields: 'id' });
      if (vivo) noLeidos.salas[s.id] = r.totalItems;
    }
    guardar({ ...faltan, ...leer() }); // lo marcado mientras se contaba gana
  })().catch(() => { /* sin contador: no es grave */ });

  const sub = pb.collection('messages').subscribe('*', (e) => {
    if (e.action !== 'create' || e.record.author === yo) return;
    const s = e.record.room as string;
    if (!noLeidos.grupoDe[s]) pb.collection('rooms').getOne(s, { fields: 'id,group' }).then((r) => (noLeidos.grupoDe[s] = r.group), () => {});
    const meNombran = menciona(e.record.text, pb.authStore.record?.name);
    if (!silenciadoHasta(s) || meNombran) pb.collection('messages').getOne(e.record.id, { expand: 'author,room' })
      .then((m) => avisar(s, `${m.expand?.author?.name ?? 'Alguien'} ${meNombran ? 'te mencionó en' : '·'} ${m.expand?.room?.name ?? ''}`, resumen(m), meNombran, meNombran), () => {});
    if (mirando.has(s)) return marcarLeida(s);
    noLeidos.salas[s] = (noLeidos.salas[s] ?? 0) + 1;
  });
  return () => { vivo = false; sub.then((f) => f()).catch(() => {}); noLeidos.salas = {}; };
}

import type { RecordModel } from 'pocketbase';
import { pb } from './pb';

// Presencia: cada cliente manda un latido cada 45 s (guarda `users.visto`); en línea = visto hace menos de 90 s.
// El realtime de `users` trae los `visto` de quienes puedo ver (compañeros de grupo y amigos).
const LATIDO_MS = 45_000;
const EN_LINEA_MS = 90_000;

/** `visto` en ISO o en el formato de PocketBase (`2026-10-20 12:00:00.000Z`). Vacío o inválido → false. */
export function enLineaSegun(visto: string | undefined, ahora: number): boolean {
  const t = Date.parse((visto ?? '').replace(' ', 'T'));
  return Number.isFinite(t) && ahora - t < EN_LINEA_MS;
}

const vistos = $state<Record<string, string>>({});
const reloj = $state({ ahora: Date.now() });

/** Reactiva: usa el `visto` del realtime si llegó, si no el del registro. */
export function enLinea(u: RecordModel | string): boolean {
  const id = typeof u === 'string' ? u : u.id;
  return enLineaSegun(vistos[id] ?? (typeof u === 'string' ? undefined : u.visto), reloj.ahora);
}

/** Arranca el latido, el realtime y el reloj. Devuelve la limpieza. */
export function iniciarPresencia(): () => void {
  const latir = () => pb.send('/api/latido', { method: 'POST', requestKey: null }).catch(() => {});
  void latir();
  const latido = setInterval(latir, LATIDO_MS);
  const tic = setInterval(() => (reloj.ahora = Date.now()), 15_000);
  const sub = pb.collection('users').subscribe('*', (e) => { vistos[e.record.id] = e.record.visto; });
  return () => {
    clearInterval(latido);
    clearInterval(tic);
    sub.then((f) => f()).catch(() => {});
  };
}

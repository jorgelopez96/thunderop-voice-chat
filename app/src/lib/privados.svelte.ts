import { pb } from './pb';
import { abrirLista } from './chat.svelte';

// Mensajes privados entre amigos. Lo leído se guarda en esta PC (`localStorage['dm.leido.' + yo]`: { amigo: created }).

/** Mensajes del otro posteriores a `leidoHasta` (fechas de PocketBase: se comparan como texto). */
export function contarNoLeidos(mensajes: { author: string; created: string }[], yo: string, leidoHasta: string | undefined): number {
  return mensajes.filter((m) => m.author !== yo && (!leidoHasta || m.created > leidoHasta)).length;
}

/** No leídos por amigo (id → cantidad). */
export const noLeidos = $state<Record<string, number>>({});

const yo = () => pb.authStore.record?.id ?? '';
const clave = () => 'dm.leido.' + yo();
function leidos(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(clave()) ?? '{}'); } catch { return {}; }
}

pb.authStore.onChange(() => {
  if (!pb.authStore.token) for (const k of Object.keys(noLeidos)) delete noLeidos[k];
});

/** Marca leído hasta `created` (el último mensaje visto) con ese amigo. */
export function marcarLeido(amigoId: string, created: string) {
  noLeidos[amigoId] = 0;
  const l = leidos();
  if (l[amigoId] && l[amigoId] >= created) return;
  l[amigoId] = created;
  try { localStorage.setItem(clave(), JSON.stringify(l)); } catch { /* bloqueado: dura esta sesión */ }
}

const filtroPar = (amigoId: string) =>
  pb.filter('(author = {:yo} && para = {:otro}) || (author = {:otro} && para = {:yo})', { yo: yo(), otro: amigoId });

export const abrirPrivado = (amigoId: string) => abrirLista('privados', filtroPar(amigoId));

export async function enviarPrivado(amigoId: string, texto: string, archivo?: File) {
  const d = new FormData();
  d.append('author', yo());
  d.append('para', amigoId);
  if (texto) d.append('text', texto);
  if (archivo) d.append('file', archivo);
  await pb.collection('privados').create(d);
}

export const borrarPrivado = (id: string) => pb.collection('privados').delete(id);

/** Cuenta los no leídos al entrar y los suma por realtime. Devuelve la limpieza. */
export function iniciarPrivados(): () => void {
  const recibidos = pb.filter('para = {:yo}', { yo: yo() });
  // ponytail: trae todos los recibidos (solo author y created) para contar; paginar si el historial crece mucho
  pb.collection('privados').getFullList<{ author: string; created: string }>({ filter: recibidos, fields: 'author,created', requestKey: null })
    .then((ms) => {
      const l = leidos();
      const por: Record<string, typeof ms> = {};
      for (const m of ms) (por[m.author] ??= []).push(m);
      for (const [a, lista] of Object.entries(por)) noLeidos[a] = contarNoLeidos(lista, yo(), l[a]);
    })
    .catch(() => {});
  // El chat abierto marca leído al mostrar el mensaje nuevo (Chat → alVer), que llega después de este evento.
  const sub = pb.collection('privados').subscribe('*', (e) => {
    if (e.action === 'create' && e.record.para === yo()) noLeidos[e.record.author] = (noLeidos[e.record.author] ?? 0) + 1;
  }, { filter: recibidos });
  return () => { sub.then((f) => f()).catch(() => {}); };
}

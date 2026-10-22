import { cargarApi } from './reproductor';

// Listas de reproducción de YouTube y YouTube Music: los videos los da la IFrame API (sin clave), hasta 200.
// Los mixes automáticos (RD…) y las listas privadas ("Me gusta", "Ver más tarde") no se pueden leer.
const HOSTS = ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com'];

/** Id de la lista del link, o null si no tiene una que se pueda leer. */
export function idDeLista(link: string): string | null {
  let u: URL;
  try { u = new URL(/^https?:\/\//i.test(link) ? link : `https://${link}`); } catch { return null; }
  if (!HOSTS.includes(u.hostname.toLowerCase())) return null;
  const id = u.searchParams.get('list') ?? '';
  return /^[A-Za-z0-9_-]{10,64}$/.test(id) && !/^(RD|LM$|WL$|LL$)/.test(id) ? id : null;
}

/** Ids de los videos de la lista, en orden. Usa un reproductor escondido aparte del que suena. */
export async function videosDeLista(lista: string): Promise<string[]> {
  const YT = await cargarApi();
  const caja = document.createElement('div');
  caja.style.cssText = 'position:fixed;left:-9999px;width:200px;height:113px';
  const div = document.createElement('div');
  caja.append(div); document.body.append(caja);
  try {
    return await new Promise<string[]>((ok, mal) => {
      const limite = setTimeout(() => mal(new Error('No se pudo leer la lista. ¿Es pública?')), 15_000);
      new YT.Player(div, {
        width: 200, height: 113,
        playerVars: { listType: 'playlist', list: lista, origin: location.origin },
        events: {
          onReady: (e: { target: { getPlaylist(): string[] | null } }) => {
            // La lista llega un rato después de onReady.
            const mirar = setInterval(() => {
              const ids = e.target.getPlaylist();
              if (ids?.length) { clearInterval(mirar); clearTimeout(limite); ok(ids); }
            }, 250);
            setTimeout(() => clearInterval(mirar), 15_000);
          },
          onError: () => { clearTimeout(limite); mal(new Error('No se pudo leer la lista. ¿Es pública?')); },
        },
      });
    });
  } finally { caja.remove(); }
}

/** Título por oEmbed (YouTube permite pedirlo desde la app); si falla, el genérico. */
async function titulo(id: string): Promise<string> {
  try {
    const r = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}&format=json`);
    const t = r.ok ? (await r.json()).title : '';
    return typeof t === 'string' && t.trim() ? t.trim().slice(0, 200) : 'Video de YouTube';
  } catch { return 'Video de YouTube'; }
}

/** Títulos de a 20 pedidos a la vez. */
export async function conTitulos(ids: string[]): Promise<{ videoId: string; titulo: string }[]> {
  const out: { videoId: string; titulo: string }[] = [];
  for (let i = 0; i < ids.length; i += 20) {
    const tanda = ids.slice(i, i + 20);
    const ts = await Promise.all(tanda.map(titulo));
    tanda.forEach((videoId, j) => out.push({ videoId, titulo: ts[j] }));
  }
  return out;
}

/** Fisher-Yates. */
export function mezclar<T>(xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

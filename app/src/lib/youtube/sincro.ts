// Lógica pura de YouTube juntos: qué link sirve y cuándo un reproductor se fue de la posición compartida.
// El servidor valida igual (youtube.pb.js); esto es para avisar el error sin ir y volver.

const HOSTS = ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com'];
const ID = /^[A-Za-z0-9_-]{11}$/;

/** Id del video del link (watch, youtu.be, shorts, live, embed), o null si no es un video de YouTube. */
export function idDeVideo(link: string): string | null {
  let u: URL;
  try { u = new URL(/^https?:\/\//i.test(link) ? link : `https://${link}`); } catch { return null; }
  const host = u.hostname.toLowerCase();
  let id: string | null = null;
  if (host === 'youtu.be') id = u.pathname.slice(1);
  else if (HOSTS.includes(host)) {
    if (u.pathname === '/watch') id = u.searchParams.get('v');
    else id = /^\/(?:shorts|live|embed)\/([^/]+)/.exec(u.pathname)?.[1] ?? null;
  }
  return id && ID.test(id) ? id : null;
}

/** Sonando se tolera 2 s de diferencia (corregir rebobina y corta); en pausa, todos en el mismo cuadro. */
export function desviado(localS: number, compartidaS: number, pausado: boolean): boolean {
  return Math.abs(localS - compartidaS) > (pausado ? 0.5 : 2);
}

export const mmss = (s: number) => {
  s = Math.max(0, Math.floor(s));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
};

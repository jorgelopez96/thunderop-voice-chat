import { isTauri } from '@tauri-apps/api/core';

// Links en el texto de los mensajes: se cortan en pedazos para mostrarlos clicables, y se abren en el navegador.
const URL_RE = /https?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]]/gi;

/** El texto en pedazos: los que tienen `url` son links. */
export function partirEnLinks(texto: string): { texto: string; url?: string }[] {
  const out: { texto: string; url?: string }[] = [];
  let desde = 0;
  for (const m of texto.matchAll(URL_RE)) {
    if (m.index > desde) out.push({ texto: texto.slice(desde, m.index) });
    out.push({ texto: m[0], url: m[0] });
    desde = m.index + m[0].length;
  }
  if (desde < texto.length) out.push({ texto: texto.slice(desde) });
  return out;
}

/** Primer link https del texto (el que lleva vista previa). */
export const primerLink = (texto: string) => partirEnLinks(texto).find((p) => p.url?.startsWith('https://'))?.url;

/** En la app, el navegador de la PC (dentro del WebView no se puede navegar afuera). */
export async function abrirLink(url: string) {
  if (!/^https?:\/\//i.test(url)) return;
  if (!isTauri()) { window.open(url, '_blank', 'noopener,noreferrer'); return; }
  const { openUrl } = await import('@tauri-apps/plugin-opener');
  await openUrl(url);
}

/** El mensaje es solo un GIF de GIPHY (así se mandan desde el selector): se muestra como imagen. */
export const esGif = (texto: string) => /^https:\/\/media\d*\.giphy\.com\/media\/[^\s]+\.(gif|webp)(\?[^\s]*)?$/.test(texto.trim());

// Emojis del selector: los datos (emojisDatos.ts, generado por scripts/generar-emojis.mjs) se cargan recién al abrirlo.

export type Emoji = { e: string; nombre: string; tono: boolean; version: string; n: string; t: string };

/** Tonos de piel: el primero es el amarillo de siempre. */
export const TONOS = ['', '\u{1F3FB}', '\u{1F3FC}', '\u{1F3FD}', '\u{1F3FE}', '\u{1F3FF}'];
export const NOMBRES_TONO = ['predeterminado', 'claro', 'claro medio', 'medio', 'oscuro medio', 'oscuro'];

/** Minúsculas, sin tildes y solo letras/números separados por un espacio. */
export const normalizar = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/** Le pone el tono a cada persona/mano del emoji (solo vale para los marcados con `tono`). */
export const conTono = (e: string, tono: string) => (tono ? e.replace(/(\p{Emoji_Modifier_Base})\u{FE0F}?/gu, `$1${tono}`) : e);

/** Lee una categoría de emojisDatos: una línea "EMOJI[~][@versión] nombre|claves". */
export function leerCategoria(texto: string): Emoji[] {
  return texto.split('\n').map((linea) => {
    const sp = linea.indexOf(' '), barra = linea.indexOf('|', sp);
    const [, e, tono, version = ''] = /^(.+?)(~)?(?:@([\d.]+))?$/u.exec(linea.slice(0, sp))!;
    const nombre = linea.slice(sp + 1, barra), n = ` ${normalizar(nombre)}`;
    return { e, nombre, tono: !!tono, version, n, t: `${n} ${linea.slice(barra + 1)}` };
  });
}

/** Los que tienen cada palabra buscada al comienzo de alguna palabra suya; primero los que la tienen en el nombre. */
export function buscar(lista: Emoji[], consulta: string): Emoji[] {
  const palabras = normalizar(consulta).split(' ').filter(Boolean).map((p) => ` ${p}`);
  if (!palabras.length) return [];
  const enNombre: Emoji[] = [], resto: Emoji[] = [];
  for (const x of lista) if (palabras.every((p) => x.t.includes(p))) (palabras.every((p) => x.n.includes(p)) ? enNombre : resto).push(x);
  return enNombre.concat(resto);
}

const CLAVE_RECIENTES = 'dm.emojis.recientes', CLAVE_TONO = 'dm.emojis.tono';
export const MAX_RECIENTES = 27; // tres filas

/** El elegido pasa adelante, sin repetirse. */
export const agregarReciente = (lista: string[], emoji: string) => [emoji, ...lista.filter((e) => e !== emoji)].slice(0, MAX_RECIENTES);

export function leerRecientes(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(CLAVE_RECIENTES) ?? '[]');
    return Array.isArray(v) ? v.filter((e) => typeof e === 'string').slice(0, MAX_RECIENTES) : [];
  } catch { return []; }
}
export const guardarRecientes = (lista: string[]) => { try { localStorage.setItem(CLAVE_RECIENTES, JSON.stringify(lista)); } catch { /* sin almacenamiento */ } };

export function leerTono(): number {
  try { const t = Number(localStorage.getItem(CLAVE_TONO)); return t >= 0 && t < TONOS.length ? Math.floor(t) : 0; } catch { return 0; }
}
export const guardarTono = (t: number) => { try { localStorage.setItem(CLAVE_TONO, String(t)); } catch { /* sin almacenamiento */ } };

/** Flechas en la grilla: [sección, índice] siguiente. `largos` = cuántos hay en cada sección; cada sección arranca fila nueva. */
export function mover(largos: number[], [s, i]: [number, number], tecla: string, columnas: number): [number, number] {
  const col = i % columnas, ultimaFila = (n: number) => Math.floor((n - 1) / columnas) * columnas;
  switch (tecla) {
    case 'ArrowRight': return i + 1 < largos[s] ? [s, i + 1] : s + 1 < largos.length ? [s + 1, 0] : [s, i];
    case 'ArrowLeft': return i > 0 ? [s, i - 1] : s > 0 ? [s - 1, largos[s - 1] - 1] : [s, i];
    case 'ArrowDown':
      if (i + columnas < largos[s]) return [s, i + columnas];
      if (i < ultimaFila(largos[s])) return [s, largos[s] - 1]; // fila de abajo incompleta
      return s + 1 < largos.length ? [s + 1, Math.min(col, largos[s + 1] - 1)] : [s, i];
    case 'ArrowUp':
      if (i >= columnas) return [s, i - columnas];
      return s > 0 ? [s - 1, Math.min(ultimaFila(largos[s - 1]) + col, largos[s - 1] - 1)] : [s, i];
    case 'Home': return [s, 0];
    case 'End': return [s, largos[s] - 1];
  }
  return [s, i];
}

// Se ve si es a color y ocupa como un solo emoji (si no, es un cuadradito o una secuencia que el sistema dibuja por partes).
function seDibuja(ctx: CanvasRenderingContext2D, emoji: string, ancho: number): boolean {
  ctx.clearRect(0, 0, 32, 32);
  ctx.fillText(emoji, 0, 0);
  if (ctx.measureText(emoji).width > ancho * 1.25) return false; // dos letras de bandera sueltas miden ~1,45 emojis
  const d = ctx.getImageData(0, 0, 32, 32).data;
  for (let k = 0; k < d.length; k += 4) if (d[k + 3] && (d[k] !== d[k + 1] || d[k + 1] !== d[k + 2])) return true;
  return false;
}

/** Si el sistema sabe dibujar un emoji. Sin canvas, se asume que sí. */
function dibujante(): (emoji: string) => boolean {
  const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  if (!ctx) return () => true;
  ctx.canvas.width = ctx.canvas.height = 32;
  ctx.font = '24px Banderas, sans-serif';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#000';
  const ancho = ctx.measureText('\u{1F600}').width;
  return (emoji) => seDibuja(ctx, emoji, ancho);
}

let cargando: Promise<Emoji[][]> | undefined;
/** Las 9 categorías, sin los emojis que este sistema mostraría rotos. Una sola vez por sesión. */
export const cargarEmojis = () => (cargando ??= Promise.all([import('./emojisDatos'), document.fonts?.load('24px Banderas', '🇦🇷').catch(() => {})]).then(([{ CATEGORIAS, VERSIONES }]) => {
  // Las banderas las pone la fuente Banderas de app.css y se prueban una por una: a la fuente le faltan las más
  // nuevas (Sark) y, si no cargó, Windows mostraría las dos letras.
  const seVe = dibujante();
  const ok = new Set(Object.keys(VERSIONES).filter((v) => seVe(VERSIONES[v])));
  const bandera = /^\p{RI}|\u{E007F}/u;
  return CATEGORIAS.map((c) => leerCategoria(c).filter((x) => (!x.version || ok.has(x.version)) && (!bandera.test(x.e) || seVe(x.e))));
}));

/** Sin tono ni FE0F: para encontrar un reciente (guardado con su tono) entre los emojis base. */
export const sinTono = (e: string) => e.replace(/[\u{1F3FB}-\u{1F3FF}\u{FE0F}]/gu, '');

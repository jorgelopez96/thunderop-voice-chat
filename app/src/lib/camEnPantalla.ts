// Dónde va la cámara sobre la pantalla en "Pantalla + cámara": el atributo `camEnPantalla` de quien transmite, "x,y,w"
// en fracciones de la pantalla (esquina de arriba a la izquierda y ancho). Vacío: la transmisión va sin cámara.
// La cámara se toma 16:9, como la pantalla: su alto en fracción es el mismo que su ancho.

export type Cam = { x: number; y: number; w: number };
export const POR_DEFECTO: Cam = { x: 0.73, y: 0.71, w: 0.25 };
const MIN = 0.15, MAX = 0.45;
const acotar = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/** Acota el ancho y deja la ventanita adentro de la pantalla. */
export function ajustar({ x, y, w }: Cam): Cam {
  const ancho = acotar(w, MIN, MAX);
  return { x: acotar(x, 0, 1 - ancho), y: acotar(y, 0, 1 - ancho), w: ancho };
}

export function leerCam(s: string | undefined): Cam | null {
  if (!s) return null;
  const n = s.split(',').map(Number);
  if (n.length !== 3 || n.some((v) => !Number.isFinite(v))) return POR_DEFECTO;
  return ajustar({ x: n[0], y: n[1], w: n[2] });
}

export const escribirCam = (c: Cam) => [c.x, c.y, c.w].map((v) => +v.toFixed(3)).join(',');

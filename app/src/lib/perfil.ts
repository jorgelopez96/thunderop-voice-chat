// Datos de la tarjeta de perfil: redes (se guarda el usuario, el link se arma acá) y cumpleaños (MM-DD, sin año).
export const REDES = [
  ['instagram', 'Instagram', (u: string) => `https://www.instagram.com/${encodeURIComponent(u)}`],
  ['youtube', 'YouTube', (u: string) => `https://www.youtube.com/@${encodeURIComponent(u)}`],
  ['twitch', 'Twitch', (u: string) => `https://www.twitch.tv/${encodeURIComponent(u)}`],
  ['steam', 'Steam', (u: string) => `https://steamcommunity.com/id/${encodeURIComponent(u)}`],
] as const;
export type Red = (typeof REDES)[number][0];
export type Redes = Partial<Record<Red, string>>;

/** Lo que pega la gente ("@osidis", "instagram.com/osidis/") → "osidis"; lo que no sirve se descarta. */
export function usuarioDeRed(texto: string) {
  const u = texto.trim().replace(/\/+$/, '').split('/').pop()!.replace(/^@/, '');
  return /^[A-Za-z0-9._-]{0,40}$/.test(u) ? u : '';
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
/** "03-14" → "14 de marzo". */
export function cumpleTexto(mmdd: string) {
  const [m, d] = mmdd.split('-').map(Number);
  return MESES[m - 1] && d ? `${d} de ${MESES[m - 1]}` : '';
}

/** "2026-10-19 12:00:00.000Z" → "oct. 2026". */
export const desdeCuando = (creado: string) =>
  creado ? new Date(creado.replace(' ', 'T')).toLocaleDateString('es', { month: 'short', year: 'numeric' }) : '';

/** Colores para el nombre (el primero es el de siempre: sin color). */
export const COLORES = ['', '#b9b0ff', '#4fb8d8', '#5bc77a', '#e5b84b', '#f0884f', '#e25c6f', '#c96fc9'];

import type { RecordModel } from 'pocketbase';
import { pb } from './pb';

/** Avatar de letra: la inicial del nombre sobre un color que sale del nombre (siempre el mismo para cada uno). */
export function avatarDeLetra(nombre: string): string {
  const n = nombre.trim() || '?';
  const tono = [...n].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
  const letra = [...n][0].toUpperCase().replace(/[<&>"']/g, '?');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="hsl(${tono} 45% 42%)"/>`
    + `<text x="32" y="32" dy=".35em" text-anchor="middle" font-family="Inter, Segoe UI, sans-serif" font-size="30" font-weight="700" fill="#fff">${letra}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** Foto de perfil de un usuario; sin foto, la inicial de su nombre. Los grupos no la usan. */
export const foto = (u: RecordModel | null | undefined, thumb = '64x64') =>
  u?.avatar ? pb.files.getURL(u, u.avatar, { thumb }) : avatarDeLetra(u?.name ?? '');

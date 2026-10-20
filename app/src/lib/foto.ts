import type { RecordModel } from 'pocketbase';
import { pb } from './pb';
import porDefecto from './assets/avatar-default.jpg';

/** Foto de perfil de un usuario; sin foto (o sin usuario), la de Thunderop por defecto. Los grupos no la usan. */
export const foto = (u: RecordModel | null | undefined, thumb = '64x64') =>
  u?.avatar ? pb.files.getURL(u, u.avatar, { thumb }) : porDefecto;

export const MAX_BYTES = 25 * 1024 * 1024;
export const MAX_VIDEO_S = 60;
export const TIPOS = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'video/mp4', 'video/webm'] as const;
export type Validacion = { ok: true } | { ok: false; motivo: string };

export function validarAdjunto(f: { type: string; size: number }, duracionS?: number): Validacion {
  if (!(TIPOS as readonly string[]).includes(f.type)) return { ok: false, motivo: 'Solo se permiten imágenes y videos cortos.' };
  if (f.size > MAX_BYTES) return { ok: false, motivo: 'El archivo supera los 25 MB.' };
  if (f.type.startsWith('video/')) {
    if (duracionS === undefined || !Number.isFinite(duracionS)) return { ok: false, motivo: 'No se pudo leer la duración del video.' };
    if (duracionS > MAX_VIDEO_S) return { ok: false, motivo: 'El video supera los 60 segundos.' };
  }
  return { ok: true };
}

export function duracionVideo(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video');
    const url = URL.createObjectURL(file);
    v.preload = 'metadata';
    v.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(v.duration); };
    v.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo leer el video.')); };
    v.src = url;
  });
}

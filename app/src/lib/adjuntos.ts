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

/** Duración en segundos; NaN si no se pudo leer (timeout 5 s). MediaRecorder/webm reporta Infinity: se fuerza el cálculo buscando al final. */
export function duracionVideo(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video');
    const url = URL.createObjectURL(file);
    const fin = (r: () => void) => { clearTimeout(t); URL.revokeObjectURL(url); r(); };
    const t = setTimeout(() => fin(() => resolve(NaN)), 5000);
    v.preload = 'metadata';
    v.onloadedmetadata = () => {
      if (v.duration !== Infinity) return fin(() => resolve(v.duration));
      v.ondurationchange = () => {
        if (v.duration === Infinity) return;
        const d = v.duration; v.currentTime = 0;
        fin(() => resolve(d));
      };
      v.currentTime = 1e101;
    };
    v.onerror = () => fin(() => reject(new Error('No se pudo leer el video.')));
    v.src = url;
  });
}

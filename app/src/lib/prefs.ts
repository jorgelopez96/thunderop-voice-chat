// Preferencias locales de voz (dispositivos, supresión, volúmenes por usuario, transmisión) en `localStorage['dm.voz']`.
export type Calidad = '720p30' | '720p60' | '1080p30' | '1080p60';
// Límites de transmisión de pantalla (Global Constraints de la etapa 4).
export const CALIDADES: Record<Calidad, { ancho: number; alto: number; fps: number; mbps: number }> = {
  '720p30': { ancho: 1280, alto: 720, fps: 30, mbps: 3 },
  '720p60': { ancho: 1280, alto: 720, fps: 60, mbps: 5 },
  '1080p30': { ancho: 1920, alto: 1080, fps: 30, mbps: 8 },
  '1080p60': { ancho: 1920, alto: 1080, fps: 60, mbps: 12 },
};
export type PrefsVoz = { entrada?: string; salida?: string; supresion: boolean; volumenes: Record<string, number>; calidad: Calidad; gpu: boolean };

const CLAVE = 'dm.voz';
const DEFAULTS: PrefsVoz = { supresion: false, volumenes: {}, calidad: '1080p60', gpu: true };

export function leerPrefs(): PrefsVoz {
  try {
    const p = JSON.parse(localStorage.getItem(CLAVE) ?? '{}');
    const texto = (v: unknown) => (typeof v === 'string' ? v : undefined);
    const volumenes = Object.fromEntries(Object.entries(p.volumenes ?? {}).filter(([, v]) => typeof v === 'number')) as Record<string, number>;
    const calidad = (Object.keys(CALIDADES) as Calidad[]).find((c) => c === p.calidad) ?? DEFAULTS.calidad;
    return { entrada: texto(p.entrada), salida: texto(p.salida), supresion: p.supresion === true, volumenes, calidad, gpu: p.gpu !== false };
  } catch { return { ...DEFAULTS, volumenes: {} }; }
}

export function guardarPrefs(p: Partial<PrefsVoz>): void {
  const actual = leerPrefs();
  try { localStorage.setItem(CLAVE, JSON.stringify({ ...actual, ...p, volumenes: { ...actual.volumenes, ...p.volumenes } })); }
  catch { /* almacenamiento bloqueado: la preferencia dura solo esta sesión */ }
}

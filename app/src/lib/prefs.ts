// Preferencias locales de voz (dispositivos, supresión, ganancia, volúmenes por usuario, transmisión) en `localStorage['dm.voz']`.
export type Calidad = '720p30' | '720p60' | '1080p30' | '1080p60';
// Límites de transmisión de pantalla (Global Constraints de la etapa 4).
// Tope alto a propósito (prueba 2026-10-20): el límite real lo pone la conexión de cada uno. Sin maxBitrate, LiveKit usaría su preset bajo.
export const CALIDADES: Record<Calidad, { ancho: number; alto: number; fps: number; mbps: number }> = {
  '720p30': { ancho: 1280, alto: 720, fps: 30, mbps: 50 },
  '720p60': { ancho: 1280, alto: 720, fps: 60, mbps: 50 },
  '1080p30': { ancho: 1920, alto: 1080, fps: 30, mbps: 50 },
  '1080p60': { ancho: 1920, alto: 1080, fps: 60, mbps: 50 },
};
export type PrefsVoz = { entrada?: string; salida?: string; supresion: boolean; volumenes: Record<string, number>; calidad: Calidad; gpu: boolean; vistaPrevia: boolean; volBotonera: number; volMusica: number; gananciaDb: number; sonidoMensajes: boolean; notificaciones: boolean; verVarias: number };

const CLAVE = 'dm.voz';
// Versión del formato: lo guardado antes de la 2 tenía la supresión apagada por defecto; se reenciende una vez.
// Antes de la 3, los volúmenes eran la ganancia directa; ahora la ganancia es el doble (ver voz.svelte.ts): se dividen a la mitad.
const VERSION = 3;
const DEFAULTS: PrefsVoz = { supresion: true, volumenes: {}, calidad: '1080p60', gpu: true, vistaPrevia: true, volBotonera: 0.8, volMusica: 50, gananciaDb: 0, sonidoMensajes: true, notificaciones: true, verVarias: 1 };

export function leerPrefs(): PrefsVoz {
  try {
    const p = JSON.parse(localStorage.getItem(CLAVE) ?? '{}');
    const texto = (v: unknown) => (typeof v === 'string' ? v : undefined);
    const viejos = !(p.v >= 3);
    const volumenes = Object.fromEntries(Object.entries(p.volumenes ?? {}).filter(([, v]) => typeof v === 'number')
      .map(([k, v]) => [k, viejos ? (v as number) / 2 : v])) as Record<string, number>;
    const calidad = (Object.keys(CALIDADES) as Calidad[]).find((c) => c === p.calidad) ?? DEFAULTS.calidad;
    const rango = (v: unknown, max: number, def: number) => (typeof v === 'number' && v >= 0 && v <= max ? v : def); // NaN falla la comparación
    return { entrada: texto(p.entrada), salida: texto(p.salida), supresion: p.v >= 2 ? p.supresion === true : true, volumenes, calidad, gpu: p.gpu !== false, vistaPrevia: p.vistaPrevia !== false,
      volBotonera: rango(p.volBotonera, 1, DEFAULTS.volBotonera), volMusica: rango(p.volMusica, 100, DEFAULTS.volMusica),
      sonidoMensajes: p.sonidoMensajes !== false, notificaciones: p.notificaciones !== false, verVarias: [1, 2, 3].includes(p.verVarias) ? p.verVarias : 1,
      gananciaDb: typeof p.gananciaDb === 'number' && p.gananciaDb >= -20 && p.gananciaDb <= 20 ? p.gananciaDb : DEFAULTS.gananciaDb };
  } catch { return { ...DEFAULTS, volumenes: {} }; }
}

export function guardarPrefs(p: Partial<PrefsVoz>): void {
  const actual = leerPrefs();
  try { localStorage.setItem(CLAVE, JSON.stringify({ ...actual, ...p, v: VERSION, volumenes: { ...actual.volumenes, ...p.volumenes } })); }
  catch { /* almacenamiento bloqueado: la preferencia dura solo esta sesión */ }
}

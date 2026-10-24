// Preferencias locales de voz (dispositivos, supresión, ganancia, volúmenes por usuario, transmisión) en `localStorage['dm.voz']`.
export type Calidad = '720p30' | '720p60' | '1080p30' | '1080p60';
// Límites de la transmisión de pantalla. `mbps`: tope del transmisor nativo (prueba 2026-10-23: 1080p60 a 20 Mbps se vio fluido).
export const CALIDADES: Record<Calidad, { alto: number; fps: number; mbps: number }> = {
  '720p30': { alto: 720, fps: 30, mbps: 6 },
  '720p60': { alto: 720, fps: 60, mbps: 10 },
  '1080p30': { alto: 1080, fps: 30, mbps: 12 },
  '1080p60': { alto: 1080, fps: 60, mbps: 20 },
};
export type PrefsVoz = { entrada?: string; salida?: string; supresion: boolean; volumenes: Record<string, number>; calidad: Calidad; vistaPrevia: boolean; volBotonera: number; volMusica: number; gananciaDb: number; sonidoMensajes: boolean; notificaciones: boolean;
  avisoMensajes: boolean; avisoMenciones: boolean; hora24: boolean };

const CLAVE = 'dm.voz';
// Versión del formato: lo guardado antes de la 2 tenía la supresión apagada por defecto; se reenciende una vez.
// Antes de la 3, los volúmenes eran la ganancia directa; ahora la ganancia es el doble (ver voz.svelte.ts): se dividen a la mitad.
const VERSION = 3;
const DEFAULTS: PrefsVoz = { supresion: true, volumenes: {}, calidad: '1080p60', vistaPrevia: true, volBotonera: 0.8, volMusica: 50, gananciaDb: 0, sonidoMensajes: true, notificaciones: true, avisoMensajes: true, avisoMenciones: true, hora24: true };

export function leerPrefs(): PrefsVoz {
  try {
    const p = JSON.parse(localStorage.getItem(CLAVE) ?? '{}');
    const texto = (v: unknown) => (typeof v === 'string' ? v : undefined);
    const viejos = !(p.v >= 3);
    const volumenes = Object.fromEntries(Object.entries(p.volumenes ?? {}).filter(([, v]) => typeof v === 'number')
      .map(([k, v]) => [k, viejos ? (v as number) / 2 : v])) as Record<string, number>;
    const calidad = (Object.keys(CALIDADES) as Calidad[]).find((c) => c === p.calidad) ?? DEFAULTS.calidad;
    const rango = (v: unknown, max: number, def: number) => (typeof v === 'number' && v >= 0 && v <= max ? v : def); // NaN falla la comparación
    return { entrada: texto(p.entrada), salida: texto(p.salida), supresion: p.v >= 2 ? p.supresion === true : true, volumenes, calidad, vistaPrevia: p.vistaPrevia !== false,
      volBotonera: rango(p.volBotonera, 1, DEFAULTS.volBotonera), volMusica: rango(p.volMusica, 100, DEFAULTS.volMusica),
      sonidoMensajes: p.sonidoMensajes !== false, notificaciones: p.notificaciones !== false,
      avisoMensajes: p.avisoMensajes !== false, avisoMenciones: p.avisoMenciones !== false, hora24: p.hora24 !== false,
      gananciaDb: typeof p.gananciaDb === 'number' && p.gananciaDb >= -20 && p.gananciaDb <= 20 ? p.gananciaDb : DEFAULTS.gananciaDb };
  } catch { return { ...DEFAULTS, volumenes: {} }; }
}

export function guardarPrefs(p: Partial<PrefsVoz>): void {
  const actual = leerPrefs();
  try { localStorage.setItem(CLAVE, JSON.stringify({ ...actual, ...p, v: VERSION, volumenes: { ...actual.volumenes, ...p.volumenes } })); }
  catch { /* almacenamiento bloqueado: la preferencia dura solo esta sesión */ }
}

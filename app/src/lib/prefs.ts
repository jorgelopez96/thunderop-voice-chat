// Preferencias locales de voz (dispositivos, supresión, volúmenes por usuario) en `localStorage['dm.voz']`.
export type PrefsVoz = { entrada?: string; salida?: string; supresion: boolean; volumenes: Record<string, number> };

const CLAVE = 'dm.voz';

export function leerPrefs(): PrefsVoz {
  try {
    const p = JSON.parse(localStorage.getItem(CLAVE) ?? '{}');
    const texto = (v: unknown) => (typeof v === 'string' ? v : undefined);
    const volumenes = Object.fromEntries(Object.entries(p.volumenes ?? {}).filter(([, v]) => typeof v === 'number'));
    return { entrada: texto(p.entrada), salida: texto(p.salida), supresion: p.supresion === true, volumenes } as PrefsVoz;
  } catch { return { supresion: false, volumenes: {} }; }
}

export function guardarPrefs(p: Partial<PrefsVoz>): void {
  const actual = leerPrefs();
  try { localStorage.setItem(CLAVE, JSON.stringify({ ...actual, ...p, volumenes: { ...actual.volumenes, ...p.volumenes } })); }
  catch { /* almacenamiento bloqueado: la preferencia dura solo esta sesión */ }
}

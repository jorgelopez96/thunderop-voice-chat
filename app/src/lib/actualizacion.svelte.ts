import { isTauri } from '@tauri-apps/api/core';

// Al abrir, si el servidor tiene una versión nueva se descarga e instala antes de dejar entrar
// (Windows cierra la app y la reabre). Si algo falla, se avisa y se deja entrar igual.
// `silenciosa` (el chequeo periódico, con la app ya abierta): sin pantalla de "buscando" y si falla sigue como estaba.
export const actualizacion = $state<{ estado: 'buscando' | 'descargando' | 'error' | 'lista'; version: string; progreso: number; error: string }>({
  estado: 'buscando', version: '', progreso: 0, error: '',
});

/** Fracción descargada, 0..1. Sin total conocido → 0. */
export function progresoDe(bajado: number, total: number | undefined): number {
  if (!total) return 0;
  return Math.min(1, Math.max(0, bajado / total));
}

export async function buscarActualizacion(silenciosa = false) {
  if (import.meta.env.DEV || !isTauri()) { actualizacion.estado = 'lista'; return; }
  try {
    const { check } = await import('@tauri-apps/plugin-updater');
    const u = await check();
    if (!u) { if (!silenciosa) actualizacion.estado = 'lista'; return; }
    Object.assign(actualizacion, { estado: 'descargando', version: u.version, progreso: 0 });
    let total: number | undefined, bajado = 0;
    await u.downloadAndInstall((e) => {
      if (e.event === 'Started') total = e.data.contentLength;
      else if (e.event === 'Progress') { bajado += e.data.chunkLength; actualizacion.progreso = progresoDe(bajado, total); }
      else actualizacion.progreso = 1;
    });
  } catch (e) {
    console.error(e);
    if (silenciosa) { actualizacion.estado = 'lista'; return; }
    Object.assign(actualizacion, { estado: 'error', error: 'No se pudo actualizar. Podés entrar igual y se va a reintentar la próxima vez.' });
  }
}

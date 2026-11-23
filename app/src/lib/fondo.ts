import type { LocalVideoTrack } from 'livekit-client';
import { BackgroundProcessor, supportsBackgroundProcessors, type BackgroundProcessorWrapper } from '@livekit/track-processors';
import type { FondoCam } from './prefs';

// Fondo difuminado de la cámara propia: MediaPipe recorta a la persona y el resto se difumina en la GPU.
// El modelo y el wasm vienen con la app (static/fondo/): la imagen de la cámara no pasa por ningún servicio externo.
// track-processors difumina la imagen achicada 4 veces (divide el radio por 4) y corta en 16: 64 es lo más fuerte que da.
// Con 25 (quedaba en 6) el fondo se seguía viendo.
export const RADIO: Record<Exclude<FondoCam, 'no'>, number> = { suave: 24, fuerte: 64 };

export const fondoDisponible = (): boolean => { try { return supportsBackgroundProcessors(); } catch { return false; } };

const procesadores = new WeakMap<LocalVideoTrack, { p: BackgroundProcessorWrapper; cuadros: number; modo: FondoCam }>();

/** Cuadros que pasaron por el procesador de `t` (0 si no tiene). */
export const cuadrosProcesados = (t: LocalVideoTrack | undefined) => (t && procesadores.get(t)?.cuadros) || 0;
/** El fondo que tiene puesto `t` ahora ('no' si no tiene procesador). */
export const fondoAplicado = (t: LocalVideoTrack): FondoCam => procesadores.get(t)?.modo ?? 'no';

/** Pone el fondo `f` en la pista. Una vez puesto el procesador no se saca (para "Sin efecto" se apaga): sacarlo y
 *  volverlo a poner hace parpadear el video. `alProcesar` corre en cada cuadro procesado. */
export async function aplicarFondo(t: LocalVideoTrack, f: FondoCam, alProcesar?: () => void): Promise<void> {
  if (!fondoDisponible()) return;
  const hay = procesadores.get(t);
  if (hay) {
    await hay.p.switchTo(f === 'no' ? { mode: 'disabled' } : { mode: 'background-blur', blurRadius: RADIO[f] });
    hay.modo = f;
    return;
  }
  if (f === 'no') return;
  const estado = { p: undefined as unknown as BackgroundProcessorWrapper, cuadros: 0, modo: f };
  estado.p = BackgroundProcessor({
    mode: 'background-blur', blurRadius: RADIO[f],
    assetPaths: { tasksVisionFileSet: '/fondo', modelAssetPath: '/fondo/selfie_segmenter.tflite' },
    onFrameProcessed: () => { estado.cuadros++; alProcesar?.(); },
  });
  procesadores.set(t, estado);
  try { await t.setProcessor(estado.p); }
  catch (e) { procesadores.delete(t); throw e; }
}

/** Saca el procesador (antes de frenar la pista, así se liberan la GPU y el canvas). */
export async function quitarFondo(t: LocalVideoTrack): Promise<void> {
  if (!procesadores.has(t)) return;
  procesadores.delete(t);
  await t.stopProcessor().catch(() => {});
}

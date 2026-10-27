import { isTauri } from '@tauri-apps/api/core';

// Pantalla completa de las transmisiones: va la página entera (<html>) y la transmisión se agranda con CSS (`.completa`).
// Con la transmisión misma en pantalla completa, todo lo demás (la barrita de la llamada, sus menús) quedaba debajo y
// no recibía clics. En la app, Tauri ya lleva la ventana a pantalla completa solo; si estaba maximizada se restaura
// antes (maximizada y sin bordes, Windows le deja el lugar de la barra de tareas: franja negra) y se vuelve a
// maximizar al salir. La sombra de la ventana se apaga mientras dura.
export const completa = $state<{ sid: string | null }>({ sid: null }); // la transmisión agrandada, o 'todas'
let estabaMax = false;

const ventana = async () => (await import('@tauri-apps/api/window')).getCurrentWindow();

async function devolverVentana() {
  if (!isTauri()) return;
  try {
    const w = await ventana();
    await w.setShadow(true);
    if (estabaMax) await w.maximize();
  } catch { /* la ventana se está cerrando */ }
  estabaMax = false;
}

export async function entrarPantallaCompleta(sid: string) {
  if (isTauri()) {
    try {
      const w = await ventana();
      estabaMax = await w.isMaximized();
      if (estabaMax) await w.unmaximize();
      await w.setShadow(false);
    } catch { /* sigue la del navegador sola */ }
  }
  try {
    await document.documentElement.requestFullscreen();
    completa.sid = sid;
  } catch { void devolverVentana(); }
}

export const salirPantallaCompleta = () => document.exitFullscreen().catch(() => {});

// Se sale también con Esc o al dejar de mirar: se vuelve todo a como estaba.
if (typeof document !== 'undefined') {
  document.addEventListener('fullscreenchange', () => {
    if (document.fullscreenElement || completa.sid === null) return;
    completa.sid = null;
    void devolverVentana();
  });
}

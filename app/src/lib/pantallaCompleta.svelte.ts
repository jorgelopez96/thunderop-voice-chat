import { isTauri } from '@tauri-apps/api/core';

// Pantalla completa de las transmisiones: va la página entera (<html>) y la transmisión se agranda con CSS (`.completa`).
// Con la transmisión misma en pantalla completa, todo lo demás (la barrita de la llamada, sus menús) quedaba debajo y
// no recibía clics. En la app, Tauri ya lleva la ventana a pantalla completa solo; si estaba maximizada se restaura
// antes (maximizada y sin bordes, Windows le deja el lugar de la barra de tareas: franja negra) y se vuelve a
// maximizar al salir. La sombra de la ventana se apaga mientras dura.
export const completa = $state<{ sid: string | null }>({ sid: null }); // la transmisión agrandada, o 'todas'
let estabaMax = false;

const ventana = async () => (await import('@tauri-apps/api/window')).getCurrentWindow();

// Telón: en la app, entrar y salir son dos saltos de la ventana (des-maximizar y pantalla completa, o al revés) y se
// veía achicarse y agrandarse de golpe. Mientras salta, un negro la tapa con un fundido corto (.telon en app.css).
let telonEl: HTMLDivElement | null = null;
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function bajarTelon(fundido = true) {
  if (!isTauri()) return;
  const t = (telonEl ??= Object.assign(document.createElement('div'), { className: 'telon' }));
  document.body.append(t);
  if (!fundido) t.style.transitionDuration = '0ms';
  void t.getBoundingClientRect(); // que arranque transparente y el fundido se vea
  t.classList.add('bajo');
  if (fundido) await esperar(130);
  t.style.transitionDuration = '';
}
function subirTelon() {
  const t = telonEl;
  if (!t) return;
  // Un toque después del último salto, para que la ventana ya esté en su tamaño final.
  setTimeout(() => { t.classList.remove('bajo'); setTimeout(() => { if (!t.classList.contains('bajo')) t.remove(); }, 250); }, 140);
}

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
  await bajarTelon();
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
  subirTelon();
}

export async function salirPantallaCompleta() {
  await bajarTelon();
  await document.exitFullscreen().catch(() => {});
}

// Se sale también con Esc o al dejar de mirar: se vuelve todo a como estaba.
if (typeof document !== 'undefined') {
  document.addEventListener('fullscreenchange', () => {
    if (document.fullscreenElement || completa.sid === null) return;
    completa.sid = null;
    // Con Esc el navegador ya salió: el telón cae de golpe para tapar el maximizar.
    void bajarTelon(false).then(devolverVentana).then(subirTelon);
  });
}

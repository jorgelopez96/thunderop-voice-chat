import { esEscritorio } from './plataforma.svelte';
import { atencion, silenciadoHasta } from './notificaciones.svelte';
import { noLeidos as deSalas } from './noLeidos.svelte';
import { noLeidos as dePrivados } from './privados.svelte';
import { contarSinLeer, textoGlobito } from './reglasAviso';

// Mensaje nuevo con la ventana sin foco: en el escritorio titila el ícono de la barra de tareas y le pone un globito con
// los sin leer (en Windows `setBadgeCount` no anda: va un ícono superpuesto); en la web, el número en el título.
// Al volver a la app se limpia todo.

const ventana = async () => (await import('@tauri-apps/api/window')).getCurrentWindow();

// Un ícono por texto posible ('1'…'9', '9+'): se dibujan una vez.
const iconos = new Map<string, Promise<import('@tauri-apps/api/image').Image>>();
function icono(texto: string) {
  let i = iconos.get(texto);
  if (!i) {
    const t = 32, c = document.createElement('canvas');
    c.width = c.height = t;
    const g = c.getContext('2d')!;
    g.fillStyle = '#e5484d';
    g.beginPath();
    g.arc(t / 2, t / 2, t / 2, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#fff';
    g.font = `700 ${texto.length > 1 ? 17 : 21}px "Segoe UI", sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(texto, t / 2, t / 2 + 1);
    const rgba = new Uint8Array(g.getImageData(0, 0, t, t).data.buffer);
    i = import('@tauri-apps/api/image').then(({ Image }) => Image.new(rgba, t, t));
    iconos.set(texto, i);
  }
  return i;
}

const volver = () => { atencion.nuevos = 0; };

/** Para el $effect de Principal. */
export function iniciarBarraTareas() {
  const titulo = document.title;
  return $effect.root(() => {
    $effect(() => {
      const texto = textoGlobito(contarSinLeer([deSalas.salas, dePrivados], (c) => !!silenciadoHasta(c)), atencion.nuevos);
      if (!esEscritorio) { document.title = texto ? `(${texto}) ${titulo}` : titulo; return; }
      (async () => (await ventana()).setOverlayIcon(texto ? await icono(texto) : undefined))().catch(() => { /* sin globito */ });
    });
    // Cada aviso nuevo vuelve a titilar; en 0 lo corta.
    $effect(() => {
      const n = atencion.nuevos;
      if (!esEscritorio) return;
      ventana().then(async (w) => {
        const { UserAttentionType } = await import('@tauri-apps/api/window');
        await w.requestUserAttention(n ? UserAttentionType.Informational : null);
      }).catch(() => {});
    });

    if (!esEscritorio) {
      addEventListener('focus', volver);
      return () => { volver(); removeEventListener('focus', volver); document.title = titulo; };
    }
    const quitar = ventana().then((w) => w.onFocusChanged(({ payload }) => { if (payload) volver(); }));
    return () => {
      volver();
      quitar.then((f) => f()).catch(() => {});
      ventana().then((w) => w.setOverlayIcon(undefined)).catch(() => {});
    };
  });
}

import { invoke, isTauri } from '@tauri-apps/api/core';
import { voz, alternarMute, ensordecer } from './voz.svelte';

// Atajos de teclado y mouse que andan con la app atrás (ganchos en src-tauri/src/atajos.rs), solo en la app de escritorio
// y mientras se está en una sala de voz. Se guardan en este dispositivo: `localStorage['dm.atajos']` = { acción: tecla }.
export type Accion = 'silenciar' | 'ensordecer' | 'hablar';
export type Tecla = { codigo: number; nombre: string };
const CLAVE = 'dm.atajos';
const ACCIONES: Accion[] = ['silenciar', 'ensordecer', 'hablar'];
export const ESC = 0x1b; // al asignar, cancela
const BOTONES_MOUSE = 0x1_0000; // los códigos desde acá son botones del mouse, no teclas

function leer(): Partial<Record<Accion, Tecla>> {
  try {
    const a = JSON.parse(localStorage.getItem(CLAVE) ?? '{}');
    return Object.fromEntries(ACCIONES.filter((k) => Number.isInteger(a?.[k]?.codigo) && typeof a[k].nombre === 'string')
      .map((k) => [k, { codigo: a[k].codigo, nombre: a[k].nombre }]));
  } catch { return {}; }
}
export const atajos = $state(leer());

const avisarAsignadas = () => invoke('atajos_asignar', { codigos: Object.values(atajos).map((t) => t!.codigo) }).catch(() => {});

/** Asigna `t` a la acción (la saca de otra que la tuviera) o, con `null`, deja la acción sin atajo. */
export function guardarAtajo(a: Accion, t: Tecla | null) {
  for (const k of ACCIONES) if (t && atajos[k]?.codigo === t.codigo) delete atajos[k];
  if (t) atajos[a] = t; else delete atajos[a];
  try { localStorage.setItem(CLAVE, JSON.stringify(atajos)); } catch { /* sin almacenamiento: dura esta sesión */ }
  void avisarAsignadas();
}

/** Espera la próxima tecla o botón del mouse que se apriete (en cualquier ventana). `cancelar()` la corta con null. */
export function capturar(): { tecla: Promise<Tecla | null>; cancelar: () => void } {
  let fin: (t: Tecla | null) => void = () => {};
  const tecla = new Promise<Tecla | null>((ok) => (fin = ok));
  const oyente = import('@tauri-apps/api/event').then(({ once }) => once<Tecla>('atajo-capturado', (e) => fin(e.payload)));
  oyente.then(() => invoke('atajos_capturar', { si: true })).catch(() => fin(null));
  void tecla.finally(() => oyente.then((f) => f()).catch(() => {}));
  return { tecla, cancelar: () => { invoke('atajos_capturar', { si: false }).catch(() => {}); fin(null); } };
}

let porTecla = false; // pulsar para hablar: el micrófono lo prendió la tecla y se apaga al soltarla
function alApretar(codigo: number, abajo: boolean) {
  const que = ACCIONES.find((k) => atajos[k]?.codigo === codigo);
  if (!que || !voz.salaId) return;
  // Escribiendo en la app, una tecla común es texto y no un atajo.
  if (codigo < BOTONES_MOUSE && document.hasFocus() && document.activeElement?.matches('input, textarea, [contenteditable]')) return;
  if (que === 'hablar') {
    if (abajo && voz.muteado) { porTecla = true; void alternarMute(); }
    else if (!abajo && porTecla) { porTecla = false; if (!voz.muteado) void alternarMute(); }
  } else if (abajo) {
    if (que === 'silenciar') void alternarMute(); else void ensordecer(!voz.ensordecido);
  }
}

/** Arranca los atajos (una vez, al abrir la app). Devuelve la limpieza. */
export function iniciarAtajos(): () => void {
  if (!isTauri()) return () => {};
  void avisarAsignadas();
  const parar = import('@tauri-apps/api/event').then(({ listen }) => listen<{ codigo: number; abajo: boolean }>('atajo', (e) => alApretar(e.payload.codigo, e.payload.abajo)));
  return () => { parar.then((f) => f()).catch(() => {}); };
}

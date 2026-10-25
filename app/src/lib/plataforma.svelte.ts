import { isTauri } from '@tauri-apps/api/core';

// Dónde corre la app: escritorio (Tauri) o navegador, y si la pantalla es de celular (768 px o menos).
export const esEscritorio = isTauri();

const consulta = typeof matchMedia === 'function' ? matchMedia('(max-width: 768px)') : null;
export const pantalla = $state({ movil: consulta?.matches ?? false });
consulta?.addEventListener('change', (e) => (pantalla.movil = e.matches));

/** En el escritorio transmite el nativo; en el navegador, solo si existe el compartir pantalla (no en celulares). */
export const puedeTransmitir = () => esEscritorio || typeof navigator.mediaDevices?.getDisplayMedia === 'function';

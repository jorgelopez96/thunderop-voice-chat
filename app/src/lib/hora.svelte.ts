import { leerPrefs, guardarPrefs } from './prefs';

// Formato de hora de los mensajes (24 h o 12 h), por dispositivo.
export const formatoHora = $state({ h24: leerPrefs().hora24 });

export function cambiarFormatoHora(h24: boolean) {
  formatoHora.h24 = h24;
  guardarPrefs({ hora24: h24 });
}

export const horaDe = (fecha: string) =>
  new Date(fecha.replace(' ', 'T')).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', hour12: !formatoHora.h24 });

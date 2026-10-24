import type { Fuente } from './transmisorNativo';

/** Texto de error según el código de salida del transmisor nativo (-1: ni arrancó). */
export function mensajeTransmision(codigo: number): string {
  switch (codigo) {
    case 0: return '';
    case 2: return 'No se encontró esa pantalla o ventana. ¿Se cerró?';
    case 3: return 'Tu Windows no tiene los componentes de video para transmitir (Media Feature Pack).';
    case 5: return 'No se pudo conectar la transmisión al servidor.';
    case -1: return 'No se pudo abrir el transmisor.';
    default: return 'Se cortó la transmisión. Probá de nuevo.';
  }
}

/** Qué fuente queda elegida tras refrescar la lista. Sin elección previa, el primer monitor (o la primera).
 *  Con una previa, solo la misma (tipo + id, y el pid si es ventana: un HWND reusado es otra ventana);
 *  si ya no está devuelve null: nunca se pasa en silencio a compartir otra cosa. */
export function elegirFuente(lista: Fuente[], anterior: { tipo: string; id: string; pid?: number } | null): Fuente | null {
  if (anterior) return lista.find((x) => x.tipo === anterior.tipo && x.id === anterior.id && (x.tipo !== 'ventana' || anterior.pid === undefined || x.pid === anterior.pid)) ?? null;
  return lista.find((x) => x.tipo === 'monitor') ?? lista[0] ?? null;
}

const MARCA = '\n…[recortado]…\n';
/** Registro del transmisor listo para subir: sin el nombre de usuario de Windows y, si pasa de `max`, principio + final. */
export function recortarRegistro(texto: string, max = 60_000): string {
  const t = texto.replace(/([A-Za-z]):[\\/]Users[\\/][^\\/"'\r\n]+/gi, '$1:\\Users\\…');
  if (t.length <= max) return t;
  const cabeza = 8_000;
  return t.slice(0, cabeza) + MARCA + t.slice(t.length - (max - cabeza - MARCA.length));
}

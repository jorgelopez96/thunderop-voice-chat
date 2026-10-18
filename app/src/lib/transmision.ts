/** Texto de error al empezar a transmitir. Cancelar el selector (`NotAllowedError`) no es error. */
export function mensajeTransmision(e: unknown): string {
  return (e as Error)?.name === 'NotAllowedError' ? '' : 'No se pudo compartir la pantalla.';
}

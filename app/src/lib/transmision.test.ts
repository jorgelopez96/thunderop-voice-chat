import { describe, it, expect } from 'vitest';
import { mensajeTransmision } from './transmision';

describe('errores al transmitir', () => {
  it('cancelar el selector no es error', () => {
    expect(mensajeTransmision(new DOMException('cancelado', 'NotAllowedError'))).toBe('');
  });
  it('otro fallo da el mensaje genérico', () => {
    expect(mensajeTransmision(new Error('x'))).toBe('No se pudo compartir la pantalla.');
    expect(mensajeTransmision(undefined)).toBe('No se pudo compartir la pantalla.');
  });
});

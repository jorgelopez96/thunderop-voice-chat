import { describe, it, expect } from 'vitest';
import { validarSonido, Limite } from './botoneraLogica';

const ok = { duracion: 3, tamaño: 1000, tipo: 'audio/mpeg' };

describe('validarSonido', () => {
  it('más de 10 s se rechaza', () => expect(validarSonido({ ...ok, duracion: 10.5 })).toBe('El sonido dura más de 10 segundos.'));
  it('más de 1 MB se rechaza', () => expect(validarSonido({ ...ok, tamaño: 1048577 })).toBe('El sonido pesa más de 1 MB.'));
  it('tipo no permitido se rechaza', () => expect(validarSonido({ ...ok, tipo: 'video/mp4' })).toBe('Tipo de archivo no permitido.'));
  it('válido da vacío', () => {
    expect(validarSonido(ok)).toBe('');
    expect(validarSonido({ duracion: 10, tamaño: 1048576, tipo: 'audio/ogg' })).toBe('');
  });
});

describe('Limite', () => {
  it('el límite deja 3 y descarta el cuarto', () => {
    const l = new Limite(3);
    expect([l.intentar(), l.intentar(), l.intentar(), l.intentar()]).toEqual([true, true, true, false]);
  });
  it('liberar deja lugar', () => {
    const l = new Limite(3);
    for (let i = 0; i < 3; i++) l.intentar();
    l.liberar();
    expect(l.intentar()).toBe(true);
    expect(l.intentar()).toBe(false);
  });
  it('liberar de más no pasa de cero', () => {
    const l = new Limite(1);
    l.liberar(); l.liberar();
    expect([l.intentar(), l.intentar()]).toEqual([true, false]);
  });
});

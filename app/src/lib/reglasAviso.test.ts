import { describe, expect, it } from 'vitest';
import { queAvisar, contarSinLeer, textoGlobito } from './reglasAviso';

const base = { mencion: false, avisoMenciones: true, avisoMensajes: true, notificaciones: true, silenciado: false, aLaVista: false, viendoChat: false };

describe('queAvisar', () => {
  it('con la ventana sin foco destaca el ícono y notifica', () => {
    expect(queAvisar(base)).toEqual({ avisa: true, destacar: true, notificar: true });
  });
  it('con la ventana a la vista suena pero no destaca; con el chat abierto, nada', () => {
    expect(queAvisar({ ...base, aLaVista: true })).toEqual({ avisa: true, destacar: false, notificar: false });
    expect(queAvisar({ ...base, aLaVista: true, viendoChat: true }).avisa).toBe(false);
    // Chat abierto pero la ventana minimizada: avisa igual.
    expect(queAvisar({ ...base, viendoChat: true }).destacar).toBe(true);
  });
  it('silenciado no avisa, salvo que te mencionen con los avisos de menciones prendidos', () => {
    expect(queAvisar({ ...base, silenciado: true }).avisa).toBe(false);
    expect(queAvisar({ ...base, silenciado: true, mencion: true }).destacar).toBe(true);
    expect(queAvisar({ ...base, silenciado: true, mencion: true, avisoMenciones: false }).avisa).toBe(false);
  });
  it('sin notificaciones de escritorio igual destaca el ícono', () => {
    expect(queAvisar({ ...base, notificaciones: false })).toEqual({ avisa: true, destacar: true, notificar: false });
    expect(queAvisar({ ...base, avisoMensajes: false }).avisa).toBe(false);
  });
});

describe('contarSinLeer', () => {
  it('suma salas y privados sin los silenciados', () => {
    expect(contarSinLeer([{ s1: 2, s2: 5 }, { ana: 1 }], (c) => c === 's2')).toBe(3);
    expect(contarSinLeer([{}, {}], () => false)).toBe(0);
  });
});

describe('textoGlobito', () => {
  it('vacío si no llegó nada desde que se fue', () => {
    expect(textoGlobito(4, 0)).toBe('');
  });
  it('el número de sin leer, al menos lo que llegó, y 9+ si son muchos', () => {
    expect(textoGlobito(3, 1)).toBe('3');
    expect(textoGlobito(0, 2)).toBe('2');
    expect(textoGlobito(9, 1)).toBe('9');
    expect(textoGlobito(10, 1)).toBe('9+');
  });
});

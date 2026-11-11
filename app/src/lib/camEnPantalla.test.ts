import { describe, expect, it } from 'vitest';
import { leerCam, escribirCam, POR_DEFECTO } from './camEnPantalla';

describe('posición de la cámara en la transmisión', () => {
  it('lee "x,y,w" y vacío es sin cámara', () => {
    expect(leerCam('0.1,0.2,0.3')).toEqual({ x: 0.1, y: 0.2, w: 0.3 });
    expect(leerCam('')).toBeNull();
    expect(leerCam(undefined)).toBeNull();
  });
  it('un valor roto vuelve a la posición por defecto', () => {
    expect(leerCam('hola')).toEqual(POR_DEFECTO);
    expect(leerCam('1,2')).toEqual(POR_DEFECTO);
  });
  it('acota: el ancho entre 15% y 45% y la ventanita adentro de la pantalla', () => {
    expect(leerCam('0,0,0.9')).toEqual({ x: 0, y: 0, w: 0.45 });
    expect(leerCam('0,0,0.01')).toEqual({ x: 0, y: 0, w: 0.15 });
    expect(leerCam('0.9,-1,0.3')).toEqual({ x: 0.7, y: 0, w: 0.3 });
    expect(escribirCam({ x: 0.733333, y: 0.71, w: 0.25 })).toBe('0.733,0.71,0.25');
    expect(POR_DEFECTO).toEqual({ x: 0.73, y: 0.71, w: 0.25 });
  });
});

import { describe, it, expect } from 'vitest';
import { mensajeTransmision, elegirFuente, recortarRegistro } from './transmision';
import type { Fuente } from './transmisorNativo';

describe('errores al transmitir', () => {
  it('0 no es error', () => expect(mensajeTransmision(0)).toBe(''));
  it('un mensaje por código', () => {
    expect(mensajeTransmision(2)).toBe('No se encontró esa pantalla o ventana. ¿Se cerró?');
    expect(mensajeTransmision(3)).toBe('Tu Windows no tiene los componentes de video para transmitir (Media Feature Pack).');
    expect(mensajeTransmision(5)).toBe('No se pudo conectar la transmisión al servidor.');
    expect(mensajeTransmision(-1)).toBe('No se pudo abrir el transmisor.');
  });
  it('4 y cualquier otro: se cortó', () => {
    expect(mensajeTransmision(4)).toBe('Se cortó la transmisión. Probá de nuevo.');
    expect(mensajeTransmision(99)).toBe('Se cortó la transmisión. Probá de nuevo.');
  });
});

describe('elegirFuente', () => {
  const f = (tipo: Fuente['tipo'], id: string): Fuente => ({ tipo, id, titulo: id, pid: 0, png_base64: null });
  const lista = [f('ventana', '7'), f('monitor', 'A'), f('monitor', 'B')];
  it('conserva la elegida si sigue', () => expect(elegirFuente(lista, { tipo: 'monitor', id: 'B' })).toBe(lista[2]));
  it('si desaparece, null (no comparte otra cosa)', () => expect(elegirFuente(lista, { tipo: 'ventana', id: '9' })).toBeNull());
  it('sin anterior, el primer monitor', () => expect(elegirFuente(lista, null)).toBe(lista[1]));
  it('sin monitores, la primera ventana', () => expect(elegirFuente([f('ventana', '7'), f('ventana', '8')], null)?.id).toBe('7'));
  it('lista vacía: null', () => expect(elegirFuente([], { tipo: 'monitor', id: 'A' })).toBeNull());
  it('misma id con otro tipo no es la misma', () => expect(elegirFuente([f('ventana', 'A'), f('monitor', 'B')], { tipo: 'monitor', id: 'A' })).toBeNull());
  it('ventana con la misma id pero otro pid (HWND reusado): null', () => {
    const v = { ...f('ventana', '7'), pid: 100 };
    expect(elegirFuente([{ ...v, pid: 200 }, f('monitor', 'A')], v)).toBeNull();
    expect(elegirFuente([v], v)).toBe(v);
  });
});

describe('recortarRegistro', () => {
  it('oculta el usuario de Windows en las rutas', () => {
    expect(recortarRegistro('C:\\Users\\Jorge Lopez\\AppData\\x.log')).toBe('C:\\Users\\…\\AppData\\x.log');
  });
  it('oculta rutas en minúscula, con barras o varias en una línea', () => {
    expect(recortarRegistro('c:\\users\\jorge\\x')).toBe('c:\\Users\\…\\x');
    expect(recortarRegistro('C:/Users/Jorge Lopez/AppData/x.log')).toBe('C:\\Users\\…/AppData/x.log');
    expect(recortarRegistro('a C:\\Users\\Ana\\x y D:\\Users\\Beto\\y')).toBe('a C:\\Users\\…\\x y D:\\Users\\…\\y');
  });
  it('redacta una ruta cerca del corte antes de recortar', () => {
    const r = recortarRegistro('x'.repeat(7_990) + 'C:\\Users\\Secreto\\z' + 'y'.repeat(100_000));
    expect(r).not.toContain('Secreto');
  });
  it('deja intacto un texto corto', () => {
    expect(recortarRegistro('placa: X\ncodificador: Y')).toBe('placa: X\ncodificador: Y');
  });
  it('recorta un texto largo conservando principio y final', () => {
    const r = recortarRegistro('primera\n' + 'x'.repeat(200_000) + '\nultima');
    expect(r.length).toBeLessThanOrEqual(60_000);
    expect(r.startsWith('primera\n')).toBe(true);
    expect(r.endsWith('\nultima')).toBe(true);
    expect(r).toContain('\n…[recortado]…\n');
  });
});

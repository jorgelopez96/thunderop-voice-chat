import { describe, it, expect } from 'vitest';
import { validarSonido, mensajeSubida, separarEmoji, unirEmoji, seleccionInicial, moverManija, recortarMono, codificarWav, picos, formatoSegundos, MAX_BYTES, TASA } from './botoneraLogica';

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

describe('mensajeSubida', () => {
  it('deja pasar el tope de 50 y traduce tamaño/tipo', () => {
    expect(mensajeSubida({ message: 'El grupo ya tiene 50 sonidos.' })).toBe('El grupo ya tiene 50 sonidos.');
    expect(mensajeSubida({ data: { file: { code: 'validation_file_size_limit' } } })).toBe('El sonido pesa más de 1 MB.');
    expect(mensajeSubida({ data: { file: { code: 'validation_invalid_mime_type' } } })).toBe('Tipo de archivo no permitido.');
  });
  it('lo demás cae a un genérico en español', () => {
    expect(mensajeSubida({ message: 'Failed to create record.' })).toBe('No se pudo subir el sonido.');
    expect(mensajeSubida(undefined)).toBe('No se pudo subir el sonido.');
  });
});

describe('emoji del botón', () => {
  it('separa el emoji del principio', () => {
    expect(separarEmoji('🔥 Bruh')).toEqual({ emoji: '🔥', texto: 'Bruh' });
    expect(separarEmoji('❤️Amor')).toEqual({ emoji: '❤️', texto: 'Amor' });
    expect(separarEmoji('👨‍👩‍👧 Familia')).toEqual({ emoji: '👨‍👩‍👧', texto: 'Familia' });
    expect(separarEmoji('👋🏽 Hola')).toEqual({ emoji: '👋🏽', texto: 'Hola' });
    expect(separarEmoji('#️⃣ Numeral')).toEqual({ emoji: '#️⃣', texto: 'Numeral' });
    expect(separarEmoji('🇦🇷 Vamos')).toEqual({ emoji: '🇦🇷', texto: 'Vamos' });
  });
  it('sin emoji adelante queda todo como texto', () => {
    expect(separarEmoji('Bruh 🔥')).toEqual({ emoji: '', texto: 'Bruh 🔥' });
    expect(separarEmoji('123')).toEqual({ emoji: '', texto: '123' });
  });
  it('une con un espacio', () => {
    expect(unirEmoji('🔥', ' Bruh ')).toBe('🔥 Bruh');
    expect(unirEmoji('', 'Bruh')).toBe('Bruh');
  });
});


describe('selección del recorte', () => {
  it('arranca en los primeros 10 s, o en todo si es más corto', () => {
    expect(seleccionInicial(45)).toEqual({ inicio: 0, fin: 10 });
    expect(seleccionInicial(3.2)).toEqual({ inicio: 0, fin: 3.2 });
  });
  it('se puede achicar libremente', () => {
    expect(moverManija({ inicio: 0, fin: 10 }, 'fin', 2.5, 45)).toEqual({ inicio: 0, fin: 2.5 });
    expect(moverManija({ inicio: 0, fin: 10 }, 'inicio', 4, 45)).toEqual({ inicio: 4, fin: 10 });
  });
  it('nunca pasa de 10 s: la otra manija se arrastra', () => {
    expect(moverManija({ inicio: 0, fin: 10 }, 'fin', 30, 45)).toEqual({ inicio: 20, fin: 30 });
    expect(moverManija({ inicio: 30, fin: 35 }, 'inicio', 5, 45)).toEqual({ inicio: 5, fin: 15 });
  });
  it('no se cruzan ni se salen del audio', () => {
    expect(moverManija({ inicio: 2, fin: 5 }, 'inicio', 9, 45)).toEqual({ inicio: 9, fin: 9.1 });
    expect(moverManija({ inicio: 2, fin: 5 }, 'fin', -3, 45)).toEqual({ inicio: 0, fin: 0.1 });
    expect(moverManija({ inicio: 2, fin: 5 }, 'inicio', 50, 45)).toEqual({ inicio: 44.9, fin: 45 });
    expect(moverManija({ inicio: 0, fin: 3 }, 'fin', 99, 3)).toEqual({ inicio: 0, fin: 3 });
  });
});

describe('recortarMono', () => {
  it('corta las muestras de la selección y promedia los canales', () => {
    const izq = Float32Array.from([0, 1, 1, 1, 0]), der = Float32Array.from([0, 0, 1, 0, 0]);
    expect(Array.from(recortarMono([izq, der], 1, { inicio: 1, fin: 4 }))).toEqual([0.5, 1, 0.5]);
  });
  it('no pasa de 10 s ni del largo del audio', () => {
    const largo = new Float32Array(TASA * 12);
    expect(recortarMono([largo], TASA, { inicio: 0, fin: 10.4 }).length).toBe(TASA * 10);
    expect(recortarMono([new Float32Array(5)], 1, { inicio: 3, fin: 9 }).length).toBe(2);
  });
});

describe('codificarWav', () => {
  it('arma la cabecera y convierte a 16 bits', () => {
    const v = new DataView(codificarWav(Float32Array.from([0, 1, -1, 2]), 8000));
    const texto = (o: number) => String.fromCharCode(...[0, 1, 2, 3].map((i) => v.getUint8(o + i)));
    expect([texto(0), texto(8), texto(36)]).toEqual(['RIFF', 'WAVE', 'data']);
    expect([v.getUint16(22, true), v.getUint32(24, true), v.getUint16(34, true), v.getUint32(40, true)]).toEqual([1, 8000, 16, 8]);
    expect([0, 1, 2, 3].map((i) => v.getInt16(44 + i * 2, true))).toEqual([0, 32767, -32768, 32767]);
  });
  it('10 s a la tasa de subida entran en 1 MB', () => {
    expect(codificarWav(new Float32Array(TASA * 10), TASA).byteLength).toBeLessThanOrEqual(MAX_BYTES);
  });
});

it('picos de la forma de onda', () => {
  expect(picos(Float32Array.from([0.25, -0.5, 0.25, 0.125, -2, 0]), 3)).toEqual([0.5, 0.25, 1]);
});

it('formato de segundos', () => expect(formatoSegundos(3.25)).toMatch(/^3,[23] s$/));

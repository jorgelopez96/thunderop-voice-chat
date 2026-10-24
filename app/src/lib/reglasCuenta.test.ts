import { describe, it, expect } from 'vitest';
import { normalizarUsuario, errorUsuario, requisitosClave, errorClave, edad, errorEdad, soloDigitos } from './reglasCuenta';

const hoy = new Date(Date.UTC(2026, 9, 24));

describe('usuario', () => {
  it('normaliza con trim y minúsculas', () => expect(normalizarUsuario('  Jorge.L ')).toBe('jorge.l'));
  it('acepta letras, números, punto y guion bajo de 3 a 20', () => {
    expect(errorUsuario('abc')).toBe('');
    expect(errorUsuario('a_b.c9')).toBe('');
    expect(errorUsuario('a'.repeat(20))).toBe('');
  });
  it('rechaza corto, largo, acentos, mayúsculas y símbolos', () => {
    for (const u of ['ab', 'a'.repeat(21), 'jorgé', 'Jorge', 'a b c', 'a-b']) expect(errorUsuario(u)).not.toBe('');
  });
});

describe('contraseña', () => {
  it('acepta una completa', () => expect(errorClave('Abcdef1!')).toBe(''));
  it('rechaza si falta algo', () => {
    for (const c of ['Abcde1!', 'abcdef1!', 'Abcdefg!', 'Abcdefg1', '']) expect(errorClave(c)).not.toBe('');
  });
  it('requisitosClave detalla cada regla', () => {
    expect(requisitosClave('Abc!')).toEqual({ largo: false, mayuscula: true, numero: false, especial: true });
  });
});

describe('edad', () => {
  it('cuenta años cumplidos', () => {
    expect(edad('2013-10-24', hoy)).toBe(13);
    expect(edad('2013-10-25', hoy)).toBe(12);
    expect(edad('2008-10-24', hoy)).toBe(18);
  });
  it('13 justos hoy entra, un día antes de cumplir no', () => {
    expect(errorEdad('2013-10-24', hoy)).toBe('');
    expect(errorEdad('2013-10-25', hoy)).toBe('Tenés que tener al menos 13 años para usar Thunderop.');
  });
  it('fechas inexistentes, mal escritas o futuras no valen', () => {
    for (const f of ['2000-02-30', '2000-2-3', 'hola', '2026-10-25']) {
      expect(edad(f, hoy)).toBeNaN();
      expect(errorEdad(f, hoy)).toBe('La fecha de nacimiento no es válida.');
    }
  });
});

it('soloDigitos limpia un código pegado', () => {
  expect(soloDigitos('123 456')).toBe('123456');
  expect(soloDigitos('12a-3')).toBe('123');
});

import { describe, it, expect } from 'vitest';
import { mencionEnCurso, sugerencias, completar, partirMenciones, menciona } from './menciones';

describe('mencionEnCurso', () => {
  it('detecta el @ antes del cursor', () => {
    expect(mencionEnCurso('hola @jo', 8)).toEqual({ inicio: 5, consulta: 'jo' });
    expect(mencionEnCurso('@', 1)).toEqual({ inicio: 0, consulta: '' });
  });
  it('no es mención un mail ni algo ya terminado con espacio', () => {
    expect(mencionEnCurso('mail@algo', 9)).toBeNull();
    expect(mencionEnCurso('@jorge listo', 12)).toBeNull();
  });
});

describe('sugerencias', () => {
  const nombres = ['Jorge López', 'Majo', 'Juan', 'Ana'];
  it('primero los que empiezan, después los que contienen', () => expect(sugerencias(nombres, 'jo')).toEqual(['Jorge López', 'Majo']));
  it('sin consulta, todos', () => expect(sugerencias(nombres, '')).toEqual(nombres));
});

describe('completar', () => {
  it('reemplaza la consulta por el nombre y deja el cursor después', () => {
    expect(completar('hola @jo que tal', 5, 8, 'Jorge López')).toEqual({ texto: 'hola @Jorge López  que tal', cursor: 18 });
  });
});

describe('partirMenciones', () => {
  const nombres = ['Jorge', 'Jorge López', 'Ana'];
  it('resalta el nombre más largo que coincide', () => {
    expect(partirMenciones('che @jorge lópez mirá', nombres)).toEqual([
      { texto: 'che ' }, { texto: '@jorge lópez', nombre: 'Jorge López' }, { texto: ' mirá' },
    ]);
  });
  it('no corta a mitad de palabra ni toma mails', () => {
    expect(partirMenciones('@Anabella y mail@Ana', nombres)).toEqual([{ texto: '@Anabella y mail@Ana' }]);
  });
  it('varias menciones', () => {
    expect(partirMenciones('@Ana y @Jorge', nombres).filter((p) => p.nombre).map((p) => p.nombre)).toEqual(['Ana', 'Jorge']);
  });
});

describe('menciona', () => {
  it('solo con @ y el nombre entero', () => {
    expect(menciona('che @Jorge mirá', 'Jorge')).toBe(true);
    expect(menciona('che Jorge mirá', 'Jorge')).toBe(false);
    expect(menciona('@Jorgelina', 'Jorge')).toBe(false);
    expect(menciona(undefined, 'Jorge')).toBe(false);
  });
});

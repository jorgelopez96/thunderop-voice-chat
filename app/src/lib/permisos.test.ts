import { describe, expect, it } from 'vitest';
import type { RecordModel } from 'pocketbase';
import { PERMISOS, permisosDe, puedo, rolesDe, rolesDeMiembro, resumen, nuevoId } from './permisos';

const TODOS = { id: 'todos', nombre: 'Todos', color: '', permisos: [] as string[] };
const DJ = { id: 'rdj0000001', nombre: 'DJ', color: '#5bc77a', permisos: ['agregarMusica', 'cola'] };
const MOD = { id: 'rmod000001', nombre: 'Moderador', color: '#e5b84b', permisos: ['silenciar'] };
const grupo = (x: Partial<RecordModel> = {}) => ({ id: 'g', owner: 'ana', roles: [TODOS, DJ, MOD], asignaciones: {}, ...x }) as unknown as RecordModel;

describe('permisos', () => {
  it('el admin tiene todos', () => {
    expect(permisosDe(grupo(), 'ana').size).toBe(PERMISOS.length);
    expect(puedo(grupo(), 'ana', 'botonera')).toBe(true);
  });

  it('sin rol, solo lo de Todos', () => {
    expect(puedo(grupo(), 'beto', 'agregarMusica')).toBe(false);
    expect(puedo(grupo({ roles: [{ ...TODOS, permisos: ['agregarMusica'] }] }), 'beto', 'agregarMusica')).toBe(true);
  });

  it('dos roles suman', () => {
    const g = grupo({ asignaciones: { beto: [DJ.id, MOD.id] } });
    expect([...permisosDe(g, 'beto')].sort()).toEqual(['agregarMusica', 'cola', 'silenciar']);
  });

  it('un rol borrado o un permiso desconocido no cuentan', () => {
    const g = grupo({ roles: [TODOS, { ...MOD, permisos: ['silenciar', 'volar'] }], asignaciones: { beto: [DJ.id, MOD.id] } });
    expect([...permisosDe(g, 'beto')]).toEqual(['silenciar']);
    expect(rolesDeMiembro(g, 'beto').map((r) => r.id)).toEqual([MOD.id]);
  });

  it('grupo sin roles (datos viejos): solo Todos vacío', () => {
    const g = { id: 'g', owner: 'ana' } as unknown as RecordModel;
    expect(rolesDe(g)).toEqual([TODOS]);
    expect(permisosDe(g, 'beto').size).toBe(0);
  });

  it('resumen y nuevoId', () => {
    expect(resumen(DJ as never)).toBe('Agregar canciones · Manejar la cola');
    expect(resumen(TODOS as never)).toBe('Sin permisos');
    expect(nuevoId()).toMatch(/^[a-z0-9]{10}$/);
  });
});

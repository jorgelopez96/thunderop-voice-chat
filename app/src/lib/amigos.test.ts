import { describe, it, expect } from 'vitest';
import type { RecordModel } from 'pocketbase';
import { separarAmistades } from './amigos.svelte';

const u = (id: string, name = id) => ({ id, name }) as unknown as RecordModel;
const am = (id: string, de: string, para: string, estado: string, expand?: object) => ({ id, de, para, estado, expand }) as unknown as RecordModel;

describe('separarAmistades', () => {
  it('reparte según mi lado', () => {
    const r = separarAmistades([
      am('1', 'yo', 'bea', 'aceptada', { de: u('yo'), para: u('bea') }),
      am('2', 'ana', 'yo', 'aceptada', { de: u('ana'), para: u('yo') }),
      am('3', 'cami', 'yo', 'pendiente', { de: u('cami'), para: u('yo') }),
      am('4', 'yo', 'dani', 'pendiente', { de: u('yo') }),
    ], 'yo');
    expect(r.lista.map((a) => [a.amistad, a.usuario.id])).toEqual([['2', 'ana'], ['1', 'bea']]);
    expect(r.recibidas).toEqual([{ id: '3', usuario: u('cami') }]);
    expect(r.enviadas).toEqual([{ id: '4', usuario: { id: 'dani', name: '', collectionId: '', collectionName: 'users' } }]);
  });
});

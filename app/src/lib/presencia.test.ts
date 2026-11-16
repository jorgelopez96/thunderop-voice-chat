import { describe, it, expect } from 'vitest';
import { enLineaSegun, estado } from './presencia.svelte';
import type { RecordModel } from 'pocketbase';

describe('enLineaSegun', () => {
  const t = Date.parse('2026-10-20T12:00:00.000Z');
  it('a menos de 90 s está en línea, en ISO y en formato PocketBase', () => {
    expect(enLineaSegun(new Date(t - 30_000).toISOString(), t)).toBe(true);
    expect(enLineaSegun('2026-10-20 11:59:30.000Z', t)).toBe(true);
    expect(enLineaSegun(new Date(t - 120_000).toISOString(), t)).toBe(false);
  });
  it('vacío o inválido → false', () => {
    expect(enLineaSegun(undefined, t)).toBe(false);
    expect(enLineaSegun('', t)).toBe(false);
    expect(enLineaSegun('basura', t)).toBe(false);
  });
});

describe('estado', () => {
  const u = (disponibilidad: string, inactivo: boolean) => ({ id: 'x', visto: new Date().toISOString(), disponibilidad, inactivo }) as unknown as RecordModel;
  it('sin tocar la PC, "Disponible" se ve "Ausente"; "Ocupado" sigue "Ocupado"', () => {
    expect(estado(u('', false))).toBe('disponible');
    expect(estado(u('', true))).toBe('ausente');
    expect(estado(u('disponible', true))).toBe('ausente');
    expect(estado(u('ocupado', true))).toBe('ocupado');
    expect(estado(u('ausente', false))).toBe('ausente');
  });
});

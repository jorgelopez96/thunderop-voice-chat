import { describe, it, expect } from 'vitest';
import { ClientResponseError } from 'pocketbase';
import { mensajeError } from './sesion.svelte';
import { grupos, grupoActual } from './grupos.svelte';
import { pb } from './pb';

const err = (data: object) => new ClientResponseError({ status: 400, response: { message: 'Failed to create record.', data } });

describe('mensajeError', () => {
  it('archivo inválido en español', () => {
    expect(mensajeError(err({ file: { code: 'validation_file_size_limit', message: 'x' } }))).toBe('El archivo no es válido (imagen o video, hasta 25 MB).');
  });
  it('avatar inválido en español', () => {
    expect(mensajeError(err({ avatar: { code: 'validation_invalid_mime_type', message: 'x' } }))).toBe('La foto no es válida (imagen, hasta 2 MB).');
  });
});

describe('estado de grupos', () => {
  it('se limpia al cerrar sesión', () => {
    pb.authStore.save('tok', { id: 'u1' } as never);
    grupos.lista = [{ id: 'g' } as never]; grupos.cargado = true; grupoActual.id = 'g';
    pb.authStore.clear();
    expect(grupos.lista).toEqual([]);
    expect(grupos.cargado).toBe(false);
    expect(grupoActual.id).toBeNull();
  });
});

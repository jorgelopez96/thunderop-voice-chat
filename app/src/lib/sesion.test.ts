import { vi, beforeEach, afterEach, describe, it, expect } from 'vitest';
import { ClientResponseError } from 'pocketbase';
import { mensajeError, validarSesionAlIniciar } from './sesion.svelte';
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
  it('nombre repetido', () => {
    expect(mensajeError(err({ name: { code: 'validation_not_unique', message: 'x' } }))).toBe('Ese nombre ya existe, probá con otro.');
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

describe('recordar mi cuenta', () => {
  beforeEach(() => {
    const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); }, removeItem: (k: string) => { m.delete(k); } }; };
    vi.stubGlobal('localStorage', mem());
    vi.stubGlobal('sessionStorage', mem());
    vi.spyOn(pb.collection('users'), 'authRefresh').mockResolvedValue({} as never);
    pb.authStore.save('token', { id: 'u1', collectionId: '', collectionName: 'users' });
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); pb.authStore.clear(); });

  it('sin recordar, al reabrir la app se descarta la sesión', async () => {
    localStorage.setItem('dm.recordar', '0');
    await validarSesionAlIniciar();
    expect(pb.authStore.token).toBe('');
  });
  it('sin recordar pero en la misma ejecución, la conserva', async () => {
    localStorage.setItem('dm.recordar', '0');
    sessionStorage.setItem('dm.sesion', '1');
    await validarSesionAlIniciar();
    expect(pb.authStore.token).toBe('token');
  });
  it('recordando, la conserva', async () => {
    localStorage.setItem('dm.recordar', '1');
    await validarSesionAlIniciar();
    expect(pb.authStore.token).toBe('token');
  });
});

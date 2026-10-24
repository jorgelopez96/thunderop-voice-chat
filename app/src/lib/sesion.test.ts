import { vi, beforeEach, afterEach, describe, it, expect } from 'vitest';
import { ClientResponseError } from 'pocketbase';
import { mensajeError, validarSesionAlIniciar } from './sesion.svelte';
import { grupos, grupoActual } from './grupos.svelte';
import { pb } from './pb';
import { cuenta, cargarEstado } from './cuenta.svelte';

const err = (data: object) => new ClientResponseError({ status: 400, response: { message: 'Failed to create record.', data } });

describe('mensajeError', () => {
  it('archivo inválido en español', () => {
    expect(mensajeError(err({ file: { code: 'validation_file_size_limit', message: 'x' } }))).toBe('El archivo no es válido (imagen o video, hasta 25 MB).');
  });
  it('avatar inválido en español', () => {
    expect(mensajeError(err({ avatar: { code: 'validation_invalid_mime_type', message: 'x' } }))).toBe('La foto no es válida (imagen, hasta 2 MB).');
  });
  it('usuario repetido', () => {
    expect(mensajeError(err({ username: { code: 'validation_not_unique', message: 'x' } }))).toBe('Ese usuario ya existe, probá con otro.');
  });
  it('credenciales incorrectas', () => {
    const e = new ClientResponseError({ status: 400, response: { message: 'Failed to authenticate.' } });
    expect(mensajeError(e)).toBe('Usuario, email o contraseña incorrectos.');
  });
  it('403 de cuenta incompleta actualiza cuenta.falta', () => {
    const e = new ClientResponseError({ status: 403, response: { message: 'Tu cuenta no está completa.', falta: ['verificar', 'perfil'] } });
    expect(mensajeError(e)).toBe('Completá tu cuenta para seguir.');
    expect(cuenta.falta).toEqual(['verificar', 'perfil']);
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

describe('estado de la cuenta', () => {
  afterEach(() => { vi.restoreAllMocks(); cuenta.falta = null; cuenta.error = ''; });

  it('un 403 con `falta` de cualquier pedido vuelve a completar', async () => {
    cuenta.falta = [];
    const data = await pb.afterSend!(new Response(null, { status: 403 }), { falta: ['terminos'] }, {});
    expect(data).toEqual({ falta: ['terminos'] });
    expect(cuenta.falta).toEqual(['terminos']);
  });
  it('si falla y ya había estado, lo conserva', async () => {
    vi.spyOn(pb, 'send').mockRejectedValue(new ClientResponseError({ status: 0 }));
    cuenta.falta = [];
    await cargarEstado();
    expect(cuenta.falta).toEqual([]);
    expect(cuenta.error).toBe('');
  });
  it('si falla sin estado previo, muestra el error', async () => {
    vi.spyOn(pb, 'send').mockRejectedValue(new ClientResponseError({ status: 0 }));
    await cargarEstado();
    expect(cuenta.falta).toBeNull();
    expect(cuenta.error).toBe('No se pudo conectar con el servidor.');
  });
});

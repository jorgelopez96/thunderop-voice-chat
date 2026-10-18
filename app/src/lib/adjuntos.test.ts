import { describe, it, expect } from 'vitest';
import { validarAdjunto, MAX_BYTES } from './adjuntos';

describe('validarAdjunto', () => {
  it('imagen pequena ok', () => expect(validarAdjunto({ type: 'image/png', size: 1024 })).toEqual({ ok: true }));
  it('pdf rechazado', () => expect(validarAdjunto({ type: 'application/pdf', size: 10 }).ok).toBe(false));
  it('mas de 25 MB rechazado', () => expect(validarAdjunto({ type: 'image/png', size: MAX_BYTES + 1 }).ok).toBe(false));
  it('video 61 s rechazado', () => expect(validarAdjunto({ type: 'video/mp4', size: 10 }, 61).ok).toBe(false));
  it('video 59 s ok', () => expect(validarAdjunto({ type: 'video/mp4', size: 10 }, 59).ok).toBe(true));
});

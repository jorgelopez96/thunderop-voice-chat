import { describe, it, expect } from 'vitest';
import { extraerCodigo, linkInvitacion } from './invitacion';

describe('extraerCodigo', () => {
  it.each(['abc123xyz0', 'discordmejorado://invite/abc123xyz0', 'https://x.com/invite/abc123xyz0', '  abc123xyz0 ', 'ABC123XYZ0'])(
    '%s', (e) => expect(extraerCodigo(e)).toBe('abc123xyz0'));
  it('hola -> null', () => expect(extraerCodigo('hola')).toBeNull());
  it('ida y vuelta', () => expect(extraerCodigo(linkInvitacion('abc123xyz0'))).toBe('abc123xyz0'));
});

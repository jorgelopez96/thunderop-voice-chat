import { describe, it, expect } from 'vitest';
import { extraerCodigo, linkInvitacion, invitacionEnTexto } from './invitacion';

describe('extraerCodigo', () => {
  it.each(['abc123xyz0', 'thunderop://invite/abc123xyz0', 'https://x.com/invite/abc123xyz0', '  abc123xyz0 ', 'ABC123XYZ0'])(
    '%s', (e) => expect(extraerCodigo(e)).toBe('abc123xyz0'));
  it('hola -> null', () => expect(extraerCodigo('hola')).toBeNull());
  it('ida y vuelta', () => expect(extraerCodigo(linkInvitacion('abc123xyz0'))).toBe('abc123xyz0'));
});

describe('invitacionEnTexto (tarjeta del chat)', () => {
  it('encuentra el código y deja el resto del texto', () => {
    expect(invitacionEnTexto('thunderop://invite/ratcq74t0m')).toEqual({ codigo: 'ratcq74t0m', resto: '' });
    expect(invitacionEnTexto('Vení! thunderop://invite/ratcq74t0m  dale')).toEqual({ codigo: 'ratcq74t0m', resto: 'Vení! dale' });
    expect(invitacionEnTexto('THUNDEROP://INVITE/RATCQ74T0M')).toEqual({ codigo: 'ratcq74t0m', resto: '' });
  });
  it('sin invitación (o con un código roto) da null', () => {
    expect(invitacionEnTexto('hola')).toBeNull();
    expect(invitacionEnTexto('thunderop://invite/corto')).toBeNull();
  });
});

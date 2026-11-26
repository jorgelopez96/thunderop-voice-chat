import { describe, expect, it } from 'vitest';
import { cumpleTexto, usuarioDeRed } from './perfil';

describe('perfil', () => {
  it('saca el usuario de lo que pegan', () => {
    expect(usuarioDeRed('@osidis')).toBe('osidis');
    expect(usuarioDeRed(' https://www.instagram.com/osidis/ ')).toBe('osidis');
    expect(usuarioDeRed('youtube.com/@canal.de-jorge')).toBe('canal.de-jorge');
    expect(usuarioDeRed('ma la')).toBe('');
  });
  it('cumpleaños sin año', () => {
    expect(cumpleTexto('03-14')).toBe('14 de marzo');
    expect(cumpleTexto('')).toBe('');
  });
});

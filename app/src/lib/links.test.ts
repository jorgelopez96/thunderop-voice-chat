import { describe, expect, it } from 'vitest';
import { partirEnLinks, primerLink, esGif } from './links';

describe('partirEnLinks', () => {
  it('separa links del texto y deja afuera la puntuación final', () => {
    expect(partirEnLinks('mirá https://youtu.be/abc, está bueno')).toEqual([
      { texto: 'mirá ' }, { texto: 'https://youtu.be/abc', url: 'https://youtu.be/abc' }, { texto: ', está bueno' },
    ]);
    expect(partirEnLinks('sin links')).toEqual([{ texto: 'sin links' }]);
    expect(partirEnLinks('(https://a.com/x?y=1).')).toEqual([{ texto: '(' }, { texto: 'https://a.com/x?y=1', url: 'https://a.com/x?y=1' }, { texto: ').' }]);
  });
  it('la vista previa usa el primer https', () => {
    expect(primerLink('http://a.com y https://b.com')).toBe('https://b.com');
    expect(primerLink('nada')).toBeUndefined();
  });
});

it('esGif: solo un link de media.giphy.com, nada más en el mensaje', () => {
  expect(esGif('https://media1.giphy.com/media/abc/200.gif')).toBe(true);
  expect(esGif('mirá https://media1.giphy.com/media/abc/200.gif')).toBe(false);
  expect(esGif('https://evil.com/media/abc/200.gif')).toBe(false);
});

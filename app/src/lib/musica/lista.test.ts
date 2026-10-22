import { describe, expect, it } from 'vitest';
import { idDeLista, mezclar } from './lista';

describe('idDeLista', () => {
  it('saca la lista de YouTube y YouTube Music', () => {
    expect(idDeLista('https://www.youtube.com/playlist?list=PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG')).toBe('PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG');
    expect(idDeLista('music.youtube.com/playlist?list=OLAK5uy_kq4cWfpXvlD1Tg2OZKnZu7fxtJMcDvcAE')).toBe('OLAK5uy_kq4cWfpXvlD1Tg2OZKnZu7fxtJMcDvcAE');
    expect(idDeLista('https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG')).toBe('PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG');
  });
  it('ignora mixes, listas privadas, otros sitios y links sin lista', () => {
    expect(idDeLista('https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=RDdQw4w9WgXcQ')).toBeNull();
    expect(idDeLista('https://music.youtube.com/playlist?list=LM')).toBeNull();
    expect(idDeLista('https://youtube.com.evil.com/playlist?list=PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG')).toBeNull();
    expect(idDeLista('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBeNull();
  });
});

it('mezclar no pierde ni repite elementos', () => {
  const xs = Array.from({ length: 50 }, (_, i) => i);
  expect(mezclar(xs).sort((a, b) => a - b)).toEqual(xs);
});

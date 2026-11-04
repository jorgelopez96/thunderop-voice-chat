import { describe, expect, it } from 'vitest';
import { idDeVideo, desviado, mmss } from './sincro';
import { posicion } from '../musica/posicion';

describe('idDeVideo', () => {
  it('saca el id de los links de video', () => {
    expect(idDeVideo('https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLx&t=3')).toBe('dQw4w9WgXcQ');
    expect(idDeVideo('https://youtube.com/watch?feature=share&v=AAAAAAAAAA2')).toBe('AAAAAAAAAA2');
    expect(idDeVideo('https://youtu.be/AAAAAAAAAA3?si=xyz')).toBe('AAAAAAAAAA3');
    expect(idDeVideo('https://www.youtube.com/shorts/AAAAAAAAAA4')).toBe('AAAAAAAAAA4');
    expect(idDeVideo('https://www.youtube.com/live/AAAAAAAAAA5?si=x')).toBe('AAAAAAAAAA5');
    expect(idDeVideo('https://www.youtube.com/embed/AAAAAAAAA_6')).toBe('AAAAAAAAA_6');
    expect(idDeVideo('m.youtube.com/watch?v=AAAAAAAAA-7')).toBe('AAAAAAAAA-7');
    expect(idDeVideo('HTTPS://WWW.YOUTUBE.COM/watch?v=AAAAAAAAAA8')).toBe('AAAAAAAAAA8');
  });

  it('rechaza lo que no es un video de YouTube', () => {
    for (const l of ['https://youtube.com.evil.com/watch?v=AAAAAAAAAAA', 'https://youtube.com@evil.com/watch?v=AAAAAAAAAAA',
      'https://evil.com/watch?v=AAAAAAAAAAA', 'https://www.youtube.com/watch?v=corto', 'https://www.youtube.com/watch?v=AAAAAAAAAAAB',
      'https://www.youtube.com/playlist?list=PLxxxxxxxxxx', 'https://www.youtube.com/@canal', 'https://vimeo.com/123', 'cualquier cosa', ''])
      expect(idDeVideo(l), l).toBeNull();
  });
});

describe('sincronización', () => {
  it('quien entra tarde va a la posición compartida', () => {
    expect(posicion({ inicioMs: 1000, pausaS: null }, 61_000)).toBe(60);
    expect(posicion({ inicioMs: 1000, pausaS: 12 }, 61_000)).toBe(12);
  });

  it('corrige pasados los 2 s sonando y los 0,5 s en pausa', () => {
    expect(desviado(10, 11.9, false)).toBe(false);
    expect(desviado(10, 12.1, false)).toBe(true);
    expect(desviado(14, 12, false)).toBe(false);
    expect(desviado(10, 10.4, true)).toBe(false);
    expect(desviado(10, 10.6, true)).toBe(true);
  });

  it('mmss', () => {
    expect(mmss(0)).toBe('0:00');
    expect(mmss(65.9)).toBe('1:05');
    expect(mmss(3725)).toBe('1:02:05');
  });
});

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// La presencia de voz que arma el servidor por cada participante de LiveKit (función pura de livekit.js). Es CommonJS
// para el JSVM de PocketBase: se evalúa acá con su propio `module`.
const m = { exports: {} as { persona: Function } };
new Function('module', 'exports', readFileSync(new URL('../pb_hooks/livekit.js', import.meta.url), 'utf8'))(m, m.exports);
const { persona } = m.exports;

const mic = { source: 'MICROPHONE', muted: false };
const cam = { source: 'CAMERA', muted: false };

describe('presencia de voz', () => {
  it('ensordecido sale del atributo; cámara, de una pista de cámara sin mutear', () => {
    expect(persona({ identity: 'a', name: 'Ana', tracks: [mic], attributes: { ensordecido: '1' } }, [])).toEqual({ id: 'a', name: 'Ana', silenciado: false, ensordecido: true, camara: false });
    expect(persona({ identity: 'b', name: 'Beto', tracks: [mic, cam], attributes: {} }, [])).toMatchObject({ ensordecido: false, camara: true });
    expect(persona({ identity: 'c', name: 'Caro', tracks: [{ source: 1, muted: false }] }, [])).toMatchObject({ silenciado: true, camara: true });
    expect(persona({ identity: 'd', name: 'Dani', tracks: [mic, { ...cam, muted: true }], attributes: { ensordecido: '' } }, ['d'])).toMatchObject({ silenciado: true, ensordecido: false, camara: false });
  });
});

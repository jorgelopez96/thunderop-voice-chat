import { describe, it, expect } from 'vitest';
import { anteponer } from './chat.svelte';

describe('anteponer', () => {
  it('pagina solapada deja una sola copia y conserva el orden', () => {
    const r = anteponer([{ id: 'c' }, { id: 'd' }], [{ id: 'b' }, { id: 'c' }]);
    expect(r.map((m) => m.id)).toEqual(['b', 'c', 'd']);
  });
});

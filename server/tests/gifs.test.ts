import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { startPocketBase, type Harness } from './harness';

// GIPHY falso: responde lo mínimo y anota qué se pidió.
let pedidos: string[] = [];
let giphy: Server;
let h: Harness;
beforeAll(async () => {
  giphy = createServer((req, res) => {
    pedidos.push(req.url ?? '');
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ data: [
      { id: 'a', title: 'gato', images: { fixed_height: { url: 'https://media1.giphy.com/media/a/200.gif' }, fixed_height_small: { url: 'https://media1.giphy.com/media/a/100.gif' } } },
      { id: 'b', title: 'raro', images: { fixed_height: { url: 'https://evil.com/x.gif' } } },
    ] }));
  });
  await new Promise<void>((ok) => giphy.listen(0, '127.0.0.1', ok));
  h = await startPocketBase({ env: { GIPHY_KEY: 'clave', GIPHY_API: `http://127.0.0.1:${(giphy.address() as AddressInfo).port}` } });
});
afterAll(async () => { await h.stop(); giphy.close(); });

describe('gifs', () => {
  it('busca, filtra lo que no es de GIPHY y sin texto trae tendencias', async () => {
    const a = await h.nuevoUsuario('ana');
    const r = await a.send('/api/gifs', { query: { q: 'gato' } });
    expect(r.gifs).toEqual([{ id: 'a', titulo: 'gato', url: 'https://media1.giphy.com/media/a/200.gif', previa: 'https://media1.giphy.com/media/a/100.gif' }]);
    expect(pedidos.at(-1)).toContain('/v1/gifs/search?api_key=clave&q=gato');
    await a.send('/api/gifs', {});
    expect(pedidos.at(-1)).toContain('/v1/gifs/trending');
  });
});

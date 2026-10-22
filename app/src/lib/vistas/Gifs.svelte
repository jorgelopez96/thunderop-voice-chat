<script lang="ts">
  import { pb } from '../pb';
  import { mensajeError } from '../sesion.svelte';

  // Buscador de GIFs (GIPHY, por el servidor). Al elegir uno se manda su link y se cierra.
  let { elegir }: { elegir: (url: string) => void } = $props();
  type Gif = { id: string; titulo: string; url: string; previa: string };
  let q = $state('');
  let gifs = $state<Gif[]>([]);
  let error = $state('');
  let cargando = $state(false);
  let pedido = 0;
  // Espera a que se deje de escribir (y arranca con los que están en tendencia).
  $effect(() => {
    const texto = q.trim();
    const t = setTimeout(() => buscar(texto), texto ? 350 : 0);
    return () => clearTimeout(t);
  });
  async function buscar(texto: string) {
    const mio = ++pedido;
    cargando = true; error = '';
    try {
      const r = await pb.send('/api/gifs', { query: texto ? { q: texto } : {}, requestKey: null });
      if (mio === pedido) gifs = r.gifs;
    } catch (e) { if (mio === pedido) error = mensajeError(e); }
    finally { if (mio === pedido) cargando = false; }
  }
</script>

<div class="gifs">
  <!-- svelte-ignore a11y_autofocus -->
  <input bind:value={q} placeholder="Buscar en GIPHY" aria-label="Buscar GIF" autofocus />
  {#if error}<p role="alert">{error}</p>{/if}
  <div class="grilla" aria-busy={cargando}>
    {#each gifs as g (g.id)}
      <button class="plano" title={g.titulo} onclick={() => elegir(g.url)}><img src={g.previa} alt={g.titulo} loading="lazy" referrerpolicy="no-referrer" /></button>
    {:else}{#if !cargando && !error}<p class="tenue">No hay GIFs con eso.</p>{/if}{/each}
  </div>
  <small class="marca">Con la tecnología de GIPHY</small>
</div>

<style>
  .gifs { display: flex; flex-direction: column; gap: 8px; width: 360px; max-height: 420px; }
  .grilla { flex: 1; min-height: 120px; overflow-y: auto; columns: 2; column-gap: 6px; }
  .grilla button { display: block; width: 100%; padding: 0; margin-bottom: 6px; border-radius: var(--radio); overflow: hidden; break-inside: avoid; }
  .grilla img { display: block; width: 100%; }
  .tenue { color: var(--tenue); font-size: 13px; }
  .marca { font-size: 10px; text-align: right; }
</style>

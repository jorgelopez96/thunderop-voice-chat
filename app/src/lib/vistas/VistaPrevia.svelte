<script lang="ts">
  import { pb } from '../pb';
  import { abrirLink } from '../links';

  // Tarjeta con título, descripción e imagen del link (la lee el servidor). Si no hay nada que mostrar, no aparece.
  type Vista = { titulo: string; descripcion: string; imagen: string; sitio: string };
  let { url }: { url: string } = $props();
  let v = $state<Vista | null>(null);
  $effect(() => {
    const u = url;
    let vivo = true;
    traer(u).then((x) => { if (vivo) v = x; });
    return () => { vivo = false; };
  });
</script>

<script module lang="ts">
  // Una sola vez por link mientras la app está abierta (el chat se re-dibuja seguido).
  const cache = new Map<string, Promise<{ titulo: string; descripcion: string; imagen: string; sitio: string } | null>>();
  function traer(url: string) {
    let p = cache.get(url);
    if (!p) cache.set(url, p = pb.send('/api/vista-previa', { query: { url }, requestKey: null }).then((x) => (x.titulo || x.imagen ? x : null), () => null));
    return p;
  }
</script>

{#if v}
  <button class="plano vista" onclick={() => abrirLink(url)} title={url}>
    <span class="textos">
      <small>{v.sitio}</small>
      {#if v.titulo}<strong>{v.titulo}</strong>{/if}
      {#if v.descripcion}<span class="desc">{v.descripcion}</span>{/if}
    </span>
    {#if v.imagen}<img src={v.imagen} alt="" loading="lazy" referrerpolicy="no-referrer" />{/if}
  </button>
{/if}

<style>
  .vista { display: flex; flex-direction: column-reverse; align-items: stretch; gap: 8px; max-width: 420px; margin-top: 6px; padding: 10px 12px; text-align: left;
    background: var(--panel); border: 0; border-left: 3px solid var(--acento); border-radius: var(--radio); color: var(--texto); }
  .textos { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  small { font-size: 11px; color: var(--tenue); }
  strong { font-size: 14px; color: var(--acento); }
  .desc { font-size: 13px; color: var(--tenue); display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  img { width: 100%; max-height: 220px; object-fit: cover; border-radius: var(--radio); }
</style>

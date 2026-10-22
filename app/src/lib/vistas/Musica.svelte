<script lang="ts">
  import { X } from '@lucide/svelte';
  import { musica, agregar, agregarLista, quitar } from '../musica/musica.svelte';
  import { idDeLista, videosDeLista, conTitulos, mezclar } from '../musica/lista';
  import { voz } from '../voz.svelte';

  // Contenido del panelcito de Música del dock: agregar links y ver la cola. Lo que suena va en la barra de la sala.
  let url = $state('');
  let aleatorio = $state(false);
  let leyendo = $state(''); // progreso al agregar una lista
  const lista = $derived(idDeLista(url.trim()));
  async function enviar(e: SubmitEvent) {
    e.preventDefault();
    if (!lista) { if (await agregar(url.trim())) url = ''; return; }
    musica.error = '';
    try {
      leyendo = 'Leyendo la lista…';
      let ids = await videosDeLista(lista);
      if (aleatorio) ids = mezclar(ids);
      leyendo = `Buscando los títulos de ${ids.length} temas…`;
      if (await agregarLista(await conTitulos(ids))) url = '';
    } catch (err) { musica.error = err instanceof Error ? err.message : 'No se pudo leer la lista.'; }
    finally { leyendo = ''; }
  }
  const enCola = $derived(musica.cola);
</script>

<div class="musica">
  <h3>Música</h3>
  <form class="fila" onsubmit={enviar}>
    <input bind:value={url} required placeholder="Pegá un link de YouTube (video o lista)" aria-label="Pegá un link de YouTube" />
    <button type="submit" class="primario" disabled={!voz.salaId || voz.conectando || !!leyendo}>Agregar</button>
  </form>
  {#if lista}<label class="casilla"><input type="checkbox" bind:checked={aleatorio} /> Es una lista: agregarla mezclada</label>{/if}
  {#if leyendo}<p class="tenue" role="status">{leyendo}</p>{/if}
  {#if musica.error}<p role="alert">{musica.error}</p>{/if}
  {#if enCola.length}
    <ul>
      {#each enCola as c (c.id)}
        <li>
          <span class="titulo">{c.titulo}{c.estado === 'error' ? ' — No se puede reproducir acá' : ''}</span>
          {#if c.estado !== 'error'}<button class="icono" aria-label={`Quitar ${c.titulo}`} title="Quitar" onclick={() => quitar(c.id)}><X size={14} strokeWidth={1.75} /></button>{/if}
        </li>
      {/each}
    </ul>
  {:else}<p class="tenue">No hay canciones en la cola.</p>{/if}
</div>

<style>
  .musica { display: flex; flex-direction: column; gap: 12px; }
  h3 { margin: 0; }
  .fila { display: flex; gap: 8px; align-items: center; }
  .fila input { flex: 1; }
  ul { display: flex; flex-direction: column; max-height: 40vh; overflow-y: auto; }
  li { display: flex; align-items: center; gap: 8px; min-height: 36px; border-top: 1px solid var(--borde); }
  li:first-child { border-top: 0; }
  .titulo { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; }
  .casilla { flex-direction: row; align-items: center; gap: 8px; font-size: 13px; }
  .tenue { margin: 0; color: var(--tenue); font-size: 13px; }
</style>

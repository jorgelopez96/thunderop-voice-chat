<script lang="ts">
  import { X } from '@lucide/svelte';
  import { musica, agregar, quitar } from '../musica/musica.svelte';
  import { voz } from '../voz.svelte';

  // Contenido del panelcito de Música del dock: agregar links y ver la cola. Lo que suena va en la barra de la sala.
  let url = $state('');
  async function enviar(e: SubmitEvent) {
    e.preventDefault();
    if (await agregar(url.trim())) url = '';
  }
  const enCola = $derived(musica.cola);
</script>

<div class="musica">
  <h3>Música</h3>
  <form class="fila" onsubmit={enviar}>
    <input bind:value={url} required placeholder="Pegá un link de YouTube" aria-label="Pegá un link de YouTube" />
    <button type="submit" class="primario" disabled={!voz.salaId || voz.conectando}>Agregar</button>
  </form>
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
  .tenue { margin: 0; color: var(--tenue); font-size: 13px; }
</style>

<script lang="ts">
  import { tick } from 'svelte';
  import { ChevronDown, ChevronUp, X } from '@lucide/svelte';
  import { musica, agregar, agregarLista, quitar, vaciar, ordenar, movible } from '../musica/musica.svelte';
  import Confirmar from './Confirmar.svelte';
  import { idDeLista, videosDeLista, conTitulos, mezclar, mover } from '../musica/lista';
  import { voz } from '../voz.svelte';
  import { pantalla } from '../plataforma.svelte';

  // Contenido del panelcito de Música del dock: agregar links y ver la cola. Lo que suena va en la píldora del dock (AhoraSuena).
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
  let vaciando = $state(false);

  // Reordenar: arrastrando (como las salas en Grupo) o con las flechitas. Las posiciones son entre las movibles.
  const movibles = $derived(enCola.filter(movible));
  const pos = (id: string | null) => movibles.findIndex((c) => c.id === id);
  let ul = $state<HTMLUListElement>();
  let arrastrada = $state<string | null>(null);
  let sobre = $state<string | null>(null);
  function llevar(id: string, a: number) {
    const de = pos(id);
    if (de >= 0 && a >= 0 && a < movibles.length && de !== a) void ordenar(mover(movibles, de, a));
  }
  /** Con las flechitas el foco sigue a la canción (si llegó a la punta, pasa a la otra flecha). */
  async function correr(id: string, paso: -1 | 1) {
    llevar(id, pos(id) + paso);
    await tick();
    const flecha = (p: number) => ul?.querySelector<HTMLButtonElement>(`[data-id="${id}"] [data-paso="${p}"]`);
    const f = flecha(paso);
    (f && !f.disabled ? f : flecha(-paso))?.focus();
  }
  function soltar(destino: string) {
    const r = arrastrada;
    arrastrada = sobre = null;
    if (r) llevar(r, pos(destino));
  }
</script>

<div class="musica">
  <div class="cabecera"><h3>Música</h3>
    {#if musica.actual || enCola.length}<button class="plano peligro chico" onclick={() => (vaciando = true)}>Quitar todas</button>{/if}</div>
  <form class="fila" onsubmit={enviar}>
    <input bind:value={url} required placeholder="Pegá un link de YouTube (video o lista)" aria-label="Pegá un link de YouTube" />
    <button type="submit" class="primario" disabled={!voz.salaId || voz.conectando || !!leyendo}>Agregar</button>
  </form>
  {#if lista}<label class="casilla"><input type="checkbox" bind:checked={aleatorio} /> Es una lista: agregarla mezclada</label>{/if}
  {#if leyendo}<p class="tenue" role="status">{leyendo}</p>{/if}
  {#if musica.error}<p role="alert">{musica.error}</p>{/if}
  {#if enCola.length}
    <ul bind:this={ul} aria-label="Canciones de la sala">
      {#each enCola as c (c.id)}
        {@const i = pos(c.id)}
        <li data-id={c.id} draggable={i >= 0 && !pantalla.movil} class:arriba={sobre === c.id && pos(arrastrada) > i} class:abajo={sobre === c.id && pos(arrastrada) < i}
          ondragstart={(e) => { arrastrada = c.id; e.dataTransfer?.setData('text/plain', c.id); }}
          ondragover={(e) => { if (arrastrada && i >= 0) { e.preventDefault(); sobre = c.id; } }}
          ondragleave={() => sobre === c.id && (sobre = null)} ondrop={(e) => { e.preventDefault(); soltar(c.id); }} ondragend={() => (arrastrada = sobre = null)}>
          <span class="titulo" class:sonando={c.estado === 'sonando'}>{c.titulo}{c.estado === 'error' ? ' — No se puede reproducir acá' : ''}</span>
          {#if c.estado === 'sonando'}<small class="tenue">Sonando</small>{/if}
          {#if i >= 0 && movibles.length > 1}
            <button class="icono chica" data-paso="-1" disabled={i === 0} aria-label={`Subir ${c.titulo}`} title="Subir" onclick={() => correr(c.id, -1)}><ChevronUp size={14} strokeWidth={1.75} /></button>
            <button class="icono chica" data-paso="1" disabled={i === movibles.length - 1} aria-label={`Bajar ${c.titulo}`} title="Bajar" onclick={() => correr(c.id, 1)}><ChevronDown size={14} strokeWidth={1.75} /></button>
          {/if}
          {#if c.estado !== 'error'}<button class="icono" aria-label={`Quitar ${c.titulo}`} title="Quitar" onclick={() => quitar(c.id)}><X size={14} strokeWidth={1.75} /></button>{/if}
        </li>
      {/each}
    </ul>
  {:else}<p class="tenue">No hay canciones en la cola.</p>{/if}
</div>
{#if vaciando}
  <Confirmar texto="¿Quitar todas las canciones? Se corta la que suena y se vacía la cola para todos." accion="Quitar todas"
    cancelar={() => (vaciando = false)} confirmar={() => { vaciando = false; void vaciar(); }} />
{/if}

<style>
  .musica { display: flex; flex-direction: column; gap: 12px; }
  h3 { margin: 0; }
  .cabecera { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .chico { padding: 4px 8px; font-size: 13px; }
  .fila { display: flex; gap: 8px; align-items: center; }
  .fila input { flex: 1; }
  ul { display: flex; flex-direction: column; max-height: 40vh; overflow-y: auto; }
  li { display: flex; align-items: center; gap: 8px; min-height: 36px; border-top: 1px solid var(--borde); }
  li:first-child { border-top: 0; }
  li[draggable='true'] { cursor: grab; }
  li.arriba { box-shadow: inset 0 2px var(--acento); }
  li.abajo { box-shadow: inset 0 -2px var(--acento); }
  .icono.chica { min-width: 28px; min-height: 28px; }
  .titulo.sonando { color: var(--acento-texto); font-weight: 600; }
  .titulo { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; }
  .casilla { flex-direction: row; align-items: center; gap: 8px; font-size: 13px; }
  .tenue { margin: 0; color: var(--tenue); font-size: 13px; }
</style>

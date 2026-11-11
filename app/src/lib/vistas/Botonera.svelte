<script lang="ts">
  import { lleno } from '../rango';
  import type { RecordModel } from 'pocketbase';
  import { Search, Volume2, Plus, Trash2 } from '@lucide/svelte';
  import Confirmar from './Confirmar.svelte';
  import SubirSonido from './SubirSonido.svelte';
  import { sonidos, sonidosDeOtros, tocar, borrar } from '../botonera.svelte';
  import { grupos } from '../grupos.svelte';
  import { voz } from '../voz.svelte';
  import { leerPrefs, guardarPrefs } from '../prefs';

  // Contenido del panelcito de Sonidos del dock. Quien lo usa lo recrea por grupo ({#key}).
  // `puedeEditar`, `puedeBorrar` y `puedeSubir` salen de los permisos del grupo (permisos.ts): botonera, borrarSonidos y subirSonidos.
  let { grupoId, puedeEditar, puedeBorrar, puedeSubir }: { grupoId: string; puedeEditar: (x: RecordModel) => boolean; puedeBorrar: (x: RecordModel) => boolean; puedeSubir: boolean } = $props();
  let aBorrar = $state<RecordModel | null>(null);
  let errorBorrar = $state('');
  // svelte-ignore state_referenced_locally
  const s = sonidos(grupoId);
  $effect(() => s.parar);
  let nuevo = $state(false); // el modal de subir está abierto
  let editando = $state<RecordModel | null>(null); // clic derecho: nombre y volumen (borrar, solo en Configuraciones)
  let vol = $state(Math.round(leerPrefs().volBotonera * 100));
  let busqueda = $state('');
  // Pestañas: el grupo de la llamada primero y después mis otros grupos que tengan sonidos. En los ajenos solo se toca.
  // svelte-ignore state_referenced_locally
  const otros = sonidosDeOtros(grupoId);
  $effect(() => otros.parar);
  // svelte-ignore state_referenced_locally
  let pestana = $state(grupoId);
  const pestanas = $derived([grupoId, ...grupos.lista.filter((g) => g.id !== grupoId && otros.estado.lista.some((x) => x.group === g.id)).map((g) => g.id)]);
  const nombreDe = (id: string) => grupos.lista.find((g) => g.id === id)?.name ?? 'Grupo';
  const propia = $derived(pestana === grupoId);
  const lista = $derived(propia ? s.estado.lista : otros.estado.lista.filter((x) => x.group === pestana));
  const visibles = $derived(lista.filter((x) => x.name.toLowerCase().includes(busqueda.trim().toLowerCase())));
</script>

<div class="botonera">
  {#if pestanas.length > 1}
    <div class="pestanas" role="tablist" aria-label="Sonidos de tus grupos">
      {#each pestanas as id (id)}<button role="tab" class="plano" aria-selected={pestana === id} onclick={() => (pestana = id)}>{id === grupoId ? 'Este grupo' : nombreDe(id)}</button>{/each}
    </div>
  {/if}
  <div class="arriba">
    <label class="buscar"><Search size={16} strokeWidth={1.75} /><input bind:value={busqueda} placeholder="Buscá un sonido" aria-label="Buscar sonido" /></label>
    <span class="vol" title="Volumen de la botonera"><Volume2 size={16} strokeWidth={1.75} />
      <input type="range" min="0" max="100" step="5" bind:value={vol} style={lleno(vol, 0, 100)} aria-label="Volumen de la botonera" oninput={() => guardarPrefs({ volBotonera: vol / 100 })} /></span>
  </div>
  <ul class="grilla">
    {#each visibles as x (x.id)}
      <li oncontextmenu={(e) => { if (!propia || !puedeEditar(x)) return; e.preventDefault(); editando = x; }}>
        <!-- aria-disabled y no disabled: un botón disabled no recibe el clic derecho -->
        <button class="sonido" aria-disabled={!voz.salaId} onclick={() => voz.salaId && tocar(x)}>{x.name}</button>
        {#if propia && puedeBorrar(x)}<button class="icono tacho" aria-label={`Borrar ${x.name}`} title="Borrar sonido" onclick={() => (aBorrar = x)}><Trash2 size={13} strokeWidth={1.75} /></button>{/if}
      </li>
    {/each}
    {#if propia && puedeSubir}<li><button class="sonido nuevo" onclick={() => (nuevo = true)}><Plus size={16} strokeWidth={1.75} /> Nuevo sonido</button></li>{/if}
  </ul>
  {#if !lista.length}<p class="tenue">Todavía no hay sonidos en este grupo.</p>
  {:else if !visibles.length}<p class="tenue">Ningún sonido se llama así.</p>{/if}
</div>

{#if nuevo}<SubirSonido {grupoId} cerrar={() => (nuevo = false)} />{/if}
{#if editando}<SubirSonido {grupoId} sonido={editando} cerrar={() => (editando = null)} />{/if}
{#if aBorrar}<Confirmar texto={`¿Borrar el sonido "${aBorrar.name}"? Se borra para todo el grupo.`} accion="Borrar" cancelar={() => (aBorrar = null)}
  confirmar={() => { const x = aBorrar!; aBorrar = null; errorBorrar = ''; borrar(x.id).catch((e) => (errorBorrar = e?.message || 'No se pudo borrar el sonido.')); }} />{/if}
{#if errorBorrar}<p role="alert" class="tenue">{errorBorrar}</p>{/if}

<style>
  .grilla li { position: relative; }
  .tacho { position: absolute; top: 2px; right: 2px; min-height: 0; width: 20px; height: 20px; padding: 0; border-radius: 50%;
    background: rgb(8 9 13 / .75); color: var(--peligro); opacity: 0; transition: opacity var(--dur-rapida); }
  .grilla li:hover .tacho, .tacho:focus-visible { opacity: 1; }
  @media (pointer: coarse) { .tacho { opacity: 1; } }
  .pestanas { display: flex; gap: 4px; overflow-x: auto; scrollbar-width: none; margin-bottom: 6px; }
  .pestanas button { flex: none; min-height: 0; padding: 4px 10px; font-size: 12px; border-radius: var(--radio-pildora); color: var(--tenue); }
  .pestanas button[aria-selected='true'] { color: var(--texto); background: var(--acento-suave); }
  .botonera { display: flex; flex-direction: column; gap: 12px; }
  .arriba { display: flex; align-items: center; gap: 12px; }
  .buscar { flex: 1; flex-direction: row; align-items: center; gap: 8px; padding: 0 12px; background: var(--hondo); border: 1px solid var(--borde); border-radius: var(--radio); color: var(--tenue); }
  .buscar input { flex: 1; border: 0; background: none; padding: 8px 0; }
  .vol { display: flex; align-items: center; gap: 4px; color: var(--icono); }
  .vol input { width: 72px; padding: 0; border: 0; background: none; }
  .grilla { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; max-height: 50vh; overflow-y: auto; }
  .sonido { width: 100%; height: 48px; padding: 4px 8px; background: var(--superficie); border-color: transparent; font-size: 13px; line-height: 1.2; text-align: center; overflow: hidden; }
  .sonido:hover:not([aria-disabled='true']) { background: var(--hover); }
  .sonido[aria-disabled='true'] { opacity: .4; cursor: not-allowed; }
  .nuevo { display: flex; align-items: center; justify-content: center; gap: 4px; background: none; border: 1px dashed var(--punteado); color: var(--tenue); }
  .tenue { margin: 0; color: var(--tenue); font-size: 13px; }
</style>

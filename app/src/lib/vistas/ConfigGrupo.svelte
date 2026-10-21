<script lang="ts">
  import type { RecordModel } from 'pocketbase';
  import { ImagePlus, Plus, Trash2 } from '@lucide/svelte';
  import { pb } from '../pb';
  import { sesion, mensajeError } from '../sesion.svelte';
  import { borrarGrupo } from '../grupos.svelte';
  import Avatar from './Avatar.svelte';
  import Insignia from './Insignia.svelte';
  import BotonEmoji from './BotonEmoji.svelte';
  import SubirSonido from './SubirSonido.svelte';
  import { sonidos, editar, borrar } from '../botonera.svelte';

  // Configuraciones del grupo. General: foto, participantes y borrar (solo el dueño cambia foto y borra).
  // Sonidos: cada uno edita los que subió; el dueño, todos.
  // Borrar pide dos pasos: confirmar y escribir el nombre del grupo.
  let { grupo, cerrar }: { grupo: RecordModel; cerrar: () => void } = $props();
  let d = $state<HTMLDialogElement>();
  $effect(() => { d?.showModal(); });
  const soyDueno = $derived(grupo.owner === sesion.usuario?.id);
  const miembros = $derived((grupo.expand?.members ?? []) as RecordModel[]);
  let paso = $state<0 | 1 | 2>(0); // 0: nada, 1: ¿seguro?, 2: escribir el nombre
  let escrito = $state('');
  let error = $state('');
  let ocupado = $state(false);
  let solapa = $state<'general' | 'sonidos'>('general');
  // svelte-ignore state_referenced_locally
  const lista = sonidos(grupo.id);
  $effect(() => lista.parar);
  let nuevo = $state(false);
  const puedeEditar = (x: RecordModel) => soyDueno || x.owner === sesion.usuario?.id;
  function renombrar(x: RecordModel, name: string) {
    name = name.trim();
    if (name && name !== x.name) hacer(() => editar(x.id, { name }));
  }

  async function hacer(f: () => Promise<unknown>) {
    error = ''; ocupado = true;
    try { await f(); } catch (e) { error = mensajeError(e); } finally { ocupado = false; }
  }
  async function cambiarFoto(ev: Event) {
    const input = ev.currentTarget as HTMLInputElement;
    const f = input.files?.[0];
    input.value = '';
    if (!f) return;
    if (!f.type.startsWith('image/')) { error = 'La foto debe ser una imagen.'; return; }
    if (f.size > 2 * 1024 * 1024) { error = 'La foto supera los 2 MB.'; return; }
    const datos = new FormData();
    datos.append('foto', f);
    await hacer(() => pb.collection('groups').update(grupo.id, datos));
  }
</script>

<dialog class="config" bind:this={d} onclose={cerrar} onclick={(e) => e.target === d && d.close()}>
  <h2>Configuraciones de {grupo.name}</h2>
  <div class="solapas" role="tablist">
    <button role="tab" class="plano" aria-selected={solapa === 'general'} onclick={() => (solapa = 'general')}>General</button>
    <button role="tab" class="plano" aria-selected={solapa === 'sonidos'} onclick={() => (solapa = 'sonidos')}>Sonidos</button>
  </div>

  {#if solapa === 'sonidos'}
    <section>
      <h3>Sonidos — {lista.estado.lista.length}</h3>
      <ul class="sonidos">
        {#each lista.estado.lista as x (x.id)}
          {@const puede = puedeEditar(x)}
          <li>
            {#if puede}
              <input value={x.name} maxlength="30" aria-label="Nombre del sonido" onchange={(e) => renombrar(x, e.currentTarget.value)} />
              <BotonEmoji elegir={(e) => renombrar(x, x.name + e)} />
              <input type="range" min="5" max="200" step="5" value={x.volumen || 100} aria-label={`Volumen de ${x.name}`} title={`${x.volumen || 100}%`}
                onchange={(e) => hacer(() => editar(x.id, { volumen: +e.currentTarget.value }))} />
              <small>{x.volumen || 100}%</small>
              <button class="icono" title="Borrar" aria-label={`Borrar ${x.name}`} onclick={() => hacer(() => borrar(x.id))}><Trash2 size={14} strokeWidth={1.75} /></button>
            {:else}<span>{x.name}</span><small>{x.volumen || 100}%</small>{/if}
          </li>
        {:else}<li class="tenue">Todavía no hay sonidos en este grupo.</li>{/each}
      </ul>
      <button onclick={() => (nuevo = true)}><Plus size={16} strokeWidth={1.75} /> Nuevo sonido</button>
    </section>
    {#if nuevo}<SubirSonido grupoId={grupo.id} cerrar={() => (nuevo = false)} />{/if}
  {:else}

  <section>
    <h3>Foto del grupo</h3>
    <div class="foto">
      {#if grupo.foto}<img alt="" src={pb.files.getURL(grupo, grupo.foto, { thumb: '480x270' })} />
      {:else}<span class="sin-foto">Sin foto</span>{/if}
      {#if soyDueno}
        <label class="boton"><ImagePlus size={16} strokeWidth={1.75} /> Cambiar foto
          <input type="file" hidden accept="image/png,image/jpeg,image/webp,image/gif" onchange={cambiarFoto} /></label>
      {:else}<small>Solo el dueño puede cambiarla.</small>{/if}
    </div>
  </section>

  <section>
    <h3>Participantes — {miembros.length}</h3>
    <ul>
      {#each miembros as m (m.id)}
        <li><Avatar usuario={m} tam={28} /><span>{m.name}</span><Insignia usuario={m} dueno={m.id === grupo.owner} /></li>
      {/each}
    </ul>
  </section>

  {#if soyDueno}
    <section class="peligroso">
      <h3>Borrar el grupo</h3>
      {#if paso === 0}
        <p>Se borran todas las salas, los mensajes y los sonidos. No se puede deshacer.</p>
        <button class="peligro" onclick={() => (paso = 1)}>Borrar grupo</button>
      {:else if paso === 1}
        <p>¿Seguro que querés borrar <strong>{grupo.name}</strong>?</p>
        <div class="fila"><button class="peligro" onclick={() => (paso = 2)}>Sí, quiero borrarlo</button><button class="plano" onclick={() => (paso = 0)}>No</button></div>
      {:else}
        <label>Escribí <strong>{grupo.name}</strong> para confirmar
          <input bind:value={escrito} autocomplete="off" aria-label="Nombre del grupo para confirmar" /></label>
        <div class="fila">
          <button class="peligro" disabled={escrito.trim() !== grupo.name || ocupado} onclick={() => hacer(() => borrarGrupo(grupo.id))}>Borrar para siempre</button>
          <button class="plano" onclick={() => { paso = 0; escrito = ''; }}>Cancelar</button>
        </div>
      {/if}
    </section>
  {/if}

  {/if}

  {#if error}<p role="alert">{error}</p>{/if}
  <div class="fila fin"><button onclick={() => d?.close()}>Cerrar</button></div>
</dialog>

<style>
  .config { width: min(480px, 92vw); max-width: none; max-height: 85vh; overflow-y: auto; }
  .config[open] { display: flex; flex-direction: column; gap: 20px; }
  h2 { font-size: 18px; font-weight: 600; }
  h3 { margin: 0 0 8px; }
  .foto { display: flex; align-items: center; gap: 12px; }
  .foto img, .sin-foto { width: 128px; height: 72px; object-fit: cover; border-radius: var(--radio); background: var(--hondo); }
  .sin-foto { display: grid; place-items: center; color: var(--apagado); font-size: 12px; border: 1px dashed var(--punteado); }
  label.boton { flex-direction: row; color: var(--texto); font-size: 14px; }
  ul { display: flex; flex-direction: column; gap: 4px; max-height: 200px; overflow-y: auto; }
  li { display: flex; align-items: center; gap: 8px; }
  .peligroso { border: 1px solid color-mix(in srgb, var(--peligro) 40%, transparent); border-radius: var(--radio-tarjeta); padding: 12px; }
  .peligroso p { margin: 0 0 8px; color: var(--tenue); font-size: 13px; }
  .peligroso label { margin-bottom: 8px; }
  .fin { justify-content: flex-end; }
  .solapas { display: flex; gap: 4px; border-bottom: 1px solid var(--borde); }
  .solapas button { border-radius: var(--radio) var(--radio) 0 0; color: var(--tenue); }
  .solapas [aria-selected='true'] { color: var(--texto); box-shadow: inset 0 -2px var(--acento); }
  .sonidos { max-height: 50vh; margin-bottom: 8px; }
  .sonidos li > input:first-child, .sonidos li > span { flex: 1; min-width: 0; }
  .sonidos input[type='range'] { width: 96px; padding: 0; border: 0; background: none; }
  .sonidos small { width: 36px; color: var(--tenue); text-align: right; }
  .tenue { color: var(--tenue); font-size: 13px; }
</style>

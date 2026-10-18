<script lang="ts">
  import type { RecordModel } from 'pocketbase';
  import { sesion, mensajeError } from '../sesion.svelte';
  import { salas, crearInvitacion, crearSala, renombrarSala, borrarSala, borrarGrupo } from '../grupos.svelte';
  import Chat from './Chat.svelte';
  import Miembros from './Miembros.svelte';
  import Confirmar from './Confirmar.svelte';

  let { grupo, volver }: { grupo: RecordModel; volver: () => void } = $props();
  const soyDueno = $derived(grupo.owner === sesion.usuario?.id);
  // svelte-ignore state_referenced_locally
  const s = salas(grupo.id); // el componente se recrea por grupo (clave en Principal)
  $effect(() => s.parar);

  const chat = $derived(s.estado.lista.filter((r) => r.kind === 'chat'));
  const voz = $derived(s.estado.lista.filter((r) => r.kind === 'voz'));

  let salaId = $state<string | null>(null);
  const salaAbierta = $derived(chat.find((r) => r.id === salaId));
  let link = $state('');
  let error = $state('');
  let nueva = $state({ chat: '', voz: '' });
  let editando = $state<{ id: string; name: string } | null>(null);
  let confirmar = $state<null | { texto: string; hacer: () => Promise<void> }>(null);

  async function hacer(f: () => Promise<void>) {
    error = '';
    try { await f(); } catch (e) { error = mensajeError(e); }
  }
  async function invitar() {
    link = await crearInvitacion(grupo.id);
    try { await navigator.clipboard.writeText(link); } catch { /* sin permiso: el link queda visible */ }
  }
  async function agregar(kind: 'chat' | 'voz') {
    const name = nueva[kind].trim();
    if (!name) return;
    await crearSala(grupo.id, name, kind, s.estado.lista.length);
    nueva[kind] = '';
  }
  async function guardarNombre() {
    if (editando?.name.trim()) await renombrarSala(editando.id, editando.name.trim());
    editando = null;
  }
</script>

{#snippet sala(r: RecordModel, deshabilitada: boolean)}
  <li class="sala" class:activa={r.id === salaId}>
    {#if editando?.id === r.id}
      <input bind:value={editando.name} maxlength="40" />
      <button onclick={() => hacer(guardarNombre)}>Guardar</button>
      <button class="plano" onclick={() => (editando = null)}>Cancelar</button>
    {:else}
      <button class="plano nombre" disabled={deshabilitada} title={deshabilitada ? 'Disponible en la próxima versión' : undefined}
        onclick={() => (salaId = r.id)}>{r.kind === 'chat' ? '#' : '🔊'} {r.name}</button>
      {#if soyDueno}
        <span class="acciones">
          <button class="plano" title="Renombrar" aria-label="Renombrar" onclick={() => (editando = { id: r.id, name: r.name })}>✎</button>
          <button class="plano" title="Borrar sala" aria-label="Borrar sala" onclick={() => (confirmar = { texto: `¿Borrar la sala "${r.name}"?`, hacer: () => borrarSala(r.id) })}>✕</button>
        </span>
      {/if}
    {/if}
  </li>
{/snippet}

{#snippet nuevaSala(kind: 'chat' | 'voz')}
  {#if soyDueno}
    <form class="nueva" onsubmit={(e) => { e.preventDefault(); hacer(() => agregar(kind)); }}>
      <input placeholder={kind === 'chat' ? 'Nueva sala de chat' : 'Nueva sala de voz'} bind:value={nueva[kind]} maxlength="40" />
      <button class="plano" type="submit" aria-label={kind === 'chat' ? 'Crear sala de chat' : 'Crear sala de voz'}>＋</button>
    </form>
  {/if}
{/snippet}

<div class="grupo">
  <nav class="salas">
    <div class="cabecera">
      <button class="plano" onclick={volver} aria-label="Volver a grupos">←</button>
      <h2>{grupo.name}</h2>
    </div>
    <div class="fila">
      <button class="primario" onclick={() => hacer(invitar)}>Invitar</button>
      {#if soyDueno}<button class="plano" onclick={() => (confirmar = { texto: `¿Borrar el grupo "${grupo.name}"? Se pierden salas y mensajes.`, hacer: () => borrarGrupo(grupo.id) })}>Borrar grupo</button>{/if}
    </div>
    {#if link}<p role="status">Link copiado: <code data-testid="link-invitacion">{link}</code></p>{/if}
    {#if error}<p role="alert">{error}</p>{/if}

    <h3>Salas de chat</h3>
    <ul>{#each chat as r (r.id)}{@render sala(r, false)}{/each}</ul>
    {@render nuevaSala('chat')}

    <h3>Salas de voz</h3>
    <ul>{#each voz as r (r.id)}{@render sala(r, true)}{/each}</ul>
    {@render nuevaSala('voz')}
    <small>La voz llega en la próxima versión.</small>
  </nav>

  {#if salaAbierta}{#key salaAbierta.id}<Chat room={salaAbierta} {soyDueno} />{/key}
  {:else}<div class="vacio">Elegí una sala de chat</div>{/if}

  <Miembros {grupo} />
  {#if confirmar}
    <Confirmar texto={confirmar.texto} cancelar={() => (confirmar = null)}
      confirmar={() => { const c = confirmar!; confirmar = null; hacer(c.hacer); }} />
  {/if}
</div>

<style>
  .grupo { flex: 1; min-height: 0; display: grid; grid-template-columns: 240px 1fr 220px; }
  .salas { background: var(--panel); padding: 12px 8px; overflow-y: auto; display: flex; flex-direction: column; gap: 4px; }
  .cabecera { display: flex; align-items: center; gap: 4px; margin-bottom: 8px; }
  .cabecera h2 { font-size: 16px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .sala { display: flex; align-items: center; border-radius: var(--radio); }
  .sala:hover, .sala.activa { background: var(--hover); }
  .sala .nombre { flex: 1; text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .sala.activa .nombre { color: var(--texto); }
  .sala input { flex: 1; min-width: 0; padding: 4px 6px; }
  .acciones { opacity: 0; }
  .sala:hover .acciones, .sala:focus-within .acciones { opacity: 1; }
  .nueva { display: flex; }
  .nueva input { flex: 1; min-width: 0; padding: 4px 8px; font-size: 13px; }
  .vacio { display: grid; place-items: center; color: var(--tenue); }
</style>

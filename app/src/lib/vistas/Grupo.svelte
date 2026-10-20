<script lang="ts">
  import type { RecordModel } from 'pocketbase';
  import { untrack } from 'svelte';
  import { sesion, mensajeError } from '../sesion.svelte';
  import { pb } from '../pb';
  import { salas, enVoz, presencia, crearInvitacion, crearSala, renombrarSala, borrarSala, borrarGrupo } from '../grupos.svelte';
  import Chat from './Chat.svelte';
  import { abrirChat, enviar, borrar } from '../chat.svelte';
  import Participantes from './Participantes.svelte';
  import Voz from './Voz.svelte';
  import ControlesVoz from './ControlesVoz.svelte';
  import { voz, entrarVoz } from '../voz.svelte';
  import Confirmar from './Confirmar.svelte';

  let { grupo, volver }: { grupo: RecordModel; volver: () => void } = $props();
  const soyDueno = $derived(grupo.owner === sesion.usuario?.id);
  // svelte-ignore state_referenced_locally
  const s = salas(grupo.id); // el componente se recrea por grupo (clave en Principal)
  $effect(() => s.parar);
  // También al conectar/desconectar (incluye caídas). `presencia` lee `enVoz`: no debe volver a disparar esto.
  $effect(() => { voz.salaId; const id = grupo.id; untrack(() => presencia(id)); });

  const chat = $derived(s.estado.lista.filter((r) => r.kind === 'chat'));
  const salasVoz = $derived(s.estado.lista.filter((r) => r.kind === 'voz'));
  const salaVoz = $derived(salasVoz.find((r) => r.id === voz.salaId));

  let salaId = $state<string | null>(null);
  let centroVoz = $state(false); // el centro muestra la voz (si no, el chat elegido)
  const salaAbierta = $derived(chat.find((r) => r.id === salaId));
  let link = $state('');
  let error = $state('');
  let nueva = $state({ chat: '', voz: '' });
  let editando = $state<{ id: string; name: string } | null>(null);
  let confirmar = $state<null | { texto: string; hacer: () => Promise<void> }>(null);

  async function cambiarFoto(ev: Event) {
    const input = ev.currentTarget as HTMLInputElement;
    const f = input.files?.[0];
    input.value = '';
    if (!f) return;
    if (!f.type.startsWith('image/')) { error = 'La foto debe ser una imagen.'; return; }
    if (f.size > 2 * 1024 * 1024) { error = 'La foto supera los 2 MB.'; return; }
    const d = new FormData();
    d.append('foto', f);
    await hacer(async () => { await pb.collection('groups').update(grupo.id, d); });
  }

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
  async function abrir(r: RecordModel) {
    if (r.kind === 'chat') { salaId = r.id; centroVoz = false; return; }
    centroVoz = true;
    if (voz.salaId === r.id) return;
    await entrarVoz(r.id, r.name, grupo.id);
    presencia(grupo.id);
  }
  /** Quién está en la sala: en la tuya, los participantes en vivo; en otras, la presencia del servidor. */
  const quienes = (r: RecordModel) =>
    r.id === voz.salaId ? voz.participantes.map((p) => p.nombre) : (enVoz.grupo === grupo.id ? enVoz.salas[r.id] ?? [] : []).map((p) => p.name);
  async function guardarNombre() {
    if (editando?.name.trim()) await renombrarSala(editando.id, editando.name.trim());
    editando = null;
  }
</script>

{#snippet sala(r: RecordModel)}
  <li class="sala" class:activa={r.kind === 'chat' ? r.id === salaId && !centroVoz : r.id === voz.salaId && centroVoz}>
    {#if editando?.id === r.id}
      <input bind:value={editando.name} maxlength="40" />
      <button onclick={() => hacer(guardarNombre)}>Guardar</button>
      <button class="plano" onclick={() => (editando = null)}>Cancelar</button>
    {:else}
      <button class="plano nombre" onclick={() => hacer(() => abrir(r))}>{r.kind === 'chat' ? '#' : '🔊'} {r.name}</button>
      {#if soyDueno}
        <span class="acciones">
          <button class="plano" title="Renombrar" aria-label="Renombrar" onclick={() => (editando = { id: r.id, name: r.name })}>✎</button>
          <button class="plano" title="Borrar sala" aria-label="Borrar sala" onclick={() => (confirmar = { texto: `¿Borrar la sala "${r.name}"?`, hacer: () => borrarSala(r.id) })}>✕</button>
        </span>
      {/if}
    {/if}
    {#if r.kind === 'voz' && quienes(r).length}
      <ul class="quienes">{#each quienes(r) as n}<li>{n}</li>{/each}</ul>
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
      {#if soyDueno}<label class="plano foto" title="Foto del grupo (imagen hasta 2 MB)">Foto <input type="file" hidden accept="image/png,image/jpeg,image/webp,image/gif" onchange={cambiarFoto} /></label>{/if}
      {#if soyDueno}<button class="plano" onclick={() => (confirmar = { texto: `¿Borrar el grupo "${grupo.name}"? Se pierden salas y mensajes.`, hacer: () => borrarGrupo(grupo.id) })}>Borrar grupo</button>{/if}
    </div>
    {#if link}<p role="status">Link copiado: <code data-testid="link-invitacion">{link}</code></p>{/if}
    {#if error}<p role="alert">{error}</p>{/if}

    <h3>Salas de chat</h3>
    <ul>{#each chat as r (r.id)}{@render sala(r)}{/each}</ul>
    {@render nuevaSala('chat')}

    <h3>Salas de voz</h3>
    <ul>{#each salasVoz as r (r.id)}{@render sala(r)}{/each}</ul>
    {@render nuevaSala('voz')}
    {#if voz.salaId}<ControlesVoz alSalir={() => { centroVoz = false; presencia(grupo.id); }} />{/if}
  </nav>

  {#if centroVoz && salaVoz}<Voz {grupo} {soyDueno} sala={salaVoz.name} />
  {:else if salaAbierta}{#key salaAbierta.id}<Chat titulo={`# ${salaAbierta.name}`} abrir={() => abrirChat(salaAbierta.id)} enviar={(t, f) => enviar(salaAbierta.id, t, f)} {borrar}
    puedeBorrar={(m) => m.author === sesion.usuario?.id || soyDueno} />{/key}
  {:else}<div class="vacio">Elegí una sala de chat</div>{/if}

  <Participantes {grupo} />
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
  .sala { display: flex; flex-wrap: wrap; align-items: center; border-radius: var(--radio); }
  .sala:hover, .sala.activa { background: var(--hover); }
  .sala .nombre { flex: 1; text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .sala.activa .nombre { color: var(--texto); }
  .sala input { flex: 1; min-width: 0; padding: 4px 6px; }
  .quienes { flex-basis: 100%; padding: 0 0 4px 28px; font-size: 13px; color: var(--tenue); }
  .acciones { opacity: 0; }
  .sala:hover .acciones, .sala:focus-within .acciones { opacity: 1; }
  .nueva { display: flex; }
  .nueva input { flex: 1; min-width: 0; padding: 4px 8px; font-size: 13px; }
  .vacio { display: grid; place-items: center; color: var(--tenue); }
</style>

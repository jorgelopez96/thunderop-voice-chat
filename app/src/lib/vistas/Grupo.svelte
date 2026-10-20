<script lang="ts">
  import type { RecordModel } from 'pocketbase';
  import { untrack } from 'svelte';
  import { sesion, mensajeError } from '../sesion.svelte';
  import { pb } from '../pb';
  import { salas, enVoz, presencia, crearInvitacion, crearSala, renombrarSala, borrarSala } from '../grupos.svelte';
  import Chat from './Chat.svelte';
  import { abrirChat, enviar, borrar } from '../chat.svelte';
  import Participantes from './Participantes.svelte';
  import Voz from './Voz.svelte';
  import { voz, entrarVoz } from '../voz.svelte';
  import Confirmar from './Confirmar.svelte';
  import { ChevronDown, Plus, Hash, UserPlus, Pencil, X, Check, Settings } from '@lucide/svelte';
  import ConfigGrupo from './ConfigGrupo.svelte';
  import { foto } from '../foto';
  import { grupos, grupoActual } from '../grupos.svelte';
  import { noLeidos, mirar } from '../noLeidos.svelte';

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
  $effect(() => { if (!voz.salaId) centroVoz = false; }); // salir desde el dock vuelve al chat
  let capaParticipantes = $state<HTMLElement>(); // en la sala de voz, Participantes se abre encima
  const enSalaVoz = $derived(centroVoz && !!salaVoz);
  const salaAbierta = $derived(chat.find((r) => r.id === salaId));
  $effect(() => { if (salaAbierta && !centroVoz) return mirar(salaAbierta.id); });
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
  async function abrir(r: RecordModel) {
    if (r.kind === 'chat') { salaId = r.id; centroVoz = false; return; }
    centroVoz = true;
    if (voz.salaId === r.id) return;
    await entrarVoz(r.id, r.name, grupo.id);
    presencia(grupo.id);
  }
  /** Quién está en la sala: en la tuya, los participantes en vivo; en otras, la presencia del servidor. */
  const quienes = (r: RecordModel): { id: string; nombre: string }[] =>
    r.id === voz.salaId ? voz.participantes : (enVoz.grupo === grupo.id ? enVoz.salas[r.id] ?? [] : []).map((p) => ({ id: p.id, nombre: p.name }));
  const miembro = (id: string) => ((grupo.expand?.members ?? []) as RecordModel[]).find((m) => m.id === id);
  let menuGrupo = $state<HTMLElement>();
  let creando = $state<'chat' | 'voz' | null>(null);
  let config = $state(false);
  async function guardarNombre() {
    if (editando?.name.trim()) await renombrarSala(editando.id, editando.name.trim());
    editando = null;
  }
</script>

{#snippet sala(r: RecordModel)}
  {@const q = r.kind === 'voz' ? quienes(r) : []}
  <li class="sala" class:activa={r.kind === 'chat' ? r.id === salaId && !centroVoz : r.id === voz.salaId && centroVoz}>
    {#if editando?.id === r.id}
      <form class="renombrar" onsubmit={(e) => { e.preventDefault(); hacer(guardarNombre); }}>
        <input bind:value={editando.name} maxlength="40" aria-label="Nuevo nombre de la sala" onkeydown={(e) => e.key === 'Escape' && (editando = null)} />
        <button class="icono" type="submit" aria-label="Guardar" title="Guardar"><Check size={16} strokeWidth={1.75} /></button>
        <button class="icono" type="button" aria-label="Cancelar" title="Cancelar" onclick={() => (editando = null)}><X size={16} strokeWidth={1.75} /></button>
      </form>
    {:else}
      <button class="plano nombre" aria-label={`${r.kind === 'chat' ? 'Sala de chat' : 'Sala de voz'} ${r.name}`} onclick={() => hacer(() => abrir(r))}>
        {#if r.kind === 'chat'}<Hash size={16} strokeWidth={1.75} />{/if}<span>{r.name}</span>
        {#if r.kind === 'voz'}<small class:verde={q.length}>{q.length ? `${q.length} en voz` : 'vacía'}</small>{/if}
        {#if noLeidos.salas[r.id]}<span class="contador" aria-label={`${noLeidos.salas[r.id]} sin leer`}>{noLeidos.salas[r.id]}</span>{/if}
      </button>
      {#if soyDueno}
        <span class="acciones">
          <button class="icono" title="Renombrar" aria-label="Renombrar" onclick={() => (editando = { id: r.id, name: r.name })}><Pencil size={14} strokeWidth={1.75} /></button>
          <button class="icono" title="Borrar sala" aria-label="Borrar sala" onclick={() => (confirmar = { texto: `¿Borrar la sala "${r.name}"?`, hacer: () => borrarSala(r.id) })}><X size={14} strokeWidth={1.75} /></button>
        </span>
      {/if}
    {/if}
    {#if q.length}
      <ul class="quienes">{#each q as p (p.id)}{@const m = miembro(p.id)}
        <li title={p.nombre} style="background:{m?.color || ''}"><img alt="" src={foto(m)} /></li>
      {/each}</ul>
    {/if}
  </li>
{/snippet}

{#snippet titulo(kind: 'chat' | 'voz', texto: string)}
  <div class="seccion-salas"><h3>{texto}</h3>
    {#if soyDueno}<button class="icono" aria-label={kind === 'chat' ? 'Nueva sala de chat' : 'Nueva sala de voz'} title="Nueva sala" onclick={() => (creando = creando === kind ? null : kind)}><Plus size={14} strokeWidth={1.75} /></button>{/if}
  </div>
{/snippet}

{#snippet nuevaSala(kind: 'chat' | 'voz')}
  {#if soyDueno && creando === kind}
    <form class="nueva" onsubmit={(e) => { e.preventDefault(); hacer(() => agregar(kind)); }}>
      <input placeholder={kind === 'chat' ? 'Nueva sala de chat' : 'Nueva sala de voz'} bind:value={nueva[kind]} maxlength="40" />
      <button class="icono" type="submit" aria-label={kind === 'chat' ? 'Crear sala de chat' : 'Crear sala de voz'}><Plus size={14} strokeWidth={1.75} /></button>
    </form>
  {/if}
{/snippet}

<div class="grupo" class:enSalaVoz>
  <nav class="salas">
    <button class="plano cabecera" onclick={(e) => { const r = e.currentTarget.getBoundingClientRect(); menuGrupo!.style.left = `${r.left}px`; menuGrupo!.style.top = `${r.bottom + 4}px`; menuGrupo?.showPopover(); }}>
      <h2>{grupo.name}</h2><ChevronDown size={16} strokeWidth={1.75} />
    </button>
    {#if link}<p role="status" class="link">Link copiado: <code data-testid="link-invitacion">{link}</code></p>{/if}
    {#if error}<p role="alert">{error}</p>{/if}

    {@render titulo('voz', 'Salas de voz')}
    <ul>{#each salasVoz as r (r.id)}{@render sala(r)}{/each}</ul>
    {@render nuevaSala('voz')}

    {@render titulo('chat', 'Chats')}
    <ul>{#each chat as r (r.id)}{@render sala(r)}{/each}</ul>
    {@render nuevaSala('chat')}

  </nav>

  <!-- Menú del nombre del grupo: invitar, configuraciones y cambiar de grupo. Borrar va adentro de Configuraciones (a propósito, lejos). -->
  <div popover class="menu" bind:this={menuGrupo}>
    <button class="plano" onclick={() => { menuGrupo?.hidePopover(); hacer(invitar); }}><UserPlus size={16} strokeWidth={1.75} /> Invitar al grupo</button>
    <button class="plano" onclick={() => { menuGrupo?.hidePopover(); config = true; }}><Settings size={16} strokeWidth={1.75} /> Configuraciones</button>
    {#if grupos.lista.length > 1}
      <hr /><small class="otros">Cambiar de grupo</small>
      {#each grupos.lista.filter((g) => g.id !== grupo.id) as g (g.id)}
        <button class="plano" onclick={() => { menuGrupo?.hidePopover(); grupoActual.id = g.id; }}>{g.name}</button>
      {/each}
    {/if}
  </div>
  {#if config}<ConfigGrupo {grupo} cerrar={() => (config = false)} />{/if}

  {#if enSalaVoz && salaVoz}<Voz {grupo} {soyDueno} sala={salaVoz.name} verParticipantes={() => capaParticipantes?.showPopover()} />
  {:else if salaAbierta}{#key salaAbierta.id}<Chat titulo={`# ${salaAbierta.name}`} abrir={() => abrirChat(salaAbierta.id)} enviar={(t, f, r) => enviar(salaAbierta.id, t, f, r)} {borrar}
    puedeBorrar={(m) => m.author === sesion.usuario?.id || soyDueno} />{/key}
  {:else}<div class="vacio">Elegí una sala de chat</div>{/if}

  {#if enSalaVoz}<div popover class="capa" bind:this={capaParticipantes}><Participantes {grupo} /></div>
  {:else}<Participantes {grupo} />{/if}
  {#if confirmar}
    <Confirmar texto={confirmar.texto} cancelar={() => (confirmar = null)}
      confirmar={() => { const c = confirmar!; confirmar = null; hacer(c.hacer); }} />
  {/if}
</div>

<style>
  .grupo { flex: 1; min-height: 0; display: grid; grid-template-columns: 232px 1fr 260px; }
  .grupo.enSalaVoz { grid-template-columns: 232px 1fr; }
  .capa { position: fixed; inset: 48px 0 56px auto; max-height: calc(100vh - 104px); margin: 0; width: 260px; padding: 0; border: 0; border-left: 1px solid var(--borde); background: var(--panel); color: var(--texto); }
  .capa:popover-open { display: grid; }
  .salas { background: var(--panel); padding: 16px 12px; overflow-y: auto; display: flex; flex-direction: column; gap: 2px; border-right: 1px solid var(--borde); }
  .cabecera { justify-content: space-between; padding: 6px 8px; margin-bottom: 12px; color: var(--texto); }
  .cabecera h2 { font-size: 16px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .seccion-salas { display: flex; align-items: center; justify-content: space-between; margin: 16px 0 4px; padding: 0 0 0 8px; }
  .seccion-salas h3 { margin: 0; }
  .sala { display: flex; flex-wrap: wrap; align-items: center; border-radius: var(--radio); }
  .sala:hover { background: var(--hover); }
  .sala.activa { background: var(--acento-suave); }
  .sala .nombre { flex: 1; min-width: 0; justify-content: flex-start; gap: 8px; padding: 8px; font-size: 14px; }
  .sala .nombre span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .sala .nombre small { margin-left: auto; font-size: 12px; color: var(--apagado); }
  .sala .nombre small.verde { color: var(--ok); }
  .sala.activa .nombre, .sala.activa .nombre:hover { color: var(--texto); background: none; }
  .contador { margin-left: auto; min-width: 20px; height: 20px; padding: 0 6px; border-radius: 999px; background: var(--acento); color: #fff; font-size: 11px; font-weight: 600; display: grid; place-items: center; }
  small + .contador { margin-left: 4px; }
  .quienes { flex-basis: 100%; display: flex; gap: 4px; padding: 0 8px 8px; }
  .quienes li { width: 22px; height: 22px; border-radius: 999px; background: var(--hover); display: grid; place-items: center; font-size: 11px; font-weight: 600; color: #fff; overflow: hidden; }
  .quienes img { width: 100%; height: 100%; object-fit: cover; }
  .acciones { display: none; }
  .sala:hover .acciones, .sala:focus-within .acciones { display: flex; }
  .nueva { display: flex; gap: 4px; padding: 0 0 4px 8px; }
  .nueva input { flex: 1; min-width: 0; padding: 4px 8px; font-size: 13px; }
  .renombrar { flex: 1; min-width: 0; display: flex; align-items: center; gap: 2px; padding: 2px 4px; }
  .renombrar input { flex: 1; min-width: 0; padding: 4px 8px; }
  .link { font-size: 12px; margin: 0 0 8px; }
  .otros { padding: 4px 8px 0; font-size: 11px; }
  .vacio { display: grid; place-items: center; color: var(--tenue); }
  .menu { position: fixed; inset: auto; margin: 0; padding: 8px; min-width: 220px; flex-direction: column; gap: 2px;
    background: var(--elevado); color: var(--texto); border: 1px solid var(--borde); border-radius: var(--radio-menu); }
  .menu:popover-open { display: flex; }
  .menu button { justify-content: flex-start; }
  .menu hr { border: 0; border-top: 1px solid var(--borde); margin: 4px 0; width: 100%; }
</style>

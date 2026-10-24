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
  import { ChevronDown, Hash, UserPlus, Pencil, Trash2, Settings, Volume2 } from '@lucide/svelte';
  import { abrirEnPunto } from '../menu';
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
  let nueva = $state('');
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
    const name = nueva.trim();
    dlgNueva?.close();
    if (name) await crearSala(grupo.id, name, kind, s.estado.lista.length);
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
  let cabecera = $state<HTMLElement>();
  // Nueva sala (solo el dueño, desde el menú del grupo): modal con Cancelar, Esc o clic afuera.
  let creando = $state<'chat' | 'voz' | null>(null);
  let dlgNueva = $state<HTMLDialogElement>();
  $effect(() => { if (creando) { nueva = ''; dlgNueva?.showModal(); } });
  let config = $state(false);
  // Clic derecho en una sala (solo el dueño): cambiar nombre o borrar. El nombre se cambia en un modal.
  let menuSala = $state<RecordModel | null>(null);
  let menuSalaEl = $state<HTMLElement>();
  let dlgNombre = $state<HTMLDialogElement>();
  $effect(() => { if (editando) dlgNombre?.showModal(); });
  async function guardarNombre() {
    const e = editando;
    dlgNombre?.close();
    if (e?.name.trim()) await renombrarSala(e.id, e.name.trim());
  }
</script>

{#snippet sala(r: RecordModel)}
  {@const q = r.kind === 'voz' ? quienes(r) : []}
  <li class="sala" oncontextmenu={(e) => { if (!soyDueno) return; e.preventDefault(); menuSala = r; abrirEnPunto(menuSalaEl, e.clientX, e.clientY); }} class:activa={r.kind === 'chat' ? r.id === salaId && !centroVoz : r.id === voz.salaId && centroVoz}>
      <button class="plano nombre" aria-label={`${r.kind === 'chat' ? 'Sala de chat' : 'Sala de voz'} ${r.name}`} onclick={() => hacer(() => abrir(r))}>
        {#if r.kind === 'chat'}<Hash size={16} strokeWidth={1.75} />{/if}<span>{r.name}</span>
        {#if r.kind === 'voz'}<small class:verde={q.length}>{q.length ? `${q.length} en voz` : 'vacía'}</small>{/if}
        {#if noLeidos.salas[r.id]}<span class="contador" aria-label={`${noLeidos.salas[r.id]} sin leer`}>{noLeidos.salas[r.id]}</span>{/if}
      </button>
    {#if q.length}
      <ul class="quienes">{#each q as p (p.id)}{@const m = miembro(p.id)}
        <li title={p.nombre} style="background:{m?.color || ''}"><img alt="" src={foto(m)} /></li>
      {/each}</ul>
    {/if}
  </li>
{/snippet}

<!-- Tres puntitos del chat de una sala (dueño): cambiarle el nombre o borrarla. -->
{#snippet accionesSala(cerrar: () => void)}
  {#if salaAbierta}{@const r = salaAbierta}
    <button class="plano" onclick={() => { cerrar(); editando = { id: r.id, name: r.name }; }}><Pencil size={16} strokeWidth={1.75} /> Cambiar nombre</button>
    <button class="plano peligro" onclick={() => { cerrar(); confirmar = { texto: `¿Borrar la sala "${r.name}"?`, hacer: () => borrarSala(r.id) }; }}><Trash2 size={16} strokeWidth={1.75} /> Borrar sala</button>
  {/if}
{/snippet}

{#snippet titulo(texto: string)}
  <div class="seccion-salas"><h3>{texto}</h3></div>
{/snippet}

<div class="grupo" class:enSalaVoz>
  <nav class="salas">
    <!-- popovertarget: el navegador abre y cierra con el mismo botón (con onclick, el clic cerraba y volvía a abrir) -->
    <button class="plano cabecera" bind:this={cabecera} popovertarget="menu-grupo">
      <h2>{grupo.name}</h2><ChevronDown size={16} strokeWidth={1.75} />
    </button>
    {#if link}<p role="status" class="link">Link copiado: <code data-testid="link-invitacion">{link}</code></p>{/if}
    {#if error}<p role="alert">{error}</p>{/if}

    {@render titulo('Salas de voz')}
    <ul>{#each salasVoz as r (r.id)}{@render sala(r)}{/each}</ul>

    {@render titulo('Chats')}
    <ul>{#each chat as r (r.id)}{@render sala(r)}{/each}</ul>

  </nav>

  <!-- Menú del nombre del grupo: invitar, configuraciones y cambiar de grupo. Borrar va adentro de Configuraciones (a propósito, lejos). -->
  <div popover id="menu-grupo" class="menu" bind:this={menuGrupo}
    onbeforetoggle={(e) => { if (e.newState !== 'open' || !cabecera) return; const r = cabecera.getBoundingClientRect(); menuGrupo!.style.left = `${r.left}px`; menuGrupo!.style.top = `${r.bottom + 4}px`; }}>
    <button class="plano" onclick={() => { menuGrupo?.hidePopover(); hacer(invitar); }}><UserPlus size={16} strokeWidth={1.75} /> Invitar al grupo</button>
    {#if soyDueno}
      <button class="plano" onclick={() => { menuGrupo?.hidePopover(); creando = 'voz'; }}><Volume2 size={16} strokeWidth={1.75} /> Nueva sala de voz</button>
      <button class="plano" onclick={() => { menuGrupo?.hidePopover(); creando = 'chat'; }}><Hash size={16} strokeWidth={1.75} /> Nueva sala de chat</button>
    {/if}
    <button class="plano" onclick={() => { menuGrupo?.hidePopover(); config = true; }}><Settings size={16} strokeWidth={1.75} /> Configuraciones</button>
    {#if grupos.lista.length > 1}
      <hr /><small class="otros">Cambiar de grupo</small>
      {#each grupos.lista.filter((g) => g.id !== grupo.id) as g (g.id)}
        <button class="plano" onclick={() => { menuGrupo?.hidePopover(); grupoActual.id = g.id; }}>{g.name}</button>
      {/each}
    {/if}
  </div>
  {#if config}<ConfigGrupo {grupo} cerrar={() => (config = false)} />{/if}

  {#if enSalaVoz && salaVoz}<Voz {grupo} {soyDueno} {salasVoz} sala={salaVoz.name} verParticipantes={() => capaParticipantes?.showPopover()} />
  {:else if salaAbierta}{#key salaAbierta.id}<Chat titulo={`# ${salaAbierta.name}`} miembros={grupo.expand?.members ?? []} abrir={() => abrirChat(salaAbierta.id)} enviar={(t, f, r) => enviar(salaAbierta.id, t, f, r)} {borrar} silencio={salaAbierta.id} acciones={soyDueno ? accionesSala : undefined}
    puedeBorrar={(m) => m.author === sesion.usuario?.id || soyDueno} />{/key}
  {:else}<div class="vacio">Elegí una sala de chat</div>{/if}

  {#if enSalaVoz}<div popover class="capa" bind:this={capaParticipantes}><Participantes {grupo} /></div>
  {:else}<Participantes {grupo} />{/if}
  <div popover class="menu" bind:this={menuSalaEl}>
    {#if menuSala}{@const r = menuSala}
      <button class="plano" onclick={() => { menuSalaEl?.hidePopover(); editando = { id: r.id, name: r.name }; }}><Pencil size={16} strokeWidth={1.75} /> Cambiar nombre</button>
      <hr /><button class="plano peligro" onclick={() => { menuSalaEl?.hidePopover(); confirmar = { texto: `¿Borrar la sala "${r.name}"?`, hacer: () => borrarSala(r.id) }; }}><Trash2 size={16} strokeWidth={1.75} /> Borrar sala</button>
    {/if}
  </div>
  {#if editando}
    <dialog bind:this={dlgNombre} onclose={() => (editando = null)}>
      <form class="renombrar" onsubmit={(e) => { e.preventDefault(); hacer(guardarNombre); }}>
        <h3>Cambiar nombre</h3>
        <input bind:value={editando.name} required maxlength="40" aria-label="Nuevo nombre de la sala" />
        <div class="fila"><button type="submit" class="primario">Guardar</button><button type="button" onclick={() => dlgNombre?.close()}>Cancelar</button></div>
      </form>
    </dialog>
  {/if}
  {#if creando}{@const kind = creando}
    <dialog bind:this={dlgNueva} onclose={() => (creando = null)} onclick={(e) => e.target === dlgNueva && dlgNueva.close()}>
      <form class="renombrar" onsubmit={(e) => { e.preventDefault(); hacer(() => agregar(kind)); }}>
        <h3>{kind === 'voz' ? 'Nueva sala de voz' : 'Nueva sala de chat'}</h3>
        <input bind:value={nueva} required maxlength="40" placeholder="Nombre de la sala" aria-label="Nombre de la sala" />
        <div class="fila"><button type="submit" class="primario">Crear</button><button type="button" onclick={() => dlgNueva?.close()}>Cancelar</button></div>
      </form>
    </dialog>
  {/if}
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
  .renombrar { display: flex; flex-direction: column; gap: 8px; width: min(320px, 80vw); }
  .renombrar h3 { margin: 0; }
  .link { font-size: 12px; margin: 0 0 8px; }
  .otros { padding: 4px 8px 0; font-size: 11px; }
  .vacio { display: grid; place-items: center; color: var(--tenue); }
  .menu { position: fixed; inset: auto; margin: 0; padding: 8px; min-width: 220px; flex-direction: column; gap: 2px;
    background: var(--elevado); color: var(--texto); border: 1px solid var(--borde); border-radius: var(--radio-menu); }
  .menu:popover-open { display: flex; }
  .menu button { justify-content: flex-start; }
  .menu hr { border: 0; border-top: 1px solid var(--borde); margin: 4px 0; width: 100%; }
</style>

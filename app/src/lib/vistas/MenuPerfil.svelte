<script lang="ts">
  import { cerrarAfuera } from '../afuera';
  import Avatar from './Avatar.svelte';
  import { esEscritorio } from '../plataforma.svelte';
  import { X, User, Star, UserPlus, LogOut, Moon } from '@lucide/svelte';
  import { pb } from '../pb';
  import { sesion, salir, mensajeError } from '../sesion.svelte';
  import { noMolestar, ponerNoMolestar } from '../notificaciones.svelte';
  import { horaDe, reloj } from '../hora.svelte';
  import { NOVEDADES } from '../novedades';
  import Perfil from './Perfil.svelte';
  import Novedades from './Novedades.svelte';
  import Insignia from './Insignia.svelte';
  import { latir } from '../presencia.svelte';

  let menu = $state<HTMLElement>();
  let d = $state<HTMLDialogElement>();
  let dNovedades = $state<HTMLDialogElement>();
  let editando = $state(false); // Perfil se monta al abrir: arranca con los datos actuales
  const u = $derived(sesion.usuario);
  const cerrarMenu = () => menu?.hidePopover();
  const editar = () => { cerrarMenu(); editando = true; queueMicrotask(() => d?.showModal()); };
  const verNovedades = () => { cerrarMenu(); dNovedades?.showModal(); };

  const ESTADOS = [['disponible', 'Disponible'], ['ausente', 'Ausente'], ['ocupado', 'Ocupado'], ['invisible', 'Invisible']] as const;
  const actual = $derived(u?.disponibilidad || 'disponible');
  async function cambiarEstado(valor: string) {
    cerrarMenu();
    if (!u || valor === actual) return;
    await pb.collection('users').update(u.id, { disponibilidad: valor }).catch(() => {});
    void latir(); // al volver de invisible se ve en línea sin esperar el próximo latido
  }
  const salirDeLaApp = () => import('@tauri-apps/api/core').then(({ invoke }) => invoke('salir')).catch(() => {});

  // Avisito "Copiado" al lado de lo que se copió.
  let copiado = $state<'' | 'usuario' | 'invitacion'>('');
  let error = $state('');
  async function copiar(que: 'usuario' | 'invitacion', texto: () => Promise<string> | string) {
    error = '';
    try { await navigator.clipboard.writeText(await texto()); copiado = que; setTimeout(() => (copiado = ''), 2000); }
    catch (e) { error = mensajeError(e); }
  }
  const invitacion = async () => {
    const { codigo } = await pb.send<{ codigo: string }>('/api/invitacion', {});
    return `Sumate a Thunderop: https://www.thunderop.com${codigo ? ` (código de invitación: ${codigo})` : ''}`;
  };

  // Estado personalizado ("Jugando Fortnite"): se ve en la lista de participantes y en la tarjeta.
  let escribiendo = $state(false);
  let actividad = $state('');
  const empezar = () => { actividad = u?.actividad ?? ''; escribiendo = true; };
  async function guardarActividad(texto: string) {
    escribiendo = false;
    if (!u || texto.trim() === (u.actividad ?? '')) return;
    try { await pb.collection('users').update(u.id, { actividad: texto.trim().slice(0, 60) }); } catch (e) { error = mensajeError(e); }
  }

  let eligiendoPausa = $state(false);
  const PAUSAS = [[30, '30 min'], [60, '1 h'], [480, '8 h']] as const;
  const pausaHasta = $derived(noMolestar.hasta > reloj.ahora ? noMolestar.hasta : 0); // se apaga sola a la hora
</script>

<!-- Menú nativo (popover): se cierra solo al tocar afuera o con Esc. -->
<button class="plano yo" popovertarget="menu-perfil">
  {#if u}<Avatar usuario={u} tam={28} />{/if}
  <span style="color:{u?.color || 'inherit'}">{u?.name}</span><Insignia usuario={u ?? undefined} />
</button>
<div id="menu-perfil" popover bind:this={menu} ontoggle={(e) => { if (e.newState === 'closed') { escribiendo = false; eligiendoPausa = false; error = ''; } }}>
  {#if u}
    <div class="cabecera">
      <Avatar usuario={u} tam={40} />
      <span class="quien"><strong style:color={u.color || undefined}>{u.name}<Insignia usuario={u} /></strong>
        <small>@{u.username}<button class="plano enlace" onclick={() => copiar('usuario', () => u.username)}>{copiado === 'usuario' ? 'Copiado' : 'Copiar'}</button></small></span>
    </div>
    {#if escribiendo}
      <!-- svelte-ignore a11y_autofocus -->
      <input class="actividad" bind:value={actividad} maxlength="60" placeholder="¿Qué estás haciendo?" aria-label="Estado personalizado" autofocus
        onkeydown={(e) => { if (e.key === 'Enter') guardarActividad(actividad); if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); escribiendo = false; } }}
        onblur={() => escribiendo && guardarActividad(actividad)} />
    {:else if u.actividad}
      <div class="actividad puesta"><button class="plano texto" onclick={empezar} title="Cambiar">{u.actividad}</button>
        <button class="plano quitar" aria-label="Quitar estado personalizado" title="Quitar" onclick={() => guardarActividad('')}><X size={14} strokeWidth={2} /></button></div>
    {:else}
      <button class="plano actividad vacia" onclick={empezar}>+ ¿Qué estás haciendo?</button>
    {/if}
    <hr />
  {/if}
  {#each ESTADOS as [valor, texto] (valor)}
    <button class="plano estado" aria-pressed={actual === valor} onclick={() => cambiarEstado(valor)}><span class="punto {valor}"></span>{texto}</button>
  {/each}
  {#if pausaHasta}
    <button class="plano" aria-pressed="true" onclick={() => ponerNoMolestar(0)} title="Tocá para apagarlo"><Moon size={15} strokeWidth={1.75} />No molestar<span class="derecha num">hasta {horaDe(new Date(pausaHasta).toISOString())}</span></button>
  {:else if eligiendoPausa}
    <div class="pausas" role="group" aria-label="No molestar durante"><Moon size={15} strokeWidth={1.75} />
      {#each PAUSAS as [min, texto] (min)}<button class="plano" onclick={() => { ponerNoMolestar(min); eligiendoPausa = false; }}>{texto}</button>{/each}</div>
  {:else}
    <button class="plano" onclick={() => (eligiendoPausa = true)} title="Los mensajes no suenan ni avisan; quedan en la campanita"><Moon size={15} strokeWidth={1.75} />No molestar<span class="derecha">›</span></button>
  {/if}
  <hr />
  <button class="plano" onclick={editar}><User size={15} strokeWidth={1.75} />Editar perfil</button>
  {#if NOVEDADES[0]}<button class="plano" onclick={verNovedades}><Star size={15} strokeWidth={1.75} />Novedades<span class="chip num">{NOVEDADES[0].version}</span></button>{/if}
  <button class="plano" onclick={() => copiar('invitacion', invitacion)}><UserPlus size={15} strokeWidth={1.75} />{copiado === 'invitacion' ? 'Invitación copiada' : 'Invitar a Thunderop'}</button>
  {#if error}<p role="alert">{error}</p>{/if}
  <hr />
  <button class="plano" onclick={salir}><LogOut size={15} strokeWidth={1.75} />Cerrar sesión</button>
  {#if esEscritorio}<button class="plano peligroso" onclick={salirDeLaApp}><X size={15} strokeWidth={1.75} />Salir de Thunderop</button>{/if}
</div>

<dialog class="editar" bind:this={d} onclose={() => (editando = false)} use:cerrarAfuera>
  <div class="cabecera-modal"><h2>Mi perfil</h2>
    <button class="icono cerrar-modal" aria-label="Cerrar" title="Cerrar (Esc)" onclick={() => d?.close()}><X size={20} strokeWidth={1.75} /></button></div>
  {#if editando}<Perfil />{/if}
</dialog>

<dialog class="novedades" bind:this={dNovedades} use:cerrarAfuera>
  <button class="icono cerrar-modal" aria-label="Cerrar" title="Cerrar (Esc)" onclick={() => dNovedades?.close()}><X size={20} strokeWidth={1.75} /></button>
  <Novedades />
</dialog>

<style>
  .yo { display: flex; align-items: center; gap: 8px; font-weight: 600; padding: 4px 10px 4px 4px; border-radius: var(--radio-pildora); }
  [popover] { position: fixed; inset: 48px 12px auto auto; width: 260px; margin: 0; padding: 6px; display: none; flex-direction: column; gap: 2px;
    background: var(--elevado); color: var(--texto); border: 1px solid var(--borde-fuerte); border-radius: var(--radio-menu); box-shadow: var(--sombra-2); --anillo: var(--elevado); }
  [popover]:popover-open { display: flex; }
  [popover] button { justify-content: flex-start; text-align: left; }
  [popover] button:not(.peligro):not(.peligroso) { color: var(--texto); }
  [popover] hr { border: 0; border-top: 1px solid var(--borde); margin: 4px 0; }
  .cabecera { display: flex; align-items: center; gap: 10px; padding: 6px 8px; }
  .quien { display: flex; flex-direction: column; min-width: 0; }
  .quien strong { display: flex; align-items: center; gap: 4px; font-size: 15px; font-weight: 650; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .quien small { display: flex; align-items: center; gap: 4px; color: var(--tenue); font-size: 12.5px; user-select: text; }
  [popover] .enlace { min-height: 0; padding: 0 4px; font-size: 12px; font-weight: 600; color: var(--acento-texto); }
  .actividad { margin: 2px 2px 4px; min-height: 34px; font-size: 13px; }
  .actividad.vacia { border: 1px dashed var(--borde-fuerte); color: var(--tenue); }
  [popover] .actividad.vacia { color: var(--tenue); }
  .actividad.puesta { display: flex; align-items: center; background: var(--superficie); border: 1px solid var(--borde-fuerte); border-radius: var(--radio); }
  .actividad.puesta .texto { flex: 1; min-width: 0; min-height: 32px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: block; }
  .actividad.puesta .quitar { min-height: 32px; padding: 0 8px; }
  [popover] .actividad.puesta .quitar { color: var(--apagado); }
  input.actividad { padding: 6px 10px; }
  .estado { display: flex; align-items: center; gap: 8px; }
  .punto { width: 10px; height: 10px; border-radius: 50%; flex: none; }
  .disponible { background: var(--ok); }
  .ausente { background: var(--ausente); }
  .ocupado { background: var(--peligro); }
  .invisible { background: var(--apagado); }
  .derecha { margin-left: auto; font-size: 12px; font-weight: 450; color: var(--apagado); }
  .pausas { display: flex; align-items: center; gap: 4px; padding-left: 12px; color: var(--icono); }
  .pausas button { flex: 1; justify-content: center; padding: 6px 4px; border: 1px solid var(--borde-fuerte); }
  .chip { margin-left: auto; font-size: 11px; font-weight: 650; padding: 1px 6px; border-radius: var(--radio-pildora); background: var(--acento-suave); color: var(--acento-texto); }
  .peligroso { color: var(--peligro); }
  [role='alert'] { margin: 2px 8px; font-size: 12.5px; }
  .editar { width: min(680px, 94vw); max-width: none; padding: 20px 24px 24px; }
  .editar[open] { display: flex; flex-direction: column; gap: 16px; }
  .novedades { width: min(560px, 94vw); max-width: none; padding: 20px 24px 24px; }
  .novedades[open] { display: flex; flex-direction: column; gap: 8px; }
  .novedades .cerrar-modal { position: absolute; top: 14px; right: 14px; }
</style>

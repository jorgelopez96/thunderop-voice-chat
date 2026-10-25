<script lang="ts">
  import Avatar from './Avatar.svelte';
  import { X } from '@lucide/svelte';
  import { pb } from '../pb';
  import { sesion, salir } from '../sesion.svelte';
  import Perfil from './Perfil.svelte';
  import Insignia from './Insignia.svelte';
  import { latir } from '../presencia.svelte';

  let menu = $state<HTMLElement>();
  let d = $state<HTMLDialogElement>();
  let editando = $state(false); // Perfil se monta al abrir: arranca con los datos actuales
  const u = $derived(sesion.usuario);
  const editar = () => { menu?.hidePopover(); editando = true; queueMicrotask(() => d?.showModal()); };

  const ESTADOS = [['disponible', 'Disponible'], ['ausente', 'Ausente'], ['ocupado', 'Ocupado'], ['invisible', 'Invisible']] as const;
  const actual = $derived(u?.disponibilidad || 'disponible');
  async function cambiarEstado(valor: string) {
    menu?.hidePopover();
    if (!u || valor === actual) return;
    await pb.collection('users').update(u.id, { disponibilidad: valor }).catch(() => {});
    void latir(); // al volver de invisible se ve en línea sin esperar el próximo latido
  }
  const salirDeLaApp = () => import('@tauri-apps/api/core').then(({ invoke }) => invoke('salir')).catch(() => {});
</script>

<!-- Menú nativo (popover): se cierra solo al tocar afuera o con Esc. -->
<button class="plano yo" popovertarget="menu-perfil">
  {#if u}<Avatar usuario={u} tam={28} />{/if}
  <span style="color:{u?.color || 'inherit'}">{u?.name}</span><Insignia usuario={u ?? undefined} />
</button>
<div id="menu-perfil" popover bind:this={menu}>
  {#if u?.username}<span class="usuario" title="Tu usuario: pasalo para que te agreguen">@{u.username}</span><hr />{/if}
  {#each ESTADOS as [valor, texto] (valor)}
    <button class="plano estado" aria-pressed={actual === valor} onclick={() => cambiarEstado(valor)}><span class="punto {valor}"></span>{texto}</button>
  {/each}
  <hr />
  <button class="plano" onclick={editar}>Editar perfil</button>
  <button class="plano" onclick={salir}>Cerrar sesión</button>
  {#if '__TAURI_INTERNALS__' in globalThis}<button class="plano peligroso" onclick={salirDeLaApp}>Salir de Thunderop</button>{/if}
</div>

<dialog class="editar" bind:this={d} onclose={() => (editando = false)} onclick={(e) => e.target === d && d.close()}>
  <div class="cabecera-modal"><h2>Mi perfil</h2>
    <button class="icono cerrar-modal" aria-label="Cerrar" title="Cerrar (Esc)" onclick={() => d?.close()}><X size={20} strokeWidth={1.75} /></button></div>
  {#if editando}<Perfil />{/if}
</dialog>

<style>
  .yo { display: flex; align-items: center; gap: 8px; font-weight: 600; padding: 4px 10px 4px 4px; border-radius: var(--radio-pildora); }
  [popover] { position: fixed; inset: 48px 12px auto auto; margin: 0; padding: 6px; display: none; flex-direction: column; gap: 2px;
    background: var(--elevado); color: var(--texto); border: 1px solid var(--borde-fuerte); border-radius: var(--radio-menu); box-shadow: var(--sombra-2); }
  [popover]:popover-open { display: flex; }
  [popover] button { justify-content: flex-start; text-align: left; }
  [popover] button:not(.peligro):not(.peligroso) { color: var(--texto); }
  [popover] hr { border: 0; border-top: 1px solid var(--borde); margin: 4px 0; }
  .usuario { padding: 4px 8px; color: var(--tenue); user-select: text; }
  .estado { display: flex; align-items: center; gap: 8px; }
  .punto { width: 10px; height: 10px; border-radius: 50%; flex: none; }
  .disponible { background: var(--ok); }
  .ausente { background: var(--ausente); }
  .ocupado { background: var(--peligro); }
  .invisible { background: var(--apagado); }
  .peligroso { color: var(--peligro); }
  .editar { width: min(440px, 92vw); max-width: none; padding: 20px 24px 24px; }
  .editar[open] { display: flex; flex-direction: column; gap: 16px; }
</style>

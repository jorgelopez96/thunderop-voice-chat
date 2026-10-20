<script lang="ts">
  import { pb } from '../pb';
  import { sesion, salir } from '../sesion.svelte';
  import Perfil from './Perfil.svelte';
  import Insignia from './Insignia.svelte';

  let menu = $state<HTMLElement>();
  let d = $state<HTMLDialogElement>();
  let editando = $state(false); // Perfil se monta al abrir: arranca con los datos actuales
  const u = $derived(sesion.usuario);
  const editar = () => { menu?.hidePopover(); editando = true; queueMicrotask(() => d?.showModal()); };
</script>

<!-- Menú nativo (popover): se cierra solo al tocar afuera o con Esc. -->
<button class="plano yo" popovertarget="menu-perfil">
  {#if u?.avatar}<img class="avatar" alt="" src={pb.files.getURL(u, u.avatar, { thumb: '64x64' })} />{/if}
  <span style="color:{u?.color || 'inherit'}">{u?.name}</span><Insignia usuario={u ?? undefined} />
</button>
<div id="menu-perfil" popover bind:this={menu}>
  <button class="plano" onclick={editar}>Editar perfil</button>
  <button class="plano" onclick={salir}>Cerrar sesión</button>
</div>

<dialog bind:this={d} onclose={() => (editando = false)}>
  {#if editando}<Perfil />{/if}
  <div class="fila" style="justify-content:flex-end"><button class="plano" onclick={() => d?.close()}>Cerrar</button></div>
</dialog>

<style>
  .yo { display: flex; align-items: center; gap: 8px; font-weight: 600; }
  .yo img { width: 24px; height: 24px; }
  [popover] { position: fixed; inset: 48px 12px auto auto; margin: 0; padding: 6px; display: none; flex-direction: column; gap: 2px;
    background: var(--panel); color: var(--texto); border: 1px solid var(--borde); border-radius: 10px; }
  [popover]:popover-open { display: flex; }
  [popover] button { text-align: left; }
</style>

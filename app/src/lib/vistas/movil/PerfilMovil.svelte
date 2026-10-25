<script lang="ts">
  import { Settings, Bell, LogOut } from '@lucide/svelte';
  import Perfil from '../Perfil.svelte';
  import { salir } from '../../sesion.svelte';

  // Pestaña Perfil del celular: el editor de perfil y lo que en la PC está en la barra de arriba.
  let { abrirConfig }: { abrirConfig: () => void } = $props();
</script>

<div class="perfil-movil">
  <Perfil />
  <div class="acciones">
    <button onclick={abrirConfig}><Settings size={18} strokeWidth={1.75} />Configuración</button>
    <button onclick={() => document.getElementById('campanita')?.showPopover()}><Bell size={18} strokeWidth={1.75} />Notificaciones</button>
    <button class="peligro" onclick={salir}><LogOut size={18} strokeWidth={1.75} />Cerrar sesión</button>
  </div>
</div>

<style>
  .perfil-movil { flex: 1; overflow-y: auto; padding: 20px 16px 24px; display: flex; flex-direction: column; gap: 24px; }
  .acciones { display: flex; flex-direction: column; gap: 8px; }
  .acciones button { justify-content: flex-start; min-height: 48px; padding: 0 16px; gap: 12px; }
</style>

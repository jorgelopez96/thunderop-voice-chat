<script lang="ts">
  import { LogOut } from '@lucide/svelte';
  import Perfil from '../Perfil.svelte';
  import { salir } from '../../sesion.svelte';

  // Pestaña Perfil del celular: el editor de perfil y cerrar sesión (configuración y notificaciones están arriba).
</script>

<div class="perfil-movil">
  <Perfil />
  <div class="acciones">
    <button class="peligro" onclick={salir}><LogOut size={18} strokeWidth={1.75} />Cerrar sesión</button>
  </div>
</div>

<style>
  .perfil-movil { flex: 1; overflow-y: auto; padding: 20px 16px 24px; display: flex; flex-direction: column; gap: 24px; }
  .acciones { display: flex; flex-direction: column; gap: 8px; }
  .acciones button { justify-content: flex-start; min-height: 48px; padding: 0 16px; gap: 12px; }
</style>

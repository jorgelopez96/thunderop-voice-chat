<script lang="ts">
  import Entrar from '$lib/vistas/Entrar.svelte';
  import Perfil from '$lib/vistas/Perfil.svelte';
  import { sesion, salir } from '$lib/sesion.svelte';
</script>

{#if !sesion.usuario}
  <Entrar />
{:else}
  <!-- Task 8: aquí va el layout principal -->
  <main>
    <h1>Discord mejorado</h1>
    <Perfil />
    <button onclick={salir}>Salir</button>
  </main>
{/if}

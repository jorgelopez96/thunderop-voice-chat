<script lang="ts">
  import Entrar from '$lib/vistas/Entrar.svelte';
  import Perfil from '$lib/vistas/Perfil.svelte';
  import { onMount } from 'svelte';
  import { sesion, salir, validarSesionAlIniciar } from '$lib/sesion.svelte';

  onMount(validarSesionAlIniciar);
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

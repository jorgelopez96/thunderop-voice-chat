<script lang="ts">
  import Entrar from '$lib/vistas/Entrar.svelte';
  import Principal from '$lib/vistas/Principal.svelte';
  import { onMount } from 'svelte';
  import { sesion, validarSesionAlIniciar } from '$lib/sesion.svelte';

  onMount(validarSesionAlIniciar);
</script>

{#if !sesion.usuario}
  <Entrar />
{:else}
  <Principal />
{/if}

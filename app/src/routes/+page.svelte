<script lang="ts">
  import '@fontsource-variable/inter';
  import '../app.css';
  import Entrar from '$lib/vistas/Entrar.svelte';
  import Completar from '$lib/vistas/Completar.svelte';
  import Verificar from '$lib/vistas/Verificar.svelte';
  import Principal from '$lib/vistas/Principal.svelte';
  import { onMount } from 'svelte';
  import { salir, sesion, validarSesionAlIniciar } from '$lib/sesion.svelte';
  import { cargarEstado, cuenta } from '$lib/cuenta.svelte';
  import { actualizacion, buscarActualizacion } from '$lib/actualizacion.svelte';
  import Actualizacion from '$lib/vistas/Actualizacion.svelte';
  import { voz } from '$lib/voz.svelte';
  import { aplicarTema, temaGuardado } from '$lib/tema';

  aplicarTema(temaGuardado());

  onMount(validarSesionAlIniciar);
  // Con sesión se consulta qué le falta a la cuenta; sin sesión se limpia.
  $effect(() => {
    if (!sesion.usuario) { cuenta.falta = null; return; }
    cargarEstado().catch(() => {});
  });
  onMount(() => {
    buscarActualizacion();
    // Con la bandeja la app casi no se reabre: se vuelve a buscar cada hora, pero nunca en plena llamada.
    const t = setInterval(() => { if (!voz.salaId) buscarActualizacion(true); }, 60 * 60_000);
    return () => clearInterval(t);
  });
</script>

{#if actualizacion.estado !== 'lista'}
  <Actualizacion />
{:else if !sesion.usuario}
  <Entrar />
{:else if cuenta.falta === null}
  <main class="cargando" aria-busy={!cuenta.error}>
    {#if cuenta.error}
      <div class="tarjeta">
        <p role="alert">{cuenta.error}</p>
        <div class="fila"><button onclick={cargarEstado}>Reintentar</button><button class="plano" onclick={salir}>Salir</button></div>
      </div>
    {/if}
  </main>
{:else if cuenta.falta.includes('verificar')}
  <Verificar email={sesion.usuario.email} alVerificar={cargarEstado} alVolver={salir} />
{:else if cuenta.falta.length}
  <Completar />
{:else}
  <Principal />
{/if}

<style>
  .cargando { min-height: 100%; display: grid; place-items: center; padding: 16px; }
  .cargando p { margin: 0; }
</style>

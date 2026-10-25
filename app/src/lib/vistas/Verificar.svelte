<script lang="ts">
  import LogoThunderop from './LogoThunderop.svelte';
  import { onMount } from 'svelte';
  import { pedirCodigo, verificar } from '../cuenta.svelte';
  import { mensajeError } from '../sesion.svelte';
  import { soloDigitos } from '../reglasCuenta';

  let { email: inicial = '', recienEnviado = false, alVerificar, alVolver }: { email?: string; recienEnviado?: boolean; alVerificar: () => void | Promise<void>; alVolver?: () => void } = $props();

  let escrito = $state('');
  const email = $derived(inicial || escrito);
  let codigo = $state('');
  let error = $state('');
  let aviso = $state('');
  let ocupado = $state(false);
  let espera = $state(0);
  let hecho = false; // el código ya se consumió: si falla lo que sigue, no se vuelve a pedir

  onMount(() => {
    if (recienEnviado) espera = 60;
    const t = setInterval(() => { if (espera > 0) espera--; }, 1000);
    return () => clearInterval(t);
  });

  async function confirmar(ev: SubmitEvent) {
    ev.preventDefault();
    error = aviso = '';
    ocupado = true;
    try {
      if (!hecho) { await verificar(email.trim(), codigo); hecho = true; }
      await alVerificar();
    } catch (e) {
      error = mensajeError(e);
    } finally {
      ocupado = false;
    }
  }

  async function reenviar() {
    error = aviso = '';
    try {
      await pedirCodigo(email.trim(), 'verificar');
      aviso = 'Te mandamos un código nuevo.';
      espera = 60;
    } catch (e) {
      error = mensajeError(e);
    }
  }
</script>

<main>
  <div class="tarjeta">
    <LogoThunderop />
    <h1>Confirmá tu cuenta</h1>
    <p>Te mandamos un código de 6 dígitos por mail. Vence en 10 minutos.</p>
    <form onsubmit={confirmar}>
      {#if !inicial}
        <label>Email <input type="email" bind:value={escrito} required autocomplete="email" /></label>
      {:else}
        <p><small>{inicial}</small></p>
      {/if}
      <label>Código
        <input bind:value={codigo} required inputmode="numeric" maxlength="6" oninput={() => (codigo = soloDigitos(codigo))} onpaste={(e) => { e.preventDefault(); codigo = soloDigitos(e.clipboardData?.getData('text') ?? ''); }} autocomplete="one-time-code" placeholder="123456" />
      </label>
      {#if error}<p role="alert">{error}</p>{/if}
      {#if aviso}<p role="status">{aviso}</p>{/if}
      <button type="submit" disabled={ocupado || codigo.length !== 6}>Confirmar</button>
    </form>
    <div class="fila">
      <button class="plano" disabled={espera > 0 || !email.trim()} onclick={reenviar}>
        Reenviar código{espera > 0 ? ` (${espera} s)` : ''}
      </button>
      {#if alVolver}<button class="plano" onclick={alVolver}>Volver</button>{/if}
    </div>
  </div>
</main>

<style>
  main { min-height: 100%; display: grid; place-items: center; padding: 16px; }
  .tarjeta { width: min(400px, 100%); }
  h1 { text-align: center; font-size: 22px; }
  p { margin: 0; }
  form { display: flex; flex-direction: column; gap: 12px; }
</style>

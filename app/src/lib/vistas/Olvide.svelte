<script lang="ts">
  import LogoThunderop from './LogoThunderop.svelte';
  import { onMount } from 'svelte';
  import { pedirCodigo, restablecer } from '../cuenta.svelte';
  import { mensajeError } from '../sesion.svelte';
  import { errorClave, soloDigitos } from '../reglasCuenta';
  import Requisitos from './Requisitos.svelte';

  let { alTerminar, alVolver }: { alTerminar: () => void; alVolver: () => void } = $props();

  let paso = $state<'mail' | 'codigo'>('mail');
  let email = $state('');
  let codigo = $state('');
  let pass = $state('');
  let error = $state('');
  let ocupado = $state(false);
  let espera = $state(0);

  onMount(() => {
    const t = setInterval(() => { if (espera > 0) espera--; }, 1000);
    return () => clearInterval(t);
  });

  async function pedir(ev?: SubmitEvent) {
    ev?.preventDefault();
    error = '';
    ocupado = true;
    try {
      await pedirCodigo(email.trim(), 'restablecer');
      paso = 'codigo';
      espera = 60;
    } catch (e) {
      error = mensajeError(e);
    } finally {
      ocupado = false;
    }
  }

  async function cambiar(ev: SubmitEvent) {
    ev.preventDefault();
    error = errorClave(pass);
    if (error) return;
    ocupado = true;
    try {
      await restablecer(email.trim(), codigo, pass);
      alTerminar();
    } catch (e) {
      error = mensajeError(e);
    } finally {
      ocupado = false;
    }
  }
</script>

<main>
  <div class="tarjeta">
    <LogoThunderop />
    <h1>Olvidé mi contraseña</h1>
    {#if paso === 'mail'}
      <p>Poné tu email y te mandamos un código para elegir una contraseña nueva.</p>
      <form onsubmit={pedir}>
        <label>Email <input type="email" bind:value={email} required autocomplete="email" /></label>
        {#if error}<p role="alert">{error}</p>{/if}
        <button type="submit" disabled={ocupado}>Mandar código</button>
      </form>
    {:else}
      <p>Si el email tiene una cuenta, te llegó un código de 6 dígitos.</p>
      <form onsubmit={cambiar}>
        <label>Código
          <input bind:value={codigo} required inputmode="numeric" maxlength="6" oninput={() => (codigo = soloDigitos(codigo))} onpaste={(e) => { e.preventDefault(); codigo = soloDigitos(e.clipboardData?.getData('text') ?? ''); }} autocomplete="one-time-code" placeholder="123456" />
        </label>
        <label>Contraseña nueva
          <input type="password" bind:value={pass} required autocomplete="new-password" />
        </label>
        <Requisitos clave={pass} />
        {#if error}<p role="alert">{error}</p>{/if}
        <button type="submit" disabled={ocupado || codigo.length !== 6}>Cambiar contraseña</button>
      </form>
      <button class="plano" disabled={espera > 0 || ocupado} onclick={() => pedir()}>
        Reenviar código{espera > 0 ? ` (${espera} s)` : ''}
      </button>
    {/if}
    <button class="plano" onclick={alVolver}>Volver</button>
  </div>
</main>

<style>
  main { min-height: 100%; display: grid; place-items: center; padding: 16px; }
  .tarjeta { width: min(400px, 100%); }
  h1 { text-align: center; font-size: 22px; }
  p { margin: 0; }
  form { display: flex; flex-direction: column; gap: 12px; }
</style>

<script lang="ts">
  import { entrar, registrarse, mensajeError } from '../sesion.svelte';

  let modo = $state<'entrar' | 'crear'>('entrar');
  let email = $state('');
  let pass = $state('');
  let name = $state('');
  let error = $state('');
  let ocupado = $state(false);

  async function enviar(ev: SubmitEvent) {
    ev.preventDefault();
    error = '';
    ocupado = true;
    try {
      if (modo === 'entrar') await entrar(email, pass);
      else await registrarse(email, pass, name);
    } catch (e) {
      error = mensajeError(e);
    } finally {
      ocupado = false;
    }
  }
</script>

<main>
  <div class="tarjeta">
  <h1>Thunderop - voice chat</h1>
  <div role="tablist" class="fila">
    <button role="tab" class="plano" aria-selected={modo === 'entrar'} onclick={() => (modo = 'entrar')}>Entrar</button>
    <button role="tab" class="plano" aria-selected={modo === 'crear'} onclick={() => (modo = 'crear')}>Crear cuenta</button>
  </div>
  <form onsubmit={enviar}>
    {#if modo === 'crear'}
      <label>Nombre <input bind:value={name} required maxlength="32" autocomplete="nickname" /></label>
    {/if}
    <label>Email <input type="email" bind:value={email} required autocomplete="email" /></label>
    <label>Contraseña
      <input type="password" bind:value={pass} required minlength="8"
        autocomplete={modo === 'entrar' ? 'current-password' : 'new-password'} />
    </label>
    {#if error}<p role="alert">{error}</p>{/if}
    <button type="submit" disabled={ocupado}>{modo === 'entrar' ? 'Entrar' : 'Crear cuenta'}</button>
  </form>
  </div>
</main>

<style>
  main { min-height: 100%; display: grid; place-items: center; padding: 16px; }
  .tarjeta { width: min(400px, 100%); }
  h1 { text-align: center; font-size: 22px; }
  form { display: flex; flex-direction: column; gap: 12px; }
  [role='tab'][aria-selected='true'] { color: var(--texto); box-shadow: inset 0 -2px var(--acento); border-radius: 0; }
</style>

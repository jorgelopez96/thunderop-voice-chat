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
  <h1>Discord mejorado</h1>
  <div role="tablist">
    <button role="tab" aria-selected={modo === 'entrar'} onclick={() => (modo = 'entrar')}>Entrar</button>
    <button role="tab" aria-selected={modo === 'crear'} onclick={() => (modo = 'crear')}>Crear cuenta</button>
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
    {#if error}<p role="alert" style="color:#c00">{error}</p>{/if}
    <button type="submit" disabled={ocupado}>{modo === 'entrar' ? 'Entrar' : 'Crear cuenta'}</button>
  </form>
</main>

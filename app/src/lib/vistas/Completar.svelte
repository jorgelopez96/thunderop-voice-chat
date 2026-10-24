<script lang="ts">
  import { aceptarTerminos, completar, cuenta, leerTerminos, ponerInvitacion } from '../cuenta.svelte';
  import { mensajeError, salir } from '../sesion.svelte';
  import { errorEdad, errorUsuario, normalizarUsuario } from '../reglasCuenta';
  import Terminos from './Terminos.svelte';

  // Una cosa por vez, en el orden del servidor: invitación, después perfil o términos.
  const paso = $derived(cuenta.falta?.includes('invitacion') ? 'invitacion' : cuenta.falta?.includes('perfil') ? 'perfil' : 'terminos');

  let codigo = $state('');
  let usuario = $state('');
  let nacimiento = $state('');
  let acepto = $state(false);
  let error = $state('');
  let ocupado = $state(false);
  const hoy = new Date().toISOString().slice(0, 10);

  async function enviar(ev: SubmitEvent) {
    ev.preventDefault();
    error = '';
    if (paso === 'perfil') {
      error = errorUsuario(normalizarUsuario(usuario)) || errorEdad(nacimiento, new Date());
      if (!error && !acepto) error = 'Tenés que aceptar los términos para seguir.';
      if (error) return;
    }
    ocupado = true;
    try {
      if (paso === 'invitacion') await ponerInvitacion(codigo.trim());
      else if (paso === 'perfil') await completar({ username: normalizarUsuario(usuario), nacimiento, terminos: await leerTerminos() });
      else await aceptarTerminos(await leerTerminos());
    } catch (e) {
      error = mensajeError(e);
    } finally {
      ocupado = false;
    }
  }
</script>

<main>
  <div class="tarjeta">
    <h1>Completá tu cuenta</h1>
    <form onsubmit={enviar}>
      {#if paso === 'invitacion'}
        <p>Thunderop es solo con invitación. Ingresá el código que te pasaron.</p>
        <label>Código de invitación <input bind:value={codigo} required autocomplete="off" /></label>
      {:else if paso === 'perfil'}
        <p>Elegí tu usuario (no se puede cambiar después) y poné tu fecha de nacimiento.</p>
        <label>Usuario <input bind:value={usuario} required maxlength="20" autocomplete="username" /></label>
        <label>Fecha de nacimiento <input type="date" bind:value={nacimiento} required max={hoy} /></label>
        <Terminos bind:aceptado={acepto} />
      {:else}
        <p>Actualizamos los términos y la política de privacidad. Para seguir tenés que aceptarlos.</p>
        <Terminos bind:aceptado={acepto} />
      {/if}
      {#if error}<p role="alert">{error}</p>{/if}
      <button type="submit" disabled={ocupado || (paso === 'terminos' && !acepto)}>Continuar</button>
    </form>
    <button class="plano" onclick={salir}>Salir</button>
  </div>
</main>

<style>
  main { min-height: 100%; display: grid; place-items: center; padding: 16px; }
  .tarjeta { width: min(400px, 100%); }
  h1 { text-align: center; font-size: 22px; }
  p { margin: 0; }
  form { display: flex; flex-direction: column; gap: 12px; }
</style>

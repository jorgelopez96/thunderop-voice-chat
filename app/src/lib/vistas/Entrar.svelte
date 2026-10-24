<script lang="ts">
  import { entrar, registrarse, mensajeError, emailRecordado } from '../sesion.svelte';
  import { entrarCon, leerTerminos } from '../cuenta.svelte';
  import { errorClave, errorEdad, errorUsuario, normalizarUsuario } from '../reglasCuenta';
  import Verificar from './Verificar.svelte';
  import Olvide from './Olvide.svelte';
  import Requisitos from './Requisitos.svelte';
  import Terminos from './Terminos.svelte';

  let pantalla = $state<'form' | 'verificar' | 'olvide'>('form');
  let modo = $state<'entrar' | 'crear'>('entrar');
  let identidad = $state(emailRecordado());
  let email = $state('');
  let usuario = $state('');
  let name = $state('');
  let nacimiento = $state('');
  let acepto = $state(false);
  let recordar = $state(true);
  let pass = $state('');
  let error = $state('');
  let aviso = $state('');
  let ocupado = $state(false);
  // Lo que se tipeó al crear la cuenta, en memoria hasta confirmar el código (la contraseña nunca se guarda).
  let pendiente = $state<{ email: string; usuario: string; pass: string } | null>(null);
  const hoy = new Date().toISOString().slice(0, 10);

  async function enviar(ev: SubmitEvent) {
    ev.preventDefault();
    error = aviso = '';
    if (modo === 'crear') {
      error = errorUsuario(normalizarUsuario(usuario)) || errorClave(pass) || errorEdad(nacimiento, new Date());
      if (!error && !acepto) error = 'Tenés que aceptar los términos para crear la cuenta.';
      if (error) return;
    }
    ocupado = true;
    try {
      if (modo === 'entrar') await entrar(identidad.trim(), pass, recordar);
      else {
        const datos = { email: email.trim(), username: normalizarUsuario(usuario), name: name.trim(), password: pass, nacimiento, terminos: await leerTerminos() };
        await registrarse(datos, recordar);
        pendiente = { email: datos.email, usuario: datos.username, pass };
        pantalla = 'verificar';
      }
    } catch (e) {
      error = mensajeError(e);
    } finally {
      ocupado = false;
    }
  }

  async function conProveedor(p: 'google') {
    error = aviso = '';
    try { await entrarCon(p); } catch (e) { error = mensajeError(e); }
  }

  async function verificado() {
    const p = pendiente;
    if (p) {
      try { await entrar(p.usuario, p.pass, recordar); } catch {
        pantalla = 'form'; modo = 'entrar'; aviso = 'Ya confirmaste tu cuenta, entrá con tu usuario y contraseña.';
      }
      pendiente = null;
    } else { pantalla = 'form'; modo = 'entrar'; aviso = 'Cuenta confirmada. Ya podés entrar.'; }
  }
</script>

{#if pantalla === 'verificar'}
  <Verificar email={pendiente?.email ?? ''} recienEnviado={!!pendiente} alVerificar={verificado} alVolver={() => { pantalla = 'form'; pendiente = null; }} />
{:else if pantalla === 'olvide'}
  <Olvide alVolver={() => (pantalla = 'form')} alTerminar={() => { pantalla = 'form'; modo = 'entrar'; pass = ''; aviso = 'Contraseña cambiada. Ya podés entrar.'; }} />
{:else}
<main>
  <div class="tarjeta">
  <h1>Thunderop - voice chat</h1>
  <div role="tablist" class="fila">
    <button role="tab" class="plano" aria-selected={modo === 'entrar'} onclick={() => (modo = 'entrar')}>Entrar</button>
    <button role="tab" class="plano" aria-selected={modo === 'crear'} onclick={() => (modo = 'crear')}>Crear cuenta</button>
  </div>
  <form onsubmit={enviar}>
    {#if modo === 'crear'}
      <label>Email <input type="email" bind:value={email} required autocomplete="email" /></label>
      <label>Usuario <input bind:value={usuario} required maxlength="20" autocomplete="username" /></label>
      <label>Apodo <input bind:value={name} required maxlength="32" autocomplete="nickname" /></label>
    {:else}
      <label>Usuario o email <input bind:value={identidad} required autocomplete="username" /></label>
    {/if}
    <label>Contraseña
      <input type="password" bind:value={pass} required
        autocomplete={modo === 'entrar' ? 'current-password' : 'new-password'} />
    </label>
    {#if modo === 'crear'}
      <Requisitos clave={pass} />
      <label>Fecha de nacimiento <input type="date" bind:value={nacimiento} required max={hoy} /></label>
      <Terminos bind:aceptado={acepto} />
    {:else}
      <label class="casilla"><input type="checkbox" bind:checked={recordar} /> Recordar mi cuenta</label>
    {/if}
    {#if error}<p role="alert">{error}</p>{/if}
    {#if aviso}<p role="status">{aviso}</p>{/if}
    <button type="submit" disabled={ocupado}>{modo === 'entrar' ? 'Entrar' : 'Crear cuenta'}</button>
  </form>
  {#if modo === 'entrar'}
    <div class="proveedores">
      <button onclick={() => conProveedor('google')}>Entrar con Google</button>
    </div>
    <div class="fila">
      <button class="plano" onclick={() => (pantalla = 'olvide')}>Olvidé mi contraseña</button>
      <button class="plano" onclick={() => { pendiente = null; pantalla = 'verificar'; }}>¿Ya tenés cuenta sin confirmar? Confirmala</button>
    </div>
  {/if}
  </div>
</main>
{/if}

<style>
  .casilla { flex-direction: row; align-items: center; gap: 8px; }
  main { min-height: 100%; display: grid; place-items: center; padding: 16px; }
  .tarjeta { width: min(400px, 100%); }
  h1 { text-align: center; font-size: 22px; }
  p { margin: 0; }
  form, .proveedores { display: flex; flex-direction: column; gap: 12px; }
  [role='tab'][aria-selected='true'] { color: var(--texto); box-shadow: inset 0 -2px var(--acento); border-radius: 0; }
</style>

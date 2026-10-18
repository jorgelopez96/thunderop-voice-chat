<script lang="ts">
  import { pb } from '../pb';
  import { validarAdjunto } from '../adjuntos';
  import { sesion, mensajeError } from '../sesion.svelte';

  const MAX_AVATAR = 2 * 1024 * 1024;
  const u = sesion.usuario!;
  let name = $state<string>(u.name ?? '');
  let color = $state<string>(u.color || '#5865f2');
  let status = $state<string>(u.status ?? '');
  let foto = $state<File | null>(null);
  let error = $state('');
  let ok = $state(false);
  let ocupado = $state(false);

  function elegirFoto(ev: Event) {
    const f = (ev.currentTarget as HTMLInputElement).files?.[0] ?? null;
    error = '';
    foto = null;
    if (!f) return;
    const v = validarAdjunto(f);
    if (!v.ok) error = v.motivo;
    else if (!f.type.startsWith('image/')) error = 'La foto debe ser una imagen.';
    else if (f.size > MAX_AVATAR) error = 'La foto supera los 2 MB.';
    else foto = f;
  }

  async function guardar(ev: SubmitEvent) {
    ev.preventDefault();
    error = ''; ok = false; ocupado = true;
    try {
      const datos = new FormData();
      datos.append('name', name);
      datos.append('color', color);
      datos.append('status', status);
      if (foto) datos.append('avatar', foto);
      await pb.collection('users').update(u.id, datos); // authStore se actualiza solo
      foto = null;
      ok = true;
    } catch (e) {
      error = mensajeError(e);
    } finally {
      ocupado = false;
    }
  }
</script>

<form onsubmit={guardar}>
  <h2>Mi perfil</h2>
  {#if sesion.usuario?.avatar}
    <img alt="Foto de perfil" width="64" height="64"
      src={pb.files.getURL(sesion.usuario, sesion.usuario.avatar, { thumb: '64x64' })} />
  {/if}
  <label>Foto <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onchange={elegirFoto} /></label>
  <label>Nombre <input bind:value={name} required maxlength="32" /></label>
  <label>Color <input type="color" bind:value={color} /></label>
  <label>Estado <input bind:value={status} maxlength="80" /></label>
  {#if error}<p role="alert" style="color:#c00">{error}</p>{/if}
  {#if ok}<p role="status">Perfil guardado.</p>{/if}
  <button type="submit" disabled={ocupado}>Guardar</button>
</form>

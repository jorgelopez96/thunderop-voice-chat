<script lang="ts">
  import { Pencil, Plus, Eye, EyeOff } from '@lucide/svelte';
  import { foto as fotoDe } from '../foto';
  import { pb } from '../pb';
  import { validarAdjunto } from '../adjuntos';
  import { sesion, mensajeError } from '../sesion.svelte';

  const MAX_AVATAR = 2 * 1024 * 1024;
  const u = sesion.usuario!;
  let name = $state<string>(u.name ?? '');
  let descripcion = $state<string>(u.status ?? ''); // se guarda en `status`
  let foto = $state<File | null>(null);
  let previa = $state('');
  let verMail = $state(false);
  let error = $state('');
  let ok = $state(false);
  let ocupado = $state(false);
  $effect(() => () => { if (previa) URL.revokeObjectURL(previa); });

  /** jorge.lopez@gmail.com → jo*******@gmail.com */
  const oculto = (mail: string) => {
    const [usuario, dominio] = mail.split('@');
    return `${usuario.slice(0, 2)}${'*'.repeat(Math.max(3, usuario.length - 2))}@${dominio ?? ''}`;
  };

  function elegirFoto(ev: Event) {
    const f = (ev.currentTarget as HTMLInputElement).files?.[0] ?? null;
    error = '';
    if (!f) return;
    const v = validarAdjunto(f);
    if (!v.ok) error = v.motivo;
    else if (!f.type.startsWith('image/')) error = 'La foto debe ser una imagen.';
    else if (f.size > MAX_AVATAR) error = 'La foto supera los 2 MB.';
    else { foto = f; if (previa) URL.revokeObjectURL(previa); previa = URL.createObjectURL(f); }
  }

  async function guardar(ev: SubmitEvent) {
    ev.preventDefault();
    error = ''; ok = false; ocupado = true;
    try {
      const datos = new FormData();
      datos.append('name', name.trim());
      datos.append('status', descripcion.trim());
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

<form class="perfil" onsubmit={guardar}>
  <div class="cabeza">
    <label class="foto" title={sesion.usuario?.avatar || foto ? 'Cambiar foto' : 'Agregar foto'}>
      <img class="avatar" alt="Foto de perfil" src={previa || fotoDe(sesion.usuario, '256x256')} />
      <span class="lapiz">{#if sesion.usuario?.avatar || foto}<Pencil size={14} strokeWidth={2} />{:else}<Plus size={16} strokeWidth={2.25} />{/if}</span>
      <input type="file" hidden accept="image/png,image/jpeg,image/webp,image/gif" onchange={elegirFoto} aria-label="Foto de perfil" />
    </label>
    <div class="quien"><strong>{name || 'Sin apodo'}</strong><small>@{u.username}</small></div>
  </div>

  <label>Apodo <input bind:value={name} required maxlength="32" /></label>
  <label><span class="etiqueta">Descripción <small class="num">{descripcion.length}/50</small></span>
    <input bind:value={descripcion} maxlength="50" placeholder="Contá algo de vos" /></label>
  <div class="campo">
    <span class="etiqueta">Mail</span>
    <div class="mail"><span>{verMail ? u.email : oculto(u.email ?? '')}</span>
      <button type="button" class="icono" aria-label={verMail ? 'Ocultar mail' : 'Ver mail'} title={verMail ? 'Ocultar' : 'Ver'} onclick={() => (verMail = !verMail)}>
        {#if verMail}<EyeOff size={16} strokeWidth={1.75} />{:else}<Eye size={16} strokeWidth={1.75} />{/if}</button></div>
  </div>
  {#if error}<p role="alert">{error}</p>{/if}
  {#if ok}<p role="status">Perfil guardado.</p>{/if}
  <button type="submit" class="primario" disabled={ocupado}>Guardar cambios</button>
</form>

<style>
  .perfil { display: flex; flex-direction: column; gap: 16px; }
  .cabeza { display: flex; align-items: center; gap: 16px; margin-bottom: 4px; }
  .foto { position: relative; flex: none; cursor: pointer; }
  .foto .avatar { width: 88px; height: 88px; }
  .lapiz { position: absolute; right: 0; bottom: 0; display: grid; place-items: center; width: 28px; height: 28px; border-radius: 50%;
    background: var(--acento); color: var(--sobre-acento); box-shadow: 0 0 0 3px var(--elevado); }
  .foto:hover .lapiz { background: var(--acento-hover); }
  .quien { display: flex; flex-direction: column; min-width: 0; }
  .quien strong { font-size: 17px; font-weight: 650; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .etiqueta { display: flex; justify-content: space-between; }
  .campo { display: flex; flex-direction: column; gap: 4px; font-size: 13px; color: var(--tenue); }
  .mail { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 40px; padding: 0 4px 0 12px;
    background: var(--hondo); border: 1px solid var(--borde-fuerte); border-radius: var(--radio); color: var(--texto); font-size: 14px; }
  .mail span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; user-select: text; }
  [role='alert'], [role='status'] { margin: 0; font-size: 13px; }
</style>

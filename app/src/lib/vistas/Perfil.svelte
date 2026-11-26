<script lang="ts">
  import { Pencil, Plus, X } from '@lucide/svelte';
  import { foto as fotoDe } from '../foto';
  import { pb } from '../pb';
  import { validarAdjunto } from '../adjuntos';
  import { sesion, mensajeError } from '../sesion.svelte';
  import { REDES, COLORES, usuarioDeRed, type Redes } from '../perfil';
  import TarjetaPerfil from './TarjetaPerfil.svelte';

  // Mi perfil: arriba portada y foto; solapas Apariencia (apodo, descripción, color) y Sobre mí (juegos, redes, cumpleaños);
  // a la derecha, la tarjeta como la ven los demás, en vivo. El mail no va acá: está en Configuración → Cuenta.
  const MAX_IMAGEN = 5 * 1024 * 1024;
  const u = sesion.usuario!;
  let solapa = $state<'apariencia' | 'sobre'>('apariencia');
  let name = $state<string>(u.name ?? '');
  let descripcion = $state<string>(u.status ?? ''); // se guarda en `status`
  let color = $state<string>(u.color ?? '');
  let juegos = $state<string[]>([...((u.juegos ?? []) as string[])]);
  let juegoNuevo = $state('');
  let redes = $state<Redes>({ ...((u.redes ?? {}) as Redes) });
  let mostrarCumple = $state<boolean>(!!u.mostrarCumple);
  let foto = $state<File | null>(null);
  let portada = $state<File | null>(null);
  let sinPortada = $state(false);
  let previa = $state('');
  let previaPortada = $state('');
  let error = $state('');
  let ok = $state(false);
  let ocupado = $state(false);
  $effect(() => () => { if (previa) URL.revokeObjectURL(previa); if (previaPortada) URL.revokeObjectURL(previaPortada); });

  const portadaGuardada = $derived(!sinPortada && sesion.usuario?.portada ? pb.files.getURL(sesion.usuario, sesion.usuario.portada, { thumb: '600x200' }) : '');
  const portadaVista = $derived(previaPortada || portadaGuardada);
  // Lo que se está editando, para la tarjeta de la derecha (el cumpleaños lo calcula el servidor al guardar).
  const enVivo = $derived({ ...sesion.usuario!, name, status: descripcion, color, juegos, redes, portada: '',
    cumple: mostrarCumple ? sesion.usuario?.cumple || '' : '' });

  function imagen(ev: Event): File | null {
    const f = (ev.currentTarget as HTMLInputElement).files?.[0] ?? null;
    error = '';
    if (!f) return null;
    const v = validarAdjunto(f);
    if (!v.ok) error = v.motivo;
    else if (!f.type.startsWith('image/')) error = 'Tiene que ser una imagen.';
    else if (f.size > MAX_IMAGEN) error = 'La imagen supera los 5 MB.';
    else return f;
    return null;
  }
  function elegirFoto(ev: Event) {
    const f = imagen(ev);
    if (!f) return;
    foto = f;
    if (previa) URL.revokeObjectURL(previa);
    previa = URL.createObjectURL(f);
  }
  function elegirPortada(ev: Event) {
    const f = imagen(ev);
    if (!f) return;
    portada = f;
    sinPortada = false;
    if (previaPortada) URL.revokeObjectURL(previaPortada);
    previaPortada = URL.createObjectURL(f);
  }
  function quitarPortada() {
    portada = null;
    sinPortada = true;
    if (previaPortada) URL.revokeObjectURL(previaPortada);
    previaPortada = '';
  }
  function agregarJuego() {
    const j = juegoNuevo.trim().slice(0, 30);
    if (j && juegos.length < 5 && !juegos.some((x) => x.toLowerCase() === j.toLowerCase())) juegos.push(j);
    juegoNuevo = '';
  }

  async function guardar(ev: SubmitEvent) {
    ev.preventDefault();
    error = ''; ok = false; ocupado = true;
    try {
      const datos = new FormData();
      datos.append('name', name.trim());
      datos.append('status', descripcion.trim());
      datos.append('color', color);
      datos.append('juegos', JSON.stringify(juegos));
      datos.append('redes', JSON.stringify(Object.fromEntries(REDES.map(([k]) => [k, usuarioDeRed(redes[k] ?? '')]).filter(([, v]) => v))));
      datos.append('mostrarCumple', String(mostrarCumple));
      if (foto) datos.append('avatar', foto);
      if (portada) datos.append('portada', portada);
      else if (sinPortada) datos.append('portada', '');
      await pb.collection('users').update(u.id, datos); // authStore se actualiza solo
      foto = null; portada = null; sinPortada = false;
      ok = true;
    } catch (e) {
      error = mensajeError(e);
    } finally {
      ocupado = false;
    }
  }
</script>

<form class="perfil" onsubmit={guardar}>
  <div class="portada" style:background-image={portadaVista ? `url("${portadaVista}")` : undefined}>
    <div class="acciones-portada">
      {#if portadaVista}<button type="button" class="sobre-imagen" onclick={quitarPortada}>Quitar</button>{/if}
      <label class="boton sobre-imagen">Cambiar portada
        <input type="file" hidden accept="image/png,image/jpeg,image/webp,image/gif" onchange={elegirPortada} aria-label="Portada" /></label>
    </div>
  </div>
  <div class="cabeza">
    <label class="foto" title={sesion.usuario?.avatar || foto ? 'Cambiar foto' : 'Agregar foto'}>
      <img class="avatar" alt="Foto de perfil" src={previa || fotoDe(sesion.usuario, '256x256')} />
      <span class="lapiz">{#if sesion.usuario?.avatar || foto}<Pencil size={14} strokeWidth={2} />{:else}<Plus size={16} strokeWidth={2.25} />{/if}</span>
      <input type="file" hidden accept="image/png,image/jpeg,image/webp,image/gif" onchange={elegirFoto} aria-label="Foto de perfil" />
    </label>
    <div class="quien"><strong style:color={color || undefined}>{name || 'Sin apodo'}</strong><small>@{u.username}</small></div>
  </div>

  <div class="solapas" role="tablist">
    <button type="button" role="tab" class="plano" aria-selected={solapa === 'apariencia'} onclick={() => (solapa = 'apariencia')}>Apariencia</button>
    <button type="button" role="tab" class="plano" aria-selected={solapa === 'sobre'} onclick={() => (solapa = 'sobre')}>Sobre mí</button>
  </div>

  <div class="dividido">
    <div class="campos">
      {#if solapa === 'apariencia'}
        <label>Apodo <input bind:value={name} required maxlength="32" /></label>
        <label><span class="etiqueta">Descripción <small class="num">{descripcion.length}/50</small></span>
          <input bind:value={descripcion} maxlength="50" placeholder="Contá algo de vos" /></label>
        <div class="campo"><span>Color del nombre</span>
          <div class="colores" role="radiogroup" aria-label="Color del nombre">
            {#each COLORES as c (c)}
              <button type="button" role="radio" class="color" class:sin={!c} aria-checked={color === c} aria-label={c ? `Color ${c}` : 'Sin color'}
                style:--c={c || 'transparent'} onclick={() => (color = c)}></button>
            {/each}
          </div></div>
      {:else}
        <div class="campo"><span class="etiqueta">Juegos favoritos <small class="num">{juegos.length}/5</small></span>
          <div class="juegos">
            {#each juegos as j, i (j)}<span class="chip">{j}<button type="button" class="plano" aria-label={`Sacar ${j}`} onclick={() => juegos.splice(i, 1)}><X size={12} strokeWidth={2.25} /></button></span>{/each}
            {#if juegos.length < 5}<input bind:value={juegoNuevo} maxlength="30" placeholder="+ Agregar" aria-label="Agregar juego"
              onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); agregarJuego(); } }} onblur={agregarJuego} />{/if}
          </div></div>
        <div class="campo"><span>Redes</span>
          <div class="redes">
            {#each REDES as [k, nombre] (k)}
              <label class="red"><span>{nombre}</span><input value={redes[k] ?? ''} maxlength="80" placeholder="tu usuario" aria-label={nombre}
                oninput={(e) => (redes[k] = e.currentTarget.value)} onchange={(e) => (redes[k] = usuarioDeRed(e.currentTarget.value))} /></label>
            {/each}
          </div></div>
        <label class="casilla interruptor"><span>Mostrar mi cumpleaños<small>Solo día y mes, nunca la edad.</small></span>
          <input type="checkbox" class="switch" bind:checked={mostrarCumple} /></label>
      {/if}
    </div>
    <div class="previa"><h3>Así te ven</h3><TarjetaPerfil u={enVivo} foto={previa || undefined} portada={portadaVista} /></div>
  </div>

  {#if error}<p role="alert">{error}</p>{/if}
  {#if ok}<p role="status">Perfil guardado.</p>{/if}
  <button type="submit" class="primario" disabled={ocupado}>Guardar cambios</button>
</form>

<style>
  .perfil { display: flex; flex-direction: column; gap: 14px; }
  .portada { position: relative; height: 110px; border-radius: var(--radio-menu); background: var(--superficie) center / cover no-repeat; }
  .acciones-portada { position: absolute; top: 8px; right: 8px; display: flex; gap: 6px; }
  .sobre-imagen { min-height: 28px; padding: 3px 10px; font-size: 12.5px; color: #fff; background: rgb(0 0 0 / .5); border-color: rgb(255 255 255 / .2); cursor: pointer; }
  .cabeza { display: flex; align-items: flex-end; gap: 14px; margin-top: -58px; padding-left: 16px; pointer-events: none; }
  .cabeza > * { pointer-events: auto; }
  .foto { position: relative; flex: none; cursor: pointer; }
  .foto .avatar { width: 88px; height: 88px; border-radius: 50%; box-shadow: 0 0 0 5px var(--elevado); }
  .lapiz { position: absolute; right: 0; bottom: 0; display: grid; place-items: center; width: 28px; height: 28px; border-radius: 50%;
    background: var(--acento); color: var(--sobre-acento); box-shadow: 0 0 0 3px var(--elevado); }
  .foto:hover .lapiz { background: var(--acento-hover); }
  .quien { display: flex; flex-direction: column; min-width: 0; padding-bottom: 6px; }
  .quien strong { font-size: 17px; font-weight: 650; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .dividido { display: grid; grid-template-columns: minmax(0, 1fr) 230px; gap: 20px; align-items: start; }
  .campos { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
  .previa h3 { margin: 0 0 6px; }
  .etiqueta { display: flex; justify-content: space-between; }
  .campo { display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: var(--tenue); }
  .colores { display: flex; flex-wrap: wrap; gap: 8px; }
  .color { width: 26px; height: 26px; min-height: 0; padding: 0; border-radius: 50%; border: 0; background: var(--c); }
  .color:hover:not(:disabled) { background: var(--c); filter: brightness(1.1); }
  .color.sin { box-shadow: inset 0 0 0 2px var(--borde-fuerte); }
  .color[aria-checked='true'] { box-shadow: 0 0 0 2px var(--elevado), 0 0 0 4px var(--texto); }
  .juegos { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; min-height: 40px; padding: 5px 8px; background: var(--hondo);
    border: 1px solid var(--borde-fuerte); border-radius: var(--radio); }
  .chip { display: inline-flex; align-items: center; gap: 2px; padding: 0 2px 0 8px; font-size: 12px; color: var(--texto);
    border-radius: var(--radio-pildora); background: var(--superficie); border: 1px solid var(--borde); }
  .chip button { min-height: 22px; padding: 0 4px; }
  .juegos input { flex: 1; min-width: 90px; min-height: 28px; padding: 0 4px; border: 0; background: transparent; }
  .redes { display: flex; flex-direction: column; gap: 8px; }
  .red { display: grid; grid-template-columns: 76px minmax(0, 1fr); align-items: center; gap: 8px; color: var(--texto); font-weight: 600; font-size: 12.5px; }
  .interruptor { display: flex; flex-direction: row; align-items: center; justify-content: space-between; gap: 12px; color: var(--texto); font-size: 13.5px; }
  .interruptor small { display: block; color: var(--tenue); font-size: 12px; }
  [role='alert'], [role='status'] { margin: 0; font-size: 13px; }
  @media (max-width: 640px) {
    .dividido { grid-template-columns: minmax(0, 1fr); }
  }
</style>

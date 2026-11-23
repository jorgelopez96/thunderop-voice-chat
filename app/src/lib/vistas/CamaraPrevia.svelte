<script module lang="ts">
  import type { FondoCam } from '../prefs';
  export const FONDOS: { valor: FondoCam; nombre: string }[] = [{ valor: 'no', nombre: 'Sin efecto' }, { valor: 'suave', nombre: 'Suave' }, { valor: 'fuerte', nombre: 'Fuerte' }];
</script>

<script lang="ts">
  import { voz, pistaPreviaCam, compartirCamara, cancelarPreviaCamara, cambiarFondo, dispositivos, elegirCamara, voltearCamara, type Dispositivo } from '../voz.svelte';
  import { esCelular } from '../plataforma.svelte';
  import { SwitchCamera } from '@lucide/svelte';
  import { leerPrefs } from '../prefs';
  import Video from './Video.svelte';

  // Vista previa de la cámara: se ve solo acá (en espejo, como en un espejo; a los demás les llega derecha) hasta tocar
  // "Compartir cámara". Cerrarla de cualquier forma (Cancelar, Esc, ✕) apaga la cámara sin que nadie la vea.
  let d = $state<HTMLDialogElement>();
  let compartir = $state<HTMLButtonElement>();
  let camaras = $state<Dispositivo[]>([]);
  let elegida = $state('');
  const pista = $derived(pistaPreviaCam());

  $effect(() => {
    if (!d) return;
    if (voz.previaCam && !d.open) {
      d.showModal();
      d.focus(); // showModal enfoca la ✕ (lo primero que se puede enfocar) y Enter cancelaba: el foco pasa a Compartir al llegar la pista
      void dispositivos().then((x) => {
        camaras = x.camaras;
        const p = leerPrefs().camara;
        elegida = x.camaras.some((c) => c.deviceId === p) ? p! : (x.camaras[0]?.deviceId ?? '');
      });
    } else if (!voz.previaCam && d.open) d.close();
  });
  // Cuando la cámara arranca, el foco va a "Compartir" (así Enter comparte), salvo que ya esté en otro control.
  $effect(() => { if (pista && compartir && (!document.activeElement || document.activeElement === d || document.activeElement === document.body)) compartir.focus(); });

  function alCerrar() { if (voz.previaCam) cancelarPreviaCamara(); }
  function cambiarCam(id: string) { elegida = id; void elegirCamara(id); }
</script>

<dialog bind:this={d} class="previa" tabindex="-1" aria-labelledby="titulo-previa-cam" onclose={alCerrar}>
  <div class="cabecera">
    <h3 id="titulo-previa-cam">Vista previa de la cámara</h3>
    <button class="icono cerrar" onclick={() => d?.close()} aria-label="Cerrar" title="Cerrar">✕</button>
  </div>
  <div class="marco">
    {#if pista}<Video pista={pista} clase={voz.camTrasera ? 'previa-cam' : 'previa-cam espejo'} etiqueta="Vista previa de tu cámara" />{/if}
    {#if !pista}<span class="estado">Abriendo la cámara…</span>
    {:else if !voz.fondoListo}<span class="estado">Preparando el fondo…</span>{/if}
    <span class="solo">Solo vos ves esto</span>
    {#if esCelular}
      <button class="voltear" onclick={voltearCamara} disabled={!pista} aria-label={voz.camTrasera ? 'Usar la cámara frontal' : 'Usar la cámara trasera'}
        title={voz.camTrasera ? 'Usar la cámara frontal' : 'Usar la cámara trasera'}><SwitchCamera size={20} strokeWidth={1.75} /></button>
    {/if}
  </div>
  {#if camaras.length > 1}
    <label class="campo">Cámara
      <select value={elegida} onchange={(e) => cambiarCam(e.currentTarget.value)}>
        {#each camaras as c, i (c.deviceId)}<option value={c.deviceId}>{c.label || `Cámara ${i + 1}`}</option>{/each}
      </select>
    </label>
  {/if}
  <div class="campo">
    <span id="titulo-fondo">Fondo</span>
    <div class="opciones" role="group" aria-labelledby="titulo-fondo">
      {#each FONDOS as f (f.valor)}
        <button class="opcion" aria-pressed={voz.fondoCam === f.valor} disabled={!voz.fondoSoportado && f.valor !== 'no'} onclick={() => cambiarFondo(f.valor)}>{f.nombre}</button>
      {/each}
    </div>
  </div>
  {#if !voz.fondoSoportado}<small class="tenue">Tu equipo no permite difuminar el fondo.</small>{/if}
  <div class="fila acciones">
    <button class="plano" onclick={() => d?.close()}>Cancelar</button>
    <button class="primario" bind:this={compartir} onclick={compartirCamara} disabled={!pista}>Compartir cámara</button>
  </div>
</dialog>

<style>
  dialog.previa { width: min(560px, 94vw); max-width: none; flex-direction: column; gap: 14px; }
  dialog.previa[open] { display: flex; }
  .cabecera { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .cabecera h3 { margin: 0; }
  .cerrar { width: 32px; height: 32px; font-size: 14px; }
  .marco { position: relative; aspect-ratio: 16 / 9; border-radius: var(--radio-tarjeta); overflow: hidden; background: #000; }
  .marco :global(video.previa-cam) { width: 100%; height: 100%; object-fit: cover; display: block; }
  /* La frontal en espejo, como uno se ve en un espejo; la trasera muestra lo que tiene adelante, derecha. */
  .marco :global(video.previa-cam.espejo) { transform: scaleX(-1); }
  .voltear { position: absolute; left: 10px; bottom: 10px; width: 40px; height: 40px; padding: 0; border-radius: 999px; display: grid; place-items: center;
    color: #fff; background: rgb(0 0 0 / 0.6); backdrop-filter: blur(4px); }
  .voltear:disabled { opacity: 0.5; }
  .estado { position: absolute; inset: 0; display: grid; place-items: center; color: #fff; font-size: 14px; background: rgb(0 0 0 / 0.45); }
  .solo { position: absolute; right: 10px; bottom: 10px; padding: 3px 9px; border-radius: 999px; font-size: 12px; font-weight: 600;
    color: #fff; background: rgb(0 0 0 / 0.6); backdrop-filter: blur(4px); }
  .campo { display: flex; align-items: center; justify-content: space-between; gap: 12px; font-size: 14px; }
  .campo select { flex: 1; max-width: 320px; }
  .opciones { display: inline-flex; padding: 3px; gap: 3px; border-radius: var(--radio); background: var(--hondo); border: 1px solid var(--borde); }
  .opcion { height: 30px; padding: 0 14px; border-radius: calc(var(--radio) - 2px); background: transparent; color: var(--tenue); font-size: 13px; }
  .opcion:hover:not(:disabled) { color: var(--texto); background: var(--hover); }
  .opcion[aria-pressed='true'] { color: #fff; background: var(--acento); font-weight: 650; }
  .opcion:disabled { opacity: 0.45; cursor: not-allowed; }
  .tenue { color: var(--tenue); font-size: 13px; margin-top: -6px; }
  .acciones { justify-content: flex-end; }
</style>

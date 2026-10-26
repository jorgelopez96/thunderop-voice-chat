<script lang="ts">
  import { Mic, MicOff, PhoneOff } from '@lucide/svelte';
  import { voz, alternarMute, salirVoz } from '../../voz.svelte';
  import { grupoActual } from '../../grupos.svelte';
  import { navMovil } from '../../navMovil.svelte';

  // Celular: la llamada mientras mirás otra pantalla. Tocarla vuelve a la sala.
  function volver() {
    navMovil.irASala = true;
    if (grupoActual.id !== voz.grupoId) grupoActual.id = voz.grupoId;
  }
</script>

<div class="barra-llamada">
  <button class="plano volver" aria-label="Volver a la llamada" onclick={volver}>
    <span class="punto"></span><span class="texto"><strong>{voz.salaNombre}</strong><small class="num">{voz.participantes.length} en voz</small></span>
  </button>
  <button class="icono" class:apagado={voz.muteado} aria-label={voz.muteado ? 'Activar micrófono' : 'Silenciarme'} onclick={alternarMute}>
    {#if voz.muteado}<MicOff size={20} strokeWidth={1.75} />{:else}<Mic size={20} strokeWidth={1.75} />{/if}</button>
  <button class="icono colgar" aria-label="Desconectarse" onclick={salirVoz}><PhoneOff size={20} strokeWidth={1.75} /></button>
</div>

<style>
  .barra-llamada { flex: none; display: flex; align-items: center; gap: 6px; margin: 0 8px calc(8px + env(safe-area-inset-bottom)); padding: 4px 6px 4px 4px;
    background: var(--superficie); border: 1px solid color-mix(in srgb, var(--ok) 35%, var(--borde)); border-radius: var(--radio-grande); }
  .barra-llamada:not(:last-child) { margin-bottom: 8px; } /* arriba de las pestañas: ellas reservan la barra de gestos */
  .volver { flex: 1; min-width: 0; justify-content: flex-start; gap: 10px; min-height: 44px; padding: 0 10px; color: var(--texto); }
  .punto { width: 9px; height: 9px; border-radius: 50%; background: var(--ok); flex: none; }
  .texto { display: flex; flex-direction: column; align-items: flex-start; min-width: 0; line-height: 1.25; }
  .texto strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; }
  .texto small { font-size: 12px; color: var(--ok); }
  .icono { width: 44px; min-height: 44px; }
  .apagado { color: var(--peligro); }
  .colgar { background: var(--peligro); color: #fff; }
  .colgar:hover:not(:disabled) { background: var(--peligro-hover); color: #fff; }
</style>

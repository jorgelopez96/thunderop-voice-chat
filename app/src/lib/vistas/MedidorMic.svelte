<script lang="ts">
  import { dbALineal } from '../ganancia';

  // Barritas que suben con la voz, para ver cómo queda la ganancia. Abre el micrófono elegido solo mientras se ve.
  let { entrada, gananciaDb }: { entrada: string | undefined; gananciaDb: number } = $props();
  const BARRAS = 24;
  let nivel = $state(0); // barras encendidas
  let error = $state('');
  let gain: GainNode | undefined;
  $effect(() => { if (gain) gain.gain.value = dbALineal(gananciaDb); });
  $effect(() => {
    const id = entrada;
    let vivo = true, raf = 0, stream: MediaStream | undefined, ctx: AudioContext | undefined;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: id && id !== 'default' ? { deviceId: { exact: id } } : true });
        if (!vivo) return stream.getTracks().forEach((t) => t.stop());
        ctx = new AudioContext();
        const an = ctx.createAnalyser();
        an.fftSize = 1024;
        gain = ctx.createGain();
        gain.gain.value = dbALineal(gananciaDb);
        ctx.createMediaStreamSource(stream).connect(gain).connect(an);
        const datos = new Float32Array(an.fftSize);
        let antes = 0;
        const paso = (t = 0) => {
          raf = requestAnimationFrame(paso);
          if (t - antes < 33) return; // 30 cuadros por segundo alcanzan para leerlo
          antes = t;
          an.getFloatTimeDomainData(datos);
          let suma = 0;
          for (const x of datos) suma += x * x;
          const db = 20 * Math.log10(Math.sqrt(suma / datos.length) || 1e-8); // dBFS: −60 (silencio) a 0 (saturado)
          nivel = Math.round(Math.min(1, Math.max(0, (db + 60) / 60)) * BARRAS);
        };
        paso();
      } catch { error = 'No se pudo abrir el micrófono para medir.'; }
    })();
    return () => { vivo = false; cancelAnimationFrame(raf); stream?.getTracks().forEach((t) => t.stop()); void ctx?.close(); gain = undefined; };
  });
</script>

{#if error}<small>{error}</small>
{:else}<div class="medidor" role="meter" aria-label="Nivel del micrófono" aria-valuemin="0" aria-valuemax={BARRAS} aria-valuenow={nivel}>
  {#each { length: BARRAS } as _, i (i)}<span class:on={i < nivel} class:alto={i >= BARRAS - 5} style="height:{15 + (i / (BARRAS - 1)) * 85}%"></span>{/each}
</div>{/if}

<style>
  .medidor { display: flex; align-items: flex-end; gap: 3px; height: 48px; }
  /* Barras de alto fijo: solo se encienden por clase, nunca se anima la altura. */
  span { flex: 1; border-radius: 2px; background: var(--elevado-2); }
  span.on { background: var(--acento); }
  span.on.alto { background: var(--ausente); } /* las últimas 5: cerca de saturar */
  small { color: var(--tenue); font-size: 12px; }
</style>

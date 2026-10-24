<script lang="ts">
  import { openUrl } from '@tauri-apps/plugin-opener';

  let { aceptado = $bindable(false) }: { aceptado: boolean } = $props();
  const abrir = (ev: MouseEvent, ruta: string) => { ev.preventDefault(); void openUrl(`https://thunderop-web.vercel.app/${ruta}`); };
</script>

<label class="casilla">
  <input type="checkbox" bind:checked={aceptado} />
  <span>Acepto los <a href="https://thunderop-web.vercel.app/terminos" onclick={(e) => abrir(e, 'terminos')}>términos</a>
    y la <a href="https://thunderop-web.vercel.app/privacidad" onclick={(e) => abrir(e, 'privacidad')}>política de privacidad</a></span>
</label>

<style>
  .casilla { flex-direction: row; align-items: center; gap: 8px; }
  a { color: var(--acento-texto); }
</style>

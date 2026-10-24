<script lang="ts">
  import { requisitosClave } from '../reglasCuenta';

  let { clave }: { clave: string } = $props();
  const req = $derived(requisitosClave(clave));
</script>

<ul>
  <li class:ok={req.largo}>8 caracteres o más</li>
  <li class:ok={req.mayuscula}>Una mayúscula</li>
  <li class:ok={req.numero}>Un número</li>
  <li class:ok={req.especial}>Un carácter especial</li>
</ul>

<style>
  ul { font-size: 12px; color: var(--apagado); display: grid; gap: 2px; }
  li::before { content: '○ '; }
  li.ok { color: var(--ok); }
  li.ok::before { content: '✓ '; }
</style>

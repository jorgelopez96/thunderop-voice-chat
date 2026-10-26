// Tauri doesn't have a Node.js server to do proper SSR
// so we use adapter-static with a fallback to index.html to put the site in SPA mode
// See: https://svelte.dev/docs/kit/single-page-apps
// See: https://v2.tauri.app/start/frontend/sveltekit/ for more info
import adapter from "@sveltejs/adapter-static";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

// Compilación web (`vite build --mode web`): SvelteKit agrega una CSP en <meta> con el hash de su script de arranque
// (la cabecera de Vercel sola lo bloqueaba). En escritorio la CSP la maneja Tauri (tauri.conf.json).
const i = process.argv.indexOf('--mode');
const web = i >= 0 && process.argv[i + 1] === 'web';
const PB = 'https://thunderop.duckdns.org';
const csp = {
  mode: 'hash',
  directives: {
    'default-src': ['self'],
    'script-src': ['self', 'wasm-unsafe-eval', 'https://www.youtube.com'],
    'style-src': ['self', 'unsafe-inline'],
    'img-src': ['self', 'data:', 'blob:', 'https:'],
    'media-src': ['self', 'blob:', PB],
    'connect-src': ['self', PB, 'wss://thunderop.duckdns.org', 'https://www.youtube.com'],
    'frame-src': ['https://www.youtube.com'],
    'worker-src': ['self', 'blob:'],
    'form-action': ['self'],
  },
};

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      fallback: "index.html",
    }),
    ...(web ? { csp } : {}),
  },
};

export default config;

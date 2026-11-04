// Genera src/lib/emojisDatos.ts: todos los emojis de Unicode (emoji-test.txt) con nombre y palabras clave en español (CLDR).
// Uso: node scripts/generar-emojis.mjs. Volver a correrlo cuando salga una versión nueva de emojis.
import { writeFile } from 'node:fs/promises';

const TEST = 'https://unicode.org/Public/emoji/latest/emoji-test.txt';
const CLDR = 'https://raw.githubusercontent.com/unicode-org/cldr-json/main/cldr-json';
// es y encima es-419 (lo latinoamericano pisa a lo de España).
const ANOTACIONES = ['es', 'es-419'].flatMap((l) => [`${CLDR}/cldr-annotations-full/annotations/${l}/annotations.json`, `${CLDR}/cldr-annotations-derived-full/annotationsDerived/${l}/annotations.json`]);
// Grupos de emoji-test en el orden de las pestañas (Component queda afuera: son los tonos y pelos sueltos).
const GRUPOS = ['Smileys & Emotion', 'People & Body', 'Animals & Nature', 'Food & Drink', 'Activities', 'Travel & Places', 'Objects', 'Symbols', 'Flags'];
const TONOS = ['\u{1F3FB}', '\u{1F3FC}', '\u{1F3FD}', '\u{1F3FE}', '\u{1F3FF}'];
// Iguales a conTono y normalizar de src/lib/emojis.ts.
const conTono = (e, t) => e.replace(/(\p{Emoji_Modifier_Base})\u{FE0F}?/gu, `$1${t}`);
const normalizar = (s) => s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const VACIAS = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'con', 'y', 'o', 'en', 'a', 'al', 'un', 'una', 'por', 'para', 'sin']);
// Desde esta versión se marca cada emoji, para esconder los que el sistema no sabe dibujar (Windows 10 quedó en la 12-13).
const MARCAR_DESDE = 12;

const bajar = async (url) => { const r = await fetch(url); if (!r.ok) throw new Error(`${url}: ${r.status}`); return r; };
const texto = await (await bajar(TEST)).text();
const anot = {};
for (const url of ANOTACIONES) {
  const json = await (await bajar(url)).json();
  for (const [k, v] of Object.entries(json[url.includes('Derived') ? 'annotationsDerived' : 'annotations'].annotations)) anot[k] = { ...anot[k], ...v };
}

const todos = new Set(), lista = [];
let grupo = -1;
for (const linea of texto.split('\n')) {
  const g = /^# group: (.+)$/.exec(linea);
  if (g) { grupo = GRUPOS.indexOf(g[1].trim()); continue; }
  const m = /^[0-9A-F ]+;\s*fully-qualified\s*#\s*(\S+)\s+E(\d+\.\d+)\s+(.+)$/.exec(linea);
  if (!m) continue;
  todos.add(m[1]);
  if (grupo >= 0 && !/[\u{1F3FB}-\u{1F3FF}]/u.test(m[1])) lista.push({ e: m[1], version: m[2], ingles: m[3].trim(), grupo });
}

const categorias = GRUPOS.map(() => []), versiones = {};
let sinEspañol = 0;
for (const { e, version, ingles, grupo } of lista) {
  const a = anot[e] ?? anot[e.replace(/\u{FE0F}/gu, '')];
  if (!a?.tts) sinEspañol++;
  const nombre = (a?.tts?.[0] ?? ingles).replace(/[|\n]/g, ' ');
  // Las claves van palabra por palabra y sin repetir: el buscador compara por comienzo de palabra.
  const enNombre = new Set(normalizar(nombre).split(' '));
  const claves = new Set(normalizar((a?.default ?? []).join(' ')).split(' ').filter((p) => p && !enNombre.has(p) && !VACIAS.has(p)));
  const tono = conTono(e, TONOS[0]) !== e && TONOS.every((t) => todos.has(conTono(e, t))) ? '~' : '';
  const v = Number(version) >= MARCAR_DESDE ? `@${version}` : '';
  // Muestra de cada versión para probar si se dibuja: el primer emoji de un solo carácter, si hay.
  if (v && (!versiones[version] || ([...versiones[version]].length > 1 && [...e].length === 1))) versiones[version] = e;
  categorias[grupo].push(`${e}${tono}${v} ${nombre}|${[...claves].join(' ')}`);
}

const salida = `// Generado por scripts/generar-emojis.mjs (Unicode emoji-test.txt + CLDR es/es-419). No editar a mano.
// Una línea por emoji: "EMOJI[~][@versión] nombre|claves sueltas"; ~ = admite tono de piel.
export const CATEGORIAS = ${JSON.stringify(categorias.map((c) => c.join('\n')))};
export const VERSIONES: Record<string, string> = ${JSON.stringify(versiones)};
`;
await writeFile(new URL('../src/lib/emojisDatos.ts', import.meta.url), salida);
console.log(`${lista.length} emojis (${sinEspañol} sin nombre en español), ${(Buffer.byteLength(salida) / 1024).toFixed(1)} KB`);

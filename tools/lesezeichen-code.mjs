/**
 * Dieselbe Erzeugung wie in src/lib/lesezeichen.ts, damit die Probe
 * wirklich den ausgelieferten Code prueft. Gelesen wird die Quelle;
 * abgeschrieben wird nichts -- eine Kopie waere schon morgen alt.
 */
import { readFileSync } from 'node:fs';
const ts = readFileSync(new URL('../src/lib/lesezeichen.ts', import.meta.url), 'utf8');
export function lesezeichenCode(ziel, kanton = '') {
  const anfang = ts.indexOf('const quelle = `');
  const ende = ts.indexOf('`;', anfang);
  const roh = ts.slice(anfang + 'const quelle = `'.length, ende);
  const quelle = roh
    .replace(/\$\{ziel\}/g, ziel)
    .replace(/\$\{kanton\}/g, kanton)
    .replace(/\\\\/g, '\\');
  return 'javascript:' + encodeURIComponent(quelle.replace(/\s*\n\s*/g, ' '));
}

// Schreibt die Umleitungen je Marke in vercel.json (src/lib/seo-marken.ts).
// Aufruf nach jeder neuen Domain: npx tsx tools/vercel-marken.ts
// Der Test seo-marken.test.ts wird rot, wenn vercel.json nicht passt.
import { readFileSync, writeFileSync } from 'node:fs';
import { vercelUmleitungen } from '../src/lib/seo-marken';
const v = JSON.parse(readFileSync('vercel.json', 'utf8'));
const allgemein = v.rewrites.filter((r: { has?: unknown }) => !r.has);
v.rewrites = [...vercelUmleitungen(), ...allgemein];
writeFileSync('vercel.json', JSON.stringify(v, null, 2) + '\n');
console.log(`Umleitungen: ${v.rewrites.length}`);

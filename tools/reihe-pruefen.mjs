/**
 * Die Reihe von zwanzig, in einem echten Chromium.
 *
 * Gegen das echte ThurGIS laesst sich von hier nicht pruefen -- dorthin
 * gibt es keine Verbindung, und eine Abfrage waere eine echte Abfrage.
 * Geprueft wird deshalb die Mechanik an einer Attrappe, die sich
 * verhaelt wie das Portal: ein Suchfeld, eine Vorschlagsliste, eine
 * Karte, und nach dem Klick ein Auszug im Wortlaut von ThurGIS.
 *
 * Damit steht fest, ob die Schleife durchlaeuft, ob jeder Auszug der
 * richtigen Parzelle zugeordnet wird und ob ein unlesbarer Fall
 * uebersprungen statt falsch eingetragen wird. Was offen bleibt: ob
 * das echte Portal auf dieselben Handgriffe reagiert.
 *
 * Aufruf: node tools/reihe-pruefen.mjs
 */
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

// Den erzeugten Lesezeichen-Code aus der Quelle holen, damit hier
// wirklich das laeuft, was ausgeliefert wird.
const quelle = readFileSync('src/lib/lesezeichen.ts', 'utf8');

const PARZELLEN = [
  { egrid: 'CH111111111111', nr: '447', eig: 'Rudolf Gubler, Grabenstrasse 12, 8253 Diessenhofen, 1/1' },
  { egrid: 'CH222222222222', nr: '540', eig: 'Cetin Demirciler, Landenbergerstrasse 1, 8253 Diessenhofen, 1/1' },
  { egrid: 'CH333333333333', nr: '752', eig: 'Martin Tanner, Am Bergli 13, 8253 Willisdorf, 1/1' },
  // Der Fall, der nicht eindeutig ist: zwei Nummern, keine Zuordnung.
  { egrid: 'CH444444444444', nr: '?', eig: 'Unklar AG', kaputt: true },
];

const portalSeite = `<!doctype html><meta charset="utf-8">
<input id="suche" type="text" style="width:400px;height:24px">
<ul id="treffer"></ul>
<div id="karte" style="width:500px;height:300px;background:#eee"></div>
<div id="auszug"></div>
<script>
const P = ${JSON.stringify(PARZELLEN)};
let gewaehlt = null;
document.getElementById('suche').addEventListener('input', e => {
  const t = document.getElementById('treffer');
  t.innerHTML = '';
  const p = P.find(x => x.egrid === e.target.value.trim());
  if (!p) return;
  // Wie im Portal: ein unbrauchbarer Vorschlag steht mit dabei.
  const projektiert = document.createElement('li');
  projektiert.textContent = 'Projektierter Bestand ' + p.egrid;
  t.appendChild(projektiert);
  const li = document.createElement('li');
  li.textContent = p.egrid + ' (Gde. Diessenhofen)';
  li.addEventListener('click', () => { gewaehlt = p; });
  t.appendChild(li);
});
document.getElementById('karte').addEventListener('click', () => {
  if (!gewaehlt) return;
  const p = gewaehlt;
  setTimeout(() => {
    document.getElementById('auszug').innerText =
      'Grundbuch-Auszug\\nEigentümerinformationen\\n' + p.eig +
      '\\nZusätzliche Informationen\\nGrundbuch: Nr. 4545 Diessenhofen\\n' +
      (p.kaputt
        ? 'CH999999999999 und CH888888888888\\n'
        : 'Grundstück: Liegenschaft Nr. ' + p.nr + ' ( ' + p.egrid + ' )\\n') +
      'Disclaimer';
  }, 400);
});
</script>`;

const appSeite = `<!doctype html><meta charset="utf-8"><p id="stand">app</p>
<script>
window.name = 'bauraum-app';
window.eingetragen = [];
window.addEventListener('message', e => {
  const d = e.data || {};
  if (d.bauraum === 'reihe-bitte') {
    e.source.postMessage({ bauraum: 'reihe', reihe: ${JSON.stringify(
      PARZELLEN.map((p, i) => ({ id: String(i), egrid: p.egrid, address: 'Weg ' + p.nr, parzelle: p.nr })),
    )} }, '*');
    return;
  }
  if (d.bauraum === 'auskunft') {
    window.eingetragen.push({ egrid: d.daten.egrid, parzelle: d.daten.parzelle });
    e.source.postMessage({ bauraum: 'erhalten' }, '*');
  }
});
</script>`;

const server = createServer((q, a) => {
  a.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  a.end(q.url.startsWith('/portal') ? portalSeite : appSeite);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const basis = `http://127.0.0.1:${server.address().port}`;

// Den Lesezeichen-Code erzeugen, so wie die Seite es tut.
const { lesezeichenCode } = await import('./lesezeichen-code.mjs');
const code = decodeURIComponent(lesezeichenCode(basis, 'TG').replace(/^javascript:/, ''));

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await b.newContext();
const app = await ctx.newPage();
await app.goto(basis + '/');
const portal = await ctx.newPage();
await portal.goto(basis + '/portal');

portal.on('console', m => { if (m.text().includes('Fehler')) console.log('Portal:', m.text()); });
await portal.evaluate(c => { (0, eval)(c); }, code);

// Das Lesezeichen findet den von Hand geoeffneten Bauraum-Tag nicht
// und macht sich einen eigenen auf -- ab dann laeuft alles ueber
// diesen. Genau der ist zu befragen, nicht der erste.
await portal.waitForTimeout(1500);
const echteApp = ctx.pages().at(-1);

// Warten, bis der Balken "fertig" meldet -- hoechstens zwei Minuten.
const bis = Date.now() + 120000;
let balken = '';
while (Date.now() < bis) {
  balken = await portal.evaluate(
    () => document.getElementById('bauraum-hinweis')?.textContent || '');
  if (/fertig:/.test(balken)) break;
  await new Promise(r => setTimeout(r, 1000));
}

const eingetragen = await echteApp.evaluate(() => window.eingetragen || []);
console.log('Balken am Schluss:', balken);
console.log('Eingetragen:', JSON.stringify(eingetragen));
console.log('Tabs:', ctx.pages().length);
await b.close();
server.close();

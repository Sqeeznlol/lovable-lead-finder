/**
 * Laeuft die Erweiterung ueberhaupt an?
 *
 * "Sie macht gar nichts" kann vieles heissen. Hier wird der Reihe nach
 * nachgesehen, was messbar ist:
 *
 *   1. Laedt Chrome sie ohne Fehler?
 *   2. Setzt sie auf der Seite ihr Erkennungszeichen?
 *   3. Kommt ein Auftrag aus der Seite im Hintergrunddienst an?
 *
 * Das echte Portal wird dabei nicht angefasst -- geprueft wird die
 * Kette bis zum Hintergrunddienst, und genau dort faellt auf, wenn
 * schon der Anfang fehlt.
 *
 * Aufruf: node tools/erweiterung-pruefen.mjs
 */
import { createServer } from 'node:http';
import { chromium } from 'playwright';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const server = createServer((q, a) => {
  a.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  a.end('<!doctype html><meta charset="utf-8"><p id="wer">app</p>');
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const basis = `http://localhost:${server.address().port}`;

const profil = mkdtempSync(join(tmpdir(), 'bauraum-'));
const ctx = await chromium.launchPersistentContext(profil, {
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  headless: false,
  args: [
    '--headless=new',
    `--disable-extensions-except=${process.cwd()}/extension`,
    `--load-extension=${process.cwd()}/extension`,
  ],
});

const seite = await ctx.newPage();
const fehler = [];
seite.on('pageerror', e => fehler.push(String(e)));
await seite.goto(basis + '/');
await seite.waitForTimeout(2500);

const marker = await seite.evaluate(
  () => !!document.getElementById('akquise-extension-marker'));
console.log('1. Erkennungszeichen auf der Seite:', marker ? 'da' : 'FEHLT');

// Kommt ein Auftrag im Hintergrunddienst an?
const angekommen = await seite.evaluate(() => new Promise(fertig => {
  let ok = false;
  window.addEventListener('akquise-owner-data', () => { ok = true; });
  window.dispatchEvent(new CustomEvent('akquise-start-reihe', {
    detail: { objekte: [{ propertyId: 'x', egrid: 'CH627728290920', kanton: 'TG' }] },
  }));
  setTimeout(() => fertig(ok), 2000);
}));
console.log('2. Auftrag angenommen (ohne Fehler auf der Seite):', fehler.length === 0 ? 'ja' : fehler[0]);
console.log('   Rueckmeldung an die Seite:', angekommen ? 'ja' : 'keine (erwartet, ohne Portal)');

// Oeffnet der Hintergrunddienst das Portal? Das ist das sichtbare
// Zeichen, dass ein Auftrag wirklich angekommen ist.
await seite.waitForTimeout(2500);
const tabs = ctx.pages().map(p => p.url());
console.log('   Tabs danach:', tabs.length, tabs.map(u => u.slice(0, 60)));

// Was sagt der Hintergrunddienst?
const dienste = ctx.serviceWorkers();
console.log('3. Hintergrunddienst laeuft:', dienste.length ? 'ja' : 'NEIN');
if (dienste.length) console.log('   Adresse:', dienste[0].url().replace(/^chrome-extension:\/\/[a-z]+/, 'chrome-extension://…'));

await ctx.close();
server.close();

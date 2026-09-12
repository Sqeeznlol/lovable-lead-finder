/**
 * Der Weg zurueck ins Portal -- auch in einen Tag, den die Anwendung
 * nie geoeffnet hat.
 *
 * Ueber den Fensternamen geht das nicht: zwei Tage, die nichts
 * miteinander zu tun haben, finden einander nie, und es entsteht ein
 * weiterer. An einer Nachricht haengt dagegen die Absenderkennung, und
 * die fuehrt zurueck -- ohne neuen Tag.
 *
 * Gemessen wird mit zwei echten Adressen auf 127.0.0.1, nicht mit
 * leeren Seiten: leere Seiten haben keine Basis, und eine Navigation
 * darauf sagt nichts ueber den Ernstfall.
 *
 * Aufruf: node tools/rueckweg-pruefen.mjs
 */
import { createServer } from 'node:http';
import { chromium } from 'playwright';

const server = createServer((q, a) => {
  a.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  a.end(q.url.startsWith('/portal') ? '<p id="wer">portal</p>' : '<p id="wer">app</p>');
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const basis = `http://127.0.0.1:${server.address().port}`;

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

async function lauf(weg) {
  const ctx = await b.newContext();

  // Der Bauraum-Tag, den der Benutzer selbst aufgemacht hat.
  const alt = await ctx.newPage();
  await alt.goto(`${basis}/app`);
  await alt.evaluate(() => { window.name = 'bauraum-app'; });

  // Das Portal, ebenfalls von Hand -- die beiden wissen nichts
  // voneinander.
  const portal = await ctx.newPage();
  await portal.goto(`${basis}/portal`);

  // Erster Klick aufs Lesezeichen: der alte Tag ist nicht zu finden,
  // also entsteht ein eigener. Ab hier gehoeren Portal und Anwendung
  // zusammen -- das ist der Dauerzustand.
  await portal.evaluate(b => { window.open(b + '/app', 'bauraum-app'); }, basis);
  await portal.waitForTimeout(600);
  const app = ctx.pages().at(-1);
  await app.evaluate(() => {
    window.addEventListener('message', e => {
      if (e.data && e.data.bauraum === 'auskunft') window.absender = e.source;
    });
  });
  await portal.evaluate(() => {
    const a = window.open('', 'bauraum-app');
    if (a) a.postMessage({ bauraum: 'auskunft', daten: { name: 'Cetin Demirciler' } }, '*');
  });
  await portal.waitForTimeout(300);
  const nachSenden = ctx.pages().length;

  // Zurueck mit der naechsten Parzelle.
  await app.evaluate(([w, bs]) => {
    if (w === 'name') { window.open(bs + '/portal?naechste', 'bauraum-portal'); return; }
    if (window.absender) window.absender.location.href = bs + '/portal?naechste';
  }, [weg, basis]);
  await app.waitForTimeout(700);

  const r = {
    tabsNachSenden: nachSenden,
    tabsAmSchluss: ctx.pages().length,
    portalZeigt: await portal.evaluate(() => location.search).catch(() => '(weg)'),
  };
  await ctx.close();
  return r;
}

console.log('ueber den Fensternamen :', await lauf('name'));
console.log('ueber die Nachricht    :', await lauf('nachricht'));
await b.close();
server.close();

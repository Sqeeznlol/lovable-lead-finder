/**
 * Der zweite Durchgang, in einem echten Chromium.
 *
 * Der erste ging, der zweite nicht -- weil der Bauraum-Tag beim
 * zweiten Mal schon offen ist und nur der Teil hinter der Raute
 * wechselt. Hier laeuft genau das ab: App oeffnen, Portal oeffnen,
 * zweimal "Lesezeichen", und gezaehlt wird, was ankommt.
 *
 * Die Gegenprobe laeuft dieselbe Folge ohne den Horcher auf den
 * Rautenwechsel -- dort muss der zweite Durchgang liegen bleiben,
 * sonst misst die Probe nichts.
 *
 * Aufruf: node tools/lesezeichen-pruefen.mjs
 */
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

async function durchlauf(mitHorcher) {
  const ctx = await b.newContext();
  const app = await ctx.newPage();
  await app.setContent('<p id="stand">nichts</p>');
  await app.evaluate(horcher => {
    window.name = 'bauraum-app';
    const zeigen = () => {
      const h = location.hash;
      if (!h.startsWith('#auskunft=')) return;
      document.getElementById('stand').textContent = decodeURIComponent(h.slice(10));
      history.replaceState(null, '', location.pathname);
    };
    zeigen();
    if (horcher) window.addEventListener('hashchange', zeigen);
  }, mitHorcher);

  const ergebnisse = [];
  for (const wert of ['Cetin Demirciler', 'Martin Tanner']) {
    await app.evaluate(() => window.open('about:blank#portal', 'bauraum-portal'));
    await app.waitForTimeout(200);
    const portal = ctx.pages().at(-1);
    await portal.evaluate(w => {
      const a = window.open('about:blank#auskunft=' + encodeURIComponent(w), 'bauraum-app');
      if (a) a.focus();
      setTimeout(() => { try { window.close(); } catch (e) {} }, 200);
    }, wert);
    await app.waitForTimeout(600);
    ergebnisse.push({
      tabs: ctx.pages().length,
      stand: await app.evaluate(() => document.getElementById('stand').textContent),
    });
  }
  await ctx.close();
  return ergebnisse;
}

const mit = await durchlauf(true);
const ohne = await durchlauf(false);
console.log('mit Horcher   1.:', mit[0], ' 2.:', mit[1]);
console.log('ohne Horcher  1.:', ohne[0], ' 2.:', ohne[1]);
await b.close();

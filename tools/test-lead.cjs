/**
 * Schickt einen TEST-Lead über eine Check-Seite, wie ein Besucher auf dem
 * iPhone (Julian, 21. November: «schick einen TEST-Lead durch und prüf, ob er
 * ankommt»). Name «TEST …», Quelle test (utm_source=test): so ist er
 * gekennzeichnet und ausblendbar. Ob er ankommt, zählt danach der Ablauf in
 * der Datenbank; hier steht nur, was die Seite zeigt.
 */
const { chromium, devices } = require('playwright-core');

(async () => {
  const seiteUrl = process.env.SEITE || 'https://www.zonen-check.ch/';
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM });
  const ctx = await browser.newContext({ ...devices['iPhone 13'] });
  const seite = await ctx.newPage();
  const fehler = []; seite.on('pageerror', e => fehler.push(e.message));
  const antworten = [];
  seite.on('response', r => { if (r.request().method() === 'POST' && /\/rest\/v1\/anfrage/.test(r.url())) antworten.push(r.status()); });

  await seite.goto(`${seiteUrl}?utm_source=test&utm_campaign=TEST`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await seite.waitForTimeout(3000);
  const nur = seite.getByRole('button', { name: /Nur nötige|Ablehnen/ }).first();
  if (await nur.count()) await nur.click();
  await seite.locator('#pc-eingabe').fill('Mutschellenstrasse 49 Zürich');
  await seite.waitForTimeout(4000);
  const v = seite.locator('[role="option"], li button, ul li').filter({ hasText: /Mutschellenstrasse 49/ }).first();
  if (await v.count()) await v.click(); else await seite.locator('#pc-eingabe').press('Enter');
  await seite.waitForTimeout(10000);
  await seite.getByRole('button', { name: /kostenlos berechnen|Analyse|weiter/i }).first().click();
  await seite.waitForTimeout(800);
  for (let i = 0; i < 6 && !(await seite.locator('#pc-kontakt').count()); i++) {
    await seite.locator('.wahl button').first().click();
    await seite.waitForTimeout(700);
  }
  console.log(`Kontaktfeld erreicht: ${(await seite.locator('#pc-kontakt').count()) ? 'ja' : 'nein'}`);
  // Die Seite nimmt nur echte Schweizer Nummern an (keine Reihen gleicher Ziffern):
  // 044 000 12 34 hat die Form einer Zürcher Nummer im unvergebenen Bereich 000.
  for (const wert of ['TEST Lead GitHub', 'Teststrasse 1, 8000 Zürich', '044 000 12 34', 'test@example.ch']) {
    await seite.locator('#pc-kontakt').fill(wert);
    await seite.waitForTimeout(400);
    await seite.locator('button.senden').click();
    await seite.waitForTimeout(1500);
    const hinweis = (await seite.locator('.hinweis-feld').allInnerTexts()).join(' ').trim();
    if (hinweis) console.log(`Hinweis beim Feld: ${hinweis}`);
  }
  await seite.waitForTimeout(6000);
  const dank = await seite.locator('.freigeschaltet').innerText().catch(() => '');
  const meldung = await seite.locator('.fehler').allInnerTexts();
  console.log(`Seite: ${seiteUrl}`);
  console.log(`Antwort der Datenbank auf das Einfügen: ${antworten.join(', ') || 'keine'}`);
  console.log(`Bestätigung auf der Seite: ${dank ? 'ja' : 'nein'}${meldung.length ? ` | Meldung: ${meldung.join(' ')}` : ''}`);
  console.log(`Fehler im Browser: ${fehler.length}`);
  await browser.close();
  if (!dank || !antworten.includes(201)) process.exit(1);
})().catch(e => { console.log(`Abbruch: ${e.message.split('\n')[0]}`); process.exit(1); });

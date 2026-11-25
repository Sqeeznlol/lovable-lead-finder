/**
 * Legt in CALC YOU LATER einen Entwurf zu einer Adresse an, mit dem
 * Arbeitskonto, und lässt ihn stehen (25. November, Julian zu einer Adresse
 * aus Google Maps: «kannst du das nicht selber machen?»). Derselbe Weg wie
 * der Durchgang in «Reiter prüfen», nur ohne Löschen.
 *
 * Das Protokoll ist öffentlich: es nennt nur, ob gerechnet und gespeichert
 * wurde, und die Nummer des Entwurfs; keine Preise, keine Eigentümer.
 *
 * Aufruf: KONTO_AUI=... CALC_ADRESSE="Strasse 1, 8000 Ort" node tools/calc-anlegen.cjs
 */
let pw; try { pw = require('playwright'); } catch { pw = require('playwright-core'); }
const { chromium } = pw;

const ADRESSE = (process.env.ADRESSE || 'https://www.wohntraums.life').replace(/\/$/, '');
const ZIEL = (process.env.CALC_ADRESSE || '').trim();

(async () => {
  if (!ZIEL) { console.error('Keine Adresse angegeben.'); process.exit(1); }
  if (!process.env.KONTO_AUI) { console.error('Secret KONTO_AUI fehlt.'); process.exit(1); }
  const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  const seite = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  // Die 3D-Fotokacheln von Google kosten je Aufruf; hier braucht es keine.
  await seite.route(/tile\.googleapis\.com/, r => r.abort());

  await seite.goto(ADRESSE + '/', { waitUntil: 'domcontentloaded' });
  await seite.waitForTimeout(1500);
  if (await seite.locator('#passwort').count()) {
    await seite.fill('#passwort', process.env.KONTO_AUI);
    await seite.click('button[type=submit]');
    await seite.waitForSelector('#passwort', { state: 'detached', timeout: 20000 }).catch(() => {});
  }
  if (await seite.locator('#passwort').count()) { console.log('Anmeldung fehlgeschlagen.'); process.exit(1); }

  await seite.goto(`${ADRESSE}/calc?neu=${encodeURIComponent(ZIEL)}`, { waitUntil: 'domcontentloaded' });
  const gerechnet = await seite.waitForFunction(() => /Kaufpreisempfehlung CHF|Noch keine Empfehlung/.test(document.body.innerText), null, { timeout: 60000 }).then(() => true).catch(() => false);
  if (!gerechnet) { console.log(`«${ZIEL}»: CALC hat nicht gerechnet (Adresse nicht gefunden oder Dienst träge).`); process.exit(1); }
  const text = await seite.locator('main').innerText();
  const empfehlung = /Kaufpreisempfehlung CHF/.test(text);
  await seite.getByRole('button', { name: 'Als Entwurf speichern' }).click();
  const gespeichert = await seite.getByRole('button', { name: 'Entwurf löschen' }).waitFor({ state: 'visible', timeout: 20000 }).then(() => true).catch(() => false);
  if (!gespeichert) { console.log(`«${ZIEL}»: gerechnet, aber der Entwurf liess sich nicht speichern.`); process.exit(1); }
  await seite.waitForTimeout(1500);
  const link = new URL(seite.url());
  console.log(`«${ZIEL}»: Entwurf angelegt, ${empfehlung ? 'mit Empfehlung' : 'ohne Empfehlung (Begründung auf der Seite)'}.`);
  console.log(`Öffnen: ${ADRESSE}${link.pathname}${link.search}`);
  await browser.close();
})().catch(e => { console.error('Fehler:', String(e.message).split('\n')[0]); process.exit(1); });

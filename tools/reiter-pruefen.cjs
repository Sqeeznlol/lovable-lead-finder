/**
 * Klickt jeden Reiter von Aurora durch, auf dem iPhone und am Computer,
 * und meldet, was dabei bricht: Fehler im Programm, Abfragen, die die
 * Datenbank ablehnt oder die lange brauchen, Seiten, die über den Rand
 * ragen, und Text wie "NaN" oder "undefined", der nur bei einem
 * Rechenfehler sichtbar wird.
 *
 * Warum: bis zum 15. November war kein einziger Reiter je mit echten
 * Daten durchgeklickt worden -- geprüft wurde mit Attrappen, und auf
 * der Seite selbst nur, ob der neue Stand ausgeliefert ist. "Nie
 * raten, immer nachsehen" heisst hier: die echte Seite, angemeldet,
 * jeden Reiter.
 *
 * Ausgegeben werden nur Zahlen, Tabellennamen und Fehlertexte des
 * Programms -- nie Inhalte der Seite, und keine Bildschirmfotos: das
 * Protokoll ist öffentlich, die Daten sind es nicht.
 *
 * Aufruf:  KONTO_AUI=... node tools/reiter-pruefen.cjs
 *          ADRESSE=http://127.0.0.1:8080 ATTRAPPE=1 node tools/reiter-pruefen.cjs
 * Mit ATTRAPPE=1 antwortet eine leere Datenbank (für die Prüfung vor
 * dem Ausliefern; dann zeigt sich, ob leere Zustände halten).
 */
// Auf dem Runner steht nur der Kern ohne eigenen Browser (CHROMIUM zeigt
// dann auf den installierten Chrome).
let pw; try { pw = require('playwright'); } catch { pw = require('playwright-core'); }
const { chromium, devices } = pw;
const fs = require('fs');

const ADRESSE = (process.env.ADRESSE || 'https://www.wohntraums.life').replace(/\/$/, '');
const ATTRAPPE = process.env.ATTRAPPE === '1';
// Eine Zürcher Liegenschaft aus der Amtlichen Vermessung (Stichprobe vom 15. November).
const OBJEKT = process.env.OBJEKT_EGRID || 'CH958799779192';
// Eine öffentliche Adresse für CALC YOU LATER (ein Bürohaus in Zürich, keine Angabe zu einer Person).
const CALC_ADRESSE = process.env.CALC_ADRESSE || 'Dufourstrasse 90, Zürich';
// Die Suche mit Julians Beispiel: so läuft auch die Abfrage dahinter einmal echt.
const REITER = ['', 'suche?q=Alle%20W2%20in%20Dietikon', 'leads', 'calc', 'zentrale', 'karte', 'gelegenheiten', 'baugesuche', 'leadlisten', 'auswertung',
  'nachbarschaft', 'arrondierung', 'kalender', 'karte3d', 'admin', 'fonds'];
const GERAETE = [
  { name: 'iPhone', einstellung: devices['iPhone 13'] },
  { name: 'Computer', einstellung: { viewport: { width: 1440, height: 900 } } },
];
// Ab wann eine Abfrage als langsam gilt, und ab wann als Befund. Am
// 16. November lud «Auswertung» 15 Sekunden lang, und nichts sagte,
// welche Abfrage es war -- danach stockte die Datenbank für alle.
const LANGSAM_MS = 3000, ZU_LANGSAM_MS = 8000;
// Sichtbarer Text, der nur bei einem Fehler erscheint.
const MERKMALE = [/\bNaN\b/, /\bundefined\b/, /\[object Object\]/, /Something went wrong/i, /Unerwarteter Fehler/i];

const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');

async function attrappe(seite) {
  const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: 'u1', exp: Math.floor(Date.now() / 1000) + 3600, role: 'authenticated' })}.x`;
  const user = { id: 'u1', email: 'aui@wohntraums.life', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
  const kopf = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': 'content-range', 'content-range': '*/0' };
  await seite.route(/supabase\.co/, r => {
    const u = r.request().url();
    const js = body => r.fulfill({ status: 200, contentType: 'application/json', headers: kopf, body: JSON.stringify(body) });
    if (r.request().method() === 'OPTIONS') return js({});
    if (u.includes('/auth/v1/token')) return js({ access_token: jwt, token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r', user });
    if (u.includes('/auth/v1/user')) return js(user);
    // Kein Fondskonto: sonst leitet die Seite alles nach /fonds um.
    if (u.includes('/rpc/ist_fondsmanager')) return js(false);
    // Ein leeres Universum hat trotzdem seine Form.
    if (u.includes('/rpc/fonds_universum')) return js({ gesellschaft: null, mandant: null, fonds: [], punkte: [], kanten: [], potenziale: [] });
    // Eine einzelne Zeile verlangt: es gibt keine.
    if ((r.request().headers()['accept'] || '').includes('vnd.pgrst.object')) return js(null);
    return js([]);
  });
}

async function pruefen(browser, geraet, zeilen) {
  const ctx = await browser.newContext(geraet.einstellung);
  await ctx.addInitScript(() => { try { sessionStorage.setItem('bauraum-install-hint-dismissed', '1'); } catch { /* gleichgültig */ } });
  const seite = await ctx.newPage();
  let fehler = [], abgelehnt = [], langsam = [], spaetFertig = [];
  // Jede Abfrage an die Datenbank mit ihrem Beginn: so zeigt sich, welche lange braucht.
  const laufend = new Map();
  const istDb = u => /supabase\.co\/(rest|functions|auth)/.test(u);
  // Nur Tabelle oder Funktion -- nie die Bedingungen der Abfrage.
  const kurz = u => u.split('/v1/')[1]?.split('?')[0] ?? '?';
  // Wie lange die Datenbank selbst gebraucht hat: vom Absenden bis zum
  // ersten Byte der Antwort. Die Dauer bis «fertig» enthält auch, was der
  // Browser tut -- und der des Runners zeichnet die 3D-Karte ohne
  // Grafikkarte. Am 16. November standen dort Abfragen nach 200 Gebäuden
  // mit 3.5 bis 4.5 s; gegen die Attrappe, die sofort antwortet, waren es
  // dieselben 3.7 s. Die Zeit brauchte der Browser, nicht die Datenbank.
  const antwortMs = q => {
    if (ATTRAPPE) return 0;
    try {
      const z = q.timing();
      return z && z.requestStart >= 0 && z.responseStart >= z.requestStart ? Math.round(z.responseStart - z.requestStart) : null;
    } catch { return null; }
  };
  seite.on('request', q => { if (istDb(q.url()) && q.method() !== 'OPTIONS') laufend.set(q, Date.now()); });
  seite.on('requestfinished', q => {
    const t = laufend.get(q); if (t == null) return;
    laufend.delete(q);
    const dauer = Date.now() - t, antwort = antwortMs(q);
    // Massgebend ist die Antwort der Datenbank; fehlt die Messung, die Dauer.
    if ((antwort ?? dauer) >= LANGSAM_MS) langsam.push({ name: kurz(q.url()), ms: antwort ?? dauer });
    else if (dauer >= LANGSAM_MS) spaetFertig.push({ ms: dauer, antwort });
  });
  seite.on('requestfailed', q => laufend.delete(q));
  // Was beim Verlassen einer Ansicht noch läuft, ist nicht fertig geworden.
  const langsame = () => {
    const offen = [...laufend].filter(([, t]) => Date.now() - t >= LANGSAM_MS).map(([q, t]) => ({ name: kurz(q.url()), ms: Date.now() - t, offen: true }));
    const alle = [...langsam, ...offen];
    langsam = []; laufend.clear();
    return alle;
  };
  // Zügig beantwortet, aber im Browser erst nach Sekunden fertig: kein
  // Befund der Datenbank, nur eine Zeile unter der Tabelle.
  const spaete = () => { const s = spaetFertig; spaetFertig = []; return s; };
  seite.on('pageerror', e => fehler.push(String(e.message).slice(0, 160)));
  seite.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR|favicon/i.test(m.text())) fehler.push('Konsole: ' + m.text().split('\n')[0].replace(/\?[^\s]*/g, '').slice(0, 160)); });
  seite.on('response', r => {
    const u = r.url();
    if (r.status() >= 400 && istDb(u)) abgelehnt.push(`${kurz(u)} ${r.status()}`);
  });
  // Die 3D-Karte startet mit Fotokacheln von Google, und die werden je
  // Aufruf abgerechnet. Eine Prüfung darf nichts kosten: gesperrt.
  await seite.route(/tile\.googleapis\.com/, r => r.abort());
  if (ATTRAPPE) await attrappe(seite);

  await seite.goto(ADRESSE + '/', { waitUntil: 'domcontentloaded' });
  await seite.waitForTimeout(1500);
  if (await seite.locator('#passwort').count()) {
    await seite.fill('#passwort', ATTRAPPE ? 'x' : (process.env.KONTO_AUI || ''));
    await seite.click('button[type=submit]');
    await seite.waitForSelector('#passwort', { state: 'detached', timeout: 20000 }).catch(() => {});
  }
  if (await seite.locator('#passwort').count()) {
    zeilen.push({ geraet: geraet.name, reiter: '(Anmeldung)', ms: 0, fehler: ['Anmeldung fehlgeschlagen'], abgelehnt, langsam: langsame(), breite: 0, merkmale: [], leer: false });
    await ctx.close();
    return;
  }

  langsame(); spaete();
  for (const r of REITER) {
    fehler = []; abgelehnt = [];
    const start = Date.now();
    await seite.goto(`${ADRESSE}/${r}`, { waitUntil: 'domcontentloaded' });
    // Bis die Abfragen fertig sind; die Karten laden Kacheln ohne Ende, darum mit Frist.
    await seite.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    const ms = Date.now() - start;
    await seite.waitForTimeout(800);
    const stand = await seite.evaluate(() => {
      const text = document.body.innerText || '';
      return {
        breite: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
        text,
        // Eine Seite ohne Überschrift und fast ohne Text ist nicht geladen.
        leer: text.trim().length < 40,
      };
    });
    zeilen.push({
      geraet: geraet.name, reiter: r || 'cockpit', ms, fehler: [...new Set(fehler)], abgelehnt: [...new Set(abgelehnt)], langsam: langsame(), spaet: spaete(),
      breite: stand.breite, merkmale: MERKMALE.filter(m => m.test(stand.text)).map(m => m.source.replace(/\\b/g, '')), leer: stand.leer,
    });
  }
  // Ein Objekt öffnen und die Machbarkeit rechnen lassen: der Weg, auf
  // dem am meisten zusammenkommt (EGRID auflösen, Objektansicht,
  // Bezüge, Umriss aus der Datenbank, Zonenplan). Die EGRID ist eine
  // öffentliche Kennung des Grundbuchs, keine Angabe zu einer Person.
  if (!ATTRAPPE && geraet.name === 'Computer') {
    fehler = []; abgelehnt = [];
    const start = Date.now();
    await seite.goto(`${ADRESSE}/?egrid=${OBJEKT}`, { waitUntil: 'domcontentloaded' });
    const offen = await seite.waitForSelector('[role=dialog]', { timeout: 20000 }).then(() => true).catch(() => false);
    let ergebnis = 'Objekt öffnet nicht';
    if (offen) {
      const knopf = seite.getByRole('button', { name: 'Rechnen' });
      // Der Dialog steht sofort (mit Namen für Bildschirmleser), sein
      // Inhalt erst, wenn das Objekt geladen ist. Ohne dieses Warten
      // meldete Lauf 19 nach einer Sekunde, die Seite kenne die
      // Machbarkeit nicht.
      await knopf.first().waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
      if (await knopf.count()) {
        await knopf.click();
        await seite.waitForFunction(() => /Möglich sind rund|Nicht rechenbar|liess sich nicht laden/.test(document.body.innerText), null, { timeout: 30000 }).catch(() => {});
        const t = await seite.locator('[role=dialog]').innerText();
        ergebnis = /Möglich sind rund/.test(t) ? 'rechenbar' : /Nicht rechenbar/.test(t) ? 'nicht rechenbar (mit Begründung)' : /liess sich nicht laden/.test(t) ? 'Grundlage lädt nicht' : 'keine Antwort';
        ergebnis += ` · Umriss ${/Umriss laut Amtlicher Vermessung/.test(t) ? 'ja' : 'nein'} · Zonenplan ${/amtlich · Zonenplan des Kantons/.test(t) ? 'amtlich' : 'aus der eigenen Liste'}`;
        if (MERKMALE.some(m => m.test(t))) ergebnis += ' · auffälliger Text';
      // Kein Fehler: die Seite kann einen Stand zeigen, der die Studie noch
      // nicht kennt (am 15. November stand die Auslieferung über Nacht).
      } else ergebnis = 'nicht rechenbar: dieser Stand der Seite kennt die Machbarkeit noch nicht';
    }
    const gut = /^(rechenbar|nicht rechenbar)/.test(ergebnis) && !/auffälliger Text/.test(ergebnis);
    zeilen.push({ geraet: geraet.name, reiter: 'objekt und machbarkeit', ms: Date.now() - start, fehler: [...new Set(fehler)].concat(gut ? [] : [ergebnis]),
      abgelehnt: [...new Set(abgelehnt)], langsam: langsame(), spaet: spaete(), breite: 0, merkmale: [], leer: false, notiz: ergebnis });
  }

  // Von der Karte in die 3D-Karte und mit «Zurück» wieder hinaus, ohne neu
  // zu laden -- so, wie ein Mensch es tut. Die Schleife oben lädt jeden
  // Reiter frisch und merkt darum nie, was beim Verlassen bricht. Am
  // 17. November war nach «Zurück» aus der 3D-Karte die ganze Seite leer
  // (Julian: «dann stockt die ganze Webseite»), seit dem 3. November und
  // in jedem Lauf dieser Prüfung unbemerkt.
  if (geraet.name === 'Computer') {
    fehler = []; abgelehnt = [];
    const start = Date.now();
    await seite.goto(`${ADRESSE}/karte`, { waitUntil: 'domcontentloaded' });
    await seite.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    // Wie ein Tipp auf «3D»: derselbe Wechsel im Programm, ohne die Seite neu zu laden.
    await seite.evaluate(() => {
      history.pushState({ idx: (history.state?.idx ?? 0) + 1 }, '', '/karte3d');
      window.dispatchEvent(new PopStateEvent('popstate', { state: history.state }));
    });
    // Erst wenn die Karte steht, gibt es beim Verlassen etwas aufzuräumen.
    const steht = await seite.waitForFunction(() => !!document.querySelector('canvas') && !/3D-Modell wird geladen/.test(document.body.innerText), null, { timeout: 60000 }).then(() => true).catch(() => false);
    let ergebnis = '3D-Karte wird nicht bereit';
    // Lädt sie nicht (Dienst des Bundes nicht erreichbar), gäbe es nichts
    // aufzuräumen, und die Prüfung wäre bestanden, ohne etwas zu prüfen.
    if (steht && /liess sich nicht laden/.test(await seite.evaluate(() => document.body.innerText || ''))) ergebnis = '3D-Karte lädt nicht';
    else if (steht) {
      await seite.waitForTimeout(3000);
      await seite.getByRole('button', { name: 'Zurück' }).first().click();
      await seite.waitForTimeout(2500);
      const danach = await seite.evaluate(() => ({ text: document.body.innerText || '', ort: location.pathname }));
      ergebnis = danach.text.trim().length < 40 ? 'nach «Zurück» ist die Seite leer'
        : /konnte nicht angezeigt werden/.test(danach.text) ? 'nach «Zurück» steht eine Fehlermeldung'
          : danach.ort === '/karte3d' ? '«Zurück» führt nicht hinaus' : 'zurück auf der Karte';
    }
    const gut = ergebnis === 'zurück auf der Karte';
    zeilen.push({ geraet: geraet.name, reiter: '3d verlassen', ms: Date.now() - start, fehler: [...new Set(fehler)].concat(gut ? [] : [ergebnis]),
      abgelehnt: [...new Set(abgelehnt)], langsam: langsame(), spaet: spaete(), breite: 0, merkmale: [], leer: false, notiz: ergebnis });
  }

  // Mitten in einer Auslieferung: die Seite ist offen, der Programmteil
  // des nächsten Reiters gehört zur alten Fassung und ist weg. Am
  // 17. November stand so im Admin-Reiter «Fehler im Bereich Die Seite»,
  // weil Vite den Import beim Neuladen mit `undefined` enden lässt
  // (src/lib/neue-fassung.ts). Richtig ist: einmal neu laden, der Reiter
  // steht, keine Meldung.
  if (geraet.name === 'Computer') {
    fehler = []; abgelehnt = [];
    const start = Date.now();
    await seite.goto(`${ADRESSE}/`, { waitUntil: 'domcontentloaded' });
    await seite.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    let weg = 0, geladen = 0;
    const teil = /\/assets\/Kalender-[^/]*\.js$/;
    await seite.route(teil, r => (weg++ === 0 ? r.fulfill({ status: 404, body: 'weg' }) : r.continue()));
    const zaehlen = f => { if (f === seite.mainFrame()) geladen++; };
    seite.on('framenavigated', zaehlen);
    await seite.evaluate(() => {
      history.pushState({ idx: (history.state?.idx ?? 0) + 1 }, '', '/kalender');
      window.dispatchEvent(new PopStateEvent('popstate', { state: history.state }));
    });
    // Ein Reiter steht, wenn sein Programmteil geladen und die Seite voll ist.
    await seite.waitForFunction(() => (document.body.innerText || '').trim().length > 40 && !document.querySelector('.animate-pulse'), null, { timeout: 20000 }).catch(() => {});
    await seite.waitForTimeout(1500);
    seite.off('framenavigated', zaehlen);
    await seite.unroute(teil);
    const danach = await seite.evaluate(() => ({ text: document.body.innerText || '', ort: location.pathname }));
    const ergebnis = weg === 0 ? 'der Reiter hat keinen eigenen Programmteil mehr (Prüfung anpassen)'
      : /konnte nicht angezeigt werden/.test(danach.text) ? 'Fehlermeldung statt Reiter'
        : danach.text.trim().length < 40 ? 'Seite leer'
          : danach.ort !== '/kalender' ? 'falscher Reiter' : geladen ? 'einmal neu geladen, Reiter steht' : 'Reiter steht ohne Neuladen';
    const gut = /Reiter steht/.test(ergebnis);
    zeilen.push({ geraet: geraet.name, reiter: 'neue fassung', ms: Date.now() - start, fehler: [...new Set(fehler)].concat(gut ? [] : [ergebnis]),
      abgelehnt: [...new Set(abgelehnt)], langsam: langsame(), spaet: spaete(), breite: 0, merkmale: [], leer: false, notiz: ergebnis });
  }

  // CALC YOU LATER einmal ganz: eine Adresse rechnen (Suchdienst, Kataster
  // und Register des Bundes, Zonenplan des Kantons), als Entwurf speichern
  // und wieder löschen. So zeigt sich mit echter Anmeldung, ob die Rechte
  // an der Tabelle halten -- und es bleibt nichts zurück. Am 16. November
  // ging die Seite live, bevor die Migration eingespielt war: «kalkulation
  // 404» fiel nur auf, weil dieser Lauf die Abfragen mitliest.
  if (!ATTRAPPE && geraet.name === 'Computer') {
    fehler = []; abgelehnt = [];
    const start = Date.now();
    await seite.goto(`${ADRESSE}/calc?neu=${encodeURIComponent(CALC_ADRESSE)}`, { waitUntil: 'domcontentloaded' });
    let ergebnis = 'Adresse wird nicht gerechnet';
    const gerechnet = await seite.waitForFunction(() => /Kaufpreisempfehlung CHF|Noch keine Empfehlung/.test(document.body.innerText), null, { timeout: 30000 }).then(() => true).catch(() => false);
    if (gerechnet) {
      const t = await seite.locator('main').innerText();
      ergebnis = /Kaufpreisempfehlung CHF/.test(t) ? 'Empfehlung' : 'keine Empfehlung (mit Begründung)';
      ergebnis += ` · Zonenplan ${/Zonenplan des Kantons/.test(t) ? 'amtlich' : 'nicht amtlich'}`;
      if (MERKMALE.some(m => m.test(t))) ergebnis += ' · auffälliger Text';
      // Gekennzeichnet als Test: bliebe der Entwurf doch stehen, ist er ausgeblendet.
      await seite.getByPlaceholder('Frau Muster').fill('TEST Reiter prüfen');
      await seite.getByRole('button', { name: 'Als Entwurf speichern' }).click();
      const loeschen = seite.getByRole('button', { name: 'Entwurf löschen' });
      if (await loeschen.waitFor({ state: 'visible', timeout: 15000 }).then(() => true).catch(() => false)) {
        await loeschen.click();
        const weg = await seite.getByLabel('Adresse').waitFor({ state: 'visible', timeout: 15000 }).then(() => true).catch(() => false);
        ergebnis += weg ? ' · Entwurf angelegt und gelöscht' : ' · Entwurf lässt sich nicht löschen';
      } else ergebnis += ' · Entwurf lässt sich nicht speichern';
    }
    const gut = /Entwurf angelegt und gelöscht$/.test(ergebnis) && !/auffälliger Text/.test(ergebnis);
    zeilen.push({ geraet: geraet.name, reiter: 'kalkulation', ms: Date.now() - start, fehler: [...new Set(fehler)].concat(gut ? [] : [ergebnis]),
      abgelehnt: [...new Set(abgelehnt)], langsam: langsame(), spaet: spaete(), breite: 0, merkmale: [], leer: false, notiz: ergebnis });
  }
  await ctx.close();
}

/**
 * Antwortet die Datenbank überhaupt zügig? Gemessen wird an zwei
 * kleinen Anfragen, ohne Anmeldung. Die Adresse steht in .env (sie ist
 * öffentlich, die Seite trägt sie im Bündel).
 *
 * Warum vor dem Durchklicken: am 16. November war das Guthaben der
 * Instanz aufgebraucht, und jeder Lauf dieses Tests brachte die Seite
 * für Minuten zum Stehen. Ein Test, der eine träge Datenbank noch
 * 29 Ansichten laden lässt, macht den Befund schlimmer, den er meldet.
 */
async function puls() {
  let env = '';
  try { env = fs.readFileSync('.env', 'utf8'); } catch { return null; }
  const wert = n => (env.match(new RegExp(`^${n}="?([^"\\n]+)"?`, 'm')) || [])[1];
  const url = wert('VITE_SUPABASE_URL'), key = wert('VITE_SUPABASE_PUBLISHABLE_KEY');
  if (!url || !key) return null;
  let laengste = 0;
  for (const pfad of ['/auth/v1/health', '/rest/v1/gwr_kode?select=code&limit=1']) {
    const start = Date.now();
    try { await fetch(url + pfad, { headers: { apikey: key }, signal: AbortSignal.timeout(12000) }); } catch { return 12000; }
    laengste = Math.max(laengste, Date.now() - start);
  }
  return laengste;
}
const TRAEGE_MS = 4000;

(async () => {
  if (!ATTRAPPE && !process.env.KONTO_AUI) { console.error('Secret KONTO_AUI fehlt.'); process.exit(1); }
  if (!ATTRAPPE) {
    let ms = await puls();
    if (ms != null && ms >= TRAEGE_MS) { await new Promise(r => setTimeout(r, 30000)); ms = await puls(); }
    if (ms != null && ms >= TRAEGE_MS) {
      const text = `### Reiter von Aurora (${ADRESSE})\n\n**Die Datenbank antwortet träge: ${(ms / 1000).toFixed(1)} s auf die kleinste Anfrage, zweimal gemessen.** ` +
        'Durchgeklickt wird nicht, um sie nicht weiter zu belasten. Auswerten «last» zeigt, was sie gerade tut.';
      console.log(text);
      if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, text + '\n');
      process.exit(1);
    }
  }
  const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  const zeilen = [];
  for (const g of GERAETE) await pruefen(browser, g, zeilen);
  await browser.close();

  // Eine Abfrage ab acht Sekunden ist ein Befund: sie bremst alle. Was
  // beim Verlassen einer Karte seit ein paar Sekunden läuft, ist keiner
  // -- Karten laden nach, solange sie offen sind.
  const zuLangsam = z => (z.langsam || []).some(l => l.ms >= ZU_LANGSAM_MS);
  const schlecht = z => z.fehler.length || z.abgelehnt.length || z.breite > 1 || z.merkmale.length || z.leer || zuLangsam(z);
  const dauer = l => `${l.name} ${(l.ms / 1000).toFixed(1)} s${l.offen ? ' (nicht fertig)' : ''}`;
  const aus = [`### Reiter von Aurora (${ATTRAPPE ? 'leere Attrappe' : 'echte Daten'}, ${ADRESSE})`, '',
    '| Gerät | Reiter | geladen in | Fehler | abgelehnte Abfragen | langsame Abfragen (Antwort ab 3 s) | über den Rand | auffälliger Text |', '|---|---|---:|---|---|---|---:|---|'];
  for (const z of zeilen) {
    aus.push(`| ${z.geraet} | ${z.reiter} | ${(z.ms / 1000).toFixed(1)} s | ${z.fehler.join('<br>') || '–'}${z.leer ? ' Seite leer' : ''} | ${z.abgelehnt.join(', ') || '–'} | ${(z.langsam || []).map(dauer).join(', ') || '–'} | ${z.breite > 1 ? z.breite + ' px' : '–'} | ${z.merkmale.join(', ') || '–'} |`);
  }
  // Jeder Durchgang unter seinem Namen: am 16. November stand das Ergebnis
  // von CALC YOU LATER unter «Machbarkeit an einer Zürcher Parzelle».
  const DURCHGANG = { 'objekt und machbarkeit': 'Machbarkeit an einer Zürcher Parzelle', kalkulation: 'CALC YOU LATER an einer Zürcher Adresse', '3d verlassen': 'Von der Karte in die 3D-Karte und zurück', 'neue fassung': 'Ein Reiter, dessen Programmteil mitten in einer Auslieferung fehlt' };
  for (const z of zeilen.filter(z => z.notiz)) aus.push('', `${DURCHGANG[z.reiter] ?? z.reiter}: ${z.notiz}.`);
  // Der Browser war beschäftigt, die Datenbank nicht: zur Einordnung.
  for (const z of zeilen.filter(z => (z.spaet || []).length)) {
    const antworten = z.spaet.map(s => s.antwort).filter(a => a != null);
    aus.push('', `${z.geraet}, ${z.reiter}: ${z.spaet.length} Abfragen waren im Browser erst nach ${(Math.max(...z.spaet.map(s => s.ms)) / 1000).toFixed(1)} s fertig`
      + (antworten.length ? `, die Datenbank antwortete nach höchstens ${(Math.max(...antworten) / 1000).toFixed(1)} s.` : '.'));
  }
  const n = zeilen.filter(schlecht).length;
  aus.push('', n ? `**${n} von ${zeilen.length} Ansichten auffällig.**` : `Alle ${zeilen.length} Ansichten sauber.`);
  const text = aus.join('\n');
  console.log(text);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, text + '\n');
  process.exit(n ? 1 : 0);
})();

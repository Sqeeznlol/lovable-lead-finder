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
const REITER = ['', 'leads', 'zentrale', 'karte', 'gelegenheiten', 'baugesuche', 'leadlisten', 'auswertung',
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
  let fehler = [], abgelehnt = [], langsam = [];
  // Jede Abfrage an die Datenbank mit ihrem Beginn: so zeigt sich, welche lange braucht.
  const laufend = new Map();
  const istDb = u => /supabase\.co\/(rest|functions|auth)/.test(u);
  // Nur Tabelle oder Funktion -- nie die Bedingungen der Abfrage.
  const kurz = u => u.split('/v1/')[1]?.split('?')[0] ?? '?';
  seite.on('request', q => { if (istDb(q.url()) && q.method() !== 'OPTIONS') laufend.set(q, Date.now()); });
  seite.on('requestfinished', q => {
    const t = laufend.get(q); if (t == null) return;
    laufend.delete(q);
    if (Date.now() - t >= LANGSAM_MS) langsam.push({ name: kurz(q.url()), ms: Date.now() - t });
  });
  seite.on('requestfailed', q => laufend.delete(q));
  // Was beim Verlassen einer Ansicht noch läuft, ist nicht fertig geworden.
  const langsame = () => {
    const offen = [...laufend].filter(([, t]) => Date.now() - t >= LANGSAM_MS).map(([q, t]) => ({ name: kurz(q.url()), ms: Date.now() - t, offen: true }));
    const alle = [...langsam, ...offen];
    langsam = []; laufend.clear();
    return alle;
  };
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

  langsame();
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
      geraet: geraet.name, reiter: r || 'cockpit', ms, fehler: [...new Set(fehler)], abgelehnt: [...new Set(abgelehnt)], langsam: langsame(),
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
      abgelehnt: [...new Set(abgelehnt)], langsam: langsame(), breite: 0, merkmale: [], leer: false, notiz: ergebnis });
  }
  await ctx.close();
}

(async () => {
  if (!ATTRAPPE && !process.env.KONTO_AUI) { console.error('Secret KONTO_AUI fehlt.'); process.exit(1); }
  const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  const zeilen = [];
  for (const g of GERAETE) await pruefen(browser, g, zeilen);
  await browser.close();

  // Eine Abfrage ab acht Sekunden, oder eine, die gar nicht fertig wird, ist ein Befund: sie bremst alle.
  const zuLangsam = z => (z.langsam || []).some(l => l.offen || l.ms >= ZU_LANGSAM_MS);
  const schlecht = z => z.fehler.length || z.abgelehnt.length || z.breite > 1 || z.merkmale.length || z.leer || zuLangsam(z);
  const dauer = l => `${l.name} ${(l.ms / 1000).toFixed(1)} s${l.offen ? ' (nicht fertig)' : ''}`;
  const aus = [`### Reiter von Aurora (${ATTRAPPE ? 'leere Attrappe' : 'echte Daten'}, ${ADRESSE})`, '',
    '| Gerät | Reiter | geladen in | Fehler | abgelehnte Abfragen | langsame Abfragen (ab 3 s) | über den Rand | auffälliger Text |', '|---|---|---:|---|---|---|---:|---|'];
  for (const z of zeilen) {
    aus.push(`| ${z.geraet} | ${z.reiter} | ${(z.ms / 1000).toFixed(1)} s | ${z.fehler.join('<br>') || '–'}${z.leer ? ' Seite leer' : ''} | ${z.abgelehnt.join(', ') || '–'} | ${(z.langsam || []).map(dauer).join(', ') || '–'} | ${z.breite > 1 ? z.breite + ' px' : '–'} | ${z.merkmale.join(', ') || '–'} |`);
  }
  for (const z of zeilen.filter(z => z.notiz)) aus.push('', `Machbarkeit an einer Zürcher Parzelle: ${z.notiz}.`);
  const n = zeilen.filter(schlecht).length;
  aus.push('', n ? `**${n} von ${zeilen.length} Ansichten auffällig.**` : `Alle ${zeilen.length} Ansichten sauber.`);
  const text = aus.join('\n');
  console.log(text);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, text + '\n');
  process.exit(n ? 1 : 0);
})();

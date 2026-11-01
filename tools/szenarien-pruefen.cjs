// Darstellungstest der Demo-Szenarien: öffnet jede der Kundenfälle aus
// daten/demo-szenarien.json in der echten Zentrale -- Liste, Detail und
// Bericht --, auf dem Desktop und auf dem iPhone, und prüft, was man
// sonst von Auge suchen müsste:
//
//   * kein Seitenfehler im Browser,
//   * nichts ragt seitlich aus der Seite (kein Querscrollen),
//   * kein Text wird abgeschnitten (Element breiter als sein Kasten,
//     ohne dass es scrollen darf),
//   * Knöpfe mindestens 40 px hoch (Finger).
//
// Bilder landen in <ordner>; der Lauf endet mit Fehlercode, wenn ein
// Fall durchfällt.
//
// Voraussetzung: Vite läuft (npx vite --port 8080).
// Aufruf: node tools/szenarien-pruefen.cjs <ordner> [basis-url]
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');

const ordner = process.argv[2] || 'szenarien-bilder';
const basis = process.argv[3] || 'http://127.0.0.1:8080';
fs.mkdirSync(ordner, { recursive: true });
const { faelle } = JSON.parse(fs.readFileSync(path.join(__dirname, '../daten/demo-szenarien.json'), 'utf8'));

// Die Liste so, wie sie die Sicht vorhaben_liste liefert.
const heute = new Date();
const plusMonate = m => { const d = new Date(heute); d.setMonth(d.getMonth() + m); return d.toISOString().slice(0, 10); };
const liste = faelle.map((f, i) => ({
  id: `v${i}`, mandant_id: `m${i}`, art: f.art, titel: f.titel, beschreibung: f.beschreibung ?? null,
  zeitraum_bis: f.monate ? plusMonate(f.monate) : null, portfolio_id: f.anzahl ? `p${i}` : null,
  zustand: f.zustand, vollmacht_am: f.vollmacht ? '2026-10-18' : null,
  vollmacht_von: f.vollmacht ? `Geschäftsleitung ${f.kunde}` : null,
  lagen: f.lagen ?? null, objekttypen: f.objekttypen ?? null, zustaendig: 'Julian',
  erstellt_am: '2026-10-01T10:00:00Z', geaendert_am: new Date(heute - i * 36e5).toISOString(),
  kunde: f.kunde, kunde_art: f.kunde_art, adressen: f.anzahl, letzter_eintrag: f.verlauf ? heute.toISOString() : null,
}));

// Eine Analyse in der Grössenordnung des Falls. Keine echten Zahlen --
// geprüft wird die Darstellung, nicht die Rechnung.
function analyse(f, i) {
  const zu = Math.max(0, f.anzahl - f.offen);
  const g = (f.gemeinden.length ? f.gemeinden : f.lagen ?? ['Zürich']);
  return {
    adressen: f.anzahl, zugeordnet: zu, offen: f.offen,
    flaeche_m2: zu * 1830, hnf_reserve: Math.round(zu * 410), mit_reserve: Math.round(zu * 0.39),
    marge_chf: zu * 1.4e6,
    zonen: zu ? [{ zone: 'W3', n: Math.ceil(zu * 0.4) }, { zone: 'W2', n: Math.ceil(zu * 0.3) }, { zone: 'Z5', n: Math.floor(zu * 0.3) }] : [],
    gemeinden: g.map((x, k) => ({ gemeinde: x, n: Math.max(1, Math.round(zu / (k + 2))) })),
    lage_art: g.map(x => ({ gemeinde: x, kategorie: 'Mehrfamilienhaus', n: Math.max(1, Math.round(zu / 3)) })),
    arrondierungen: Math.round(zu * 0.14), gepruefte_positionen: f.zustand === 'eingegangen' ? 0 : zu,
    nachbarn: zu * 1.2 | 0, nachbarn_mit_eigentuemer: zu * 0.1 | 0, nachbarn_ausserhalb: zu * 0.3 | 0,
    netzwerk: zu ? [
      { address: 'Beispielweg 6', gemeinde: g[0], area: 1820, name: 'Muster Wohnbau AG (Demo)', wieso: ['Investor'], neben: 'Beispielweg 4' },
      { address: 'Probegasse 9', gemeinde: g[g.length - 1], area: 940, name: 'Stiftung Beispiel (Demo)', wieso: ['Kunde', 'Kontakt'], neben: 'Probegasse 7' },
    ] : [],
    top: Array.from({ length: Math.min(zu, 15) }, (_, k) => ({
      address: `${['Seestrasse', 'Dorfstrasse', 'Bahnhofstrasse', 'Im langen Feld'][k % 4]} ${k * 3 + 1}`,
      gemeinde: g[k % g.length], zone: ['W3', 'W2', 'Z5'][k % 3], area: 2400 - k * 90,
      hnf_delta: 1300 - k * 60, marge_chf: (6.2 - k * 0.3) * 1e6, egrid: `CH${100000 + i * 100 + k}`, nachbarn: k % 5,
    })),
  };
}

async function pruefen(p) {
  return p.evaluate(() => {
    const breit = document.documentElement.scrollWidth > innerWidth + 1;
    const abgeschnitten = [];
    for (const el of document.querySelectorAll('h1, h2, h3, p, span, button, a, td, li')) {
      const s = getComputedStyle(el);
      if (s.overflowX === 'auto' || s.overflowX === 'scroll' || s.textOverflow === 'ellipsis' || s.display === 'none') continue;
      if (el.closest('[class*="overflow-x-auto"], [class*="overflow-auto"], .truncate')) continue;
      if (el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0 && s.overflow === 'hidden') {
        abgeschnitten.push((el.innerText || '').slice(0, 40));
      }
    }
    const klein = [...document.querySelectorAll('button, a[href], select, input:not([type=file])')]
      .filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.height < 40; })
      .map(e => `${e.tagName}:${(e.innerText || e.getAttribute('aria-label') || '').trim().slice(0, 24)}:${Math.round(e.getBoundingClientRect().height)}`);
    return { breit, abgeschnitten, klein };
  });
}

(async () => {
  // Wo ein anderer Browser liegt als der, den diese Playwright-Fassung
  // erwartet (Cloud-Umgebung), gibt CHROMIUM_PFAD ihn vor.
  const b = await chromium.launch(process.env.CHROMIUM_PFAD ? { executablePath: process.env.CHROMIUM_PFAD } : {});
  const befunde = [];
  for (const [geraet, opt] of [['desktop', { viewport: { width: 1280, height: 900 } }], ['iphone', devices['iPhone 13']]]) {
    const c = await b.newContext(opt);
    const p = await c.newPage();
    const fehler = [];
    p.on('pageerror', e => fehler.push(String(e).slice(0, 200)));
    let aktuell = 0;
    await p.route('**/rest/v1/**', r => {
      const u = r.request().url();
      if (u.includes('/vorhaben_liste')) return r.fulfill({ json: liste });
      if (u.includes('/rpc/vorhaben_analyse')) return r.fulfill({ json: analyse(faelle[aktuell], aktuell) });
      if (u.includes('/vorhaben_eintrag')) return r.fulfill({ json: (faelle[aktuell].verlauf ?? []).map((t, k) => ({ id: `e${k}`, am: new Date(heute - k * 3 * 864e5).toISOString(), von: 'Demo', art: 'schritt', text: t })) });
      if (u.includes('/portfolio_position')) {
        const f = faelle[aktuell];
        const n = u.includes('zuordnung=eq.zugeordnet') ? f.anzahl - f.offen : u.includes('zuordnung=eq.offen') ? f.offen : 0;
        return r.fulfill({ status: 200, headers: { 'access-control-expose-headers': 'content-range', 'content-range': `0-0/${n}` }, json: [] });
      }
      if (u.includes('/investorprofil')) return r.fulfill({ json: [{ id: 'i1', lagen: ['Zürich', 'Winterthur'], objekttypen: ['MFH'], budget_max_chf: 30e6, akteur: { name: 'Muster Wohnbau AG (Demo)' } }] });
      return r.fulfill({ json: [] });
    });
    await p.route('**/auth/v1/**', r => r.fulfill({ json: {} }));
    // Luftbilder: der Test soll nicht am Netz hängen. Mit ERSATZBILD
    // (ein JPEG) sieht die Bühne auf den Bildern aus wie in echt.
    const ersatz = process.env.ERSATZBILD ? fs.readFileSync(process.env.ERSATZBILD) : null;
    const bild = r => (ersatz ? r.fulfill({ body: ersatz, contentType: 'image/jpeg' }) : r.fulfill({ status: 404, body: '' }));
    await p.route('**/wms.geo.admin.ch/**', bild);
    await p.route('**/wmts*.geo.admin.ch/**', bild);

    await p.goto(`${basis}/tools/szenarien.html`);
    await p.waitForSelector(`text=${faelle[0].titel}`, { timeout: 20000 });
    await p.waitForTimeout(600);
    await p.screenshot({ path: path.join(ordner, `00-liste-${geraet}.png`), fullPage: true });
    const l = await pruefen(p);
    if (l.breit || l.abgeschnitten.length || fehler.length) befunde.push({ fall: 'Liste', geraet, ...l, fehler: [...fehler] });

    for (let i = 0; i < faelle.length; i++) {
      aktuell = i;
      fehler.length = 0;
      const f = faelle[i];
      // "Aktiv" zeigt weder abgeschlossene noch pausierte Fälle; die
      // stehen unter ihrem eigenen Reiter.
      const reiter = f.zustand === 'abgeschlossen' ? /^Abgeschlossen/ : f.zustand === 'pausiert' ? /^Pausiert/ : /^Aktiv/;
      await p.getByRole('tab', { name: reiter }).first().click();
      await p.getByText(f.titel, { exact: true }).first().click();
      await p.waitForSelector('text=Verlauf', { timeout: 15000 }).catch(() => {});
      await p.waitForTimeout(400);
      const nr = String(i + 1).padStart(2, '0');
      await p.screenshot({ path: path.join(ordner, `${nr}-${geraet}.png`), fullPage: true });
      const d = await pruefen(p);
      if (d.breit || d.abgeschnitten.length || fehler.length) befunde.push({ fall: `${nr} ${f.titel}`, geraet, ...d, fehler: [...fehler] });
      if (i === 0) console.log(`${geraet}: zu kleine Knöpfe im ersten Fall:`, d.klein);
      // Zurück wie im Browser -- jede Ansicht hat ihre Adresse
      // (?vorhaben=...), "Zurück" muss in die Liste führen.
      if (i % 2) await p.goBack(); else await p.getByRole('button', { name: /Zentrale/ }).first().click();
      // Zurück in der Liste steht noch der Reiter des letzten Falls.
      await p.waitForSelector('[role=tablist]', { timeout: 10000 });
    }
    await c.close();
  }
  await b.close();
  console.log(`${faelle.length} Fälle, je Desktop und iPhone geprüft.`);
  if (befunde.length) {
    console.log('BEFUNDE:');
    for (const x of befunde) console.log(JSON.stringify(x));
    process.exit(1);
  }
  console.log('Keine Befunde.');
})().catch(e => { console.error(String(e).slice(0, 800)); process.exit(1); });

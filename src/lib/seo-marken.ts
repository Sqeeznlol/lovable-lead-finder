// Was Google von einer Check-Seite sieht, bevor JavaScript läuft.
//
// Gemessen am 15. November: alle 23 Domains lieferten denselben Kopf aus
// index.html -- Titel "Aurora — CRM Schweiz", Beschreibung "Off-Market
// Immobilien-Akquise CRM ... Pipedrive-Integration", kein Text, keine
// Sitemap. Für Google waren das 23 gleiche Seiten über unser internes
// Werkzeug. Darum schreibt der Bau je Marke eine eigene HTML-Datei, und
// vercel.json leitet jede Domain auf ihre Datei um (vercelUmleitungen).
//
// Die Hauptadresse ist die www-Fassung: jede gekaufte Domain leitet die
// nackte Adresse dorthin weiter (am 15. November gemessen, 308).
import { BETREIBER, GEKAUFT, MARKEN, type Marke } from './check-marken';
import { DATENQUELLEN, FRAGEN, SCHRITTE, VERGLEICH } from './check-inhalt';
import { TIPP_TITEL, tippsFuer } from './check-tipps';
import { bildObjekt, fotoDatei, fotoNachId, fotoTeilen, TEILEN_BREITE, TEILEN_HOEHE } from './check-fotos';
import { buehnenBild, schriftAdresse } from './check-gestaltung';
import { ARTIKEL, type Artikel } from './ratgeber';
import { HEIZUNG_TEXT } from './heizung-text';
import { GEMEINDE_DOMAIN, GEMEINDE_HEIMAT, kennzahlen, satz as gemeindeSatz, titel as gemeindeTitel, type Gemeinde } from './gemeinde-seiten';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Die Domain, unter der Google die Marke führen soll: die erste gekaufte, sonst die erste. */
export function hauptdomain(m: Marke): string {
  return m.domains.find(d => GEKAUFT.includes(d)) ?? m.domains[0];
}
export const hauptadresse = (m: Marke) => `https://www.${hauptdomain(m)}`;

// Der Ratgeber steht gleich auf allen Domains. Damit Google ihn nicht als
// 23 Kopien wertet, nennen alle dieselbe Hauptfassung (der erste Artikel
// erschien auf hauschecker.ch, docs/werbeplan-eigentuemer.md).
export const RATGEBER_HEIMAT = 'https://www.hauschecker.ch';

/** Nur Marken mit gekaufter Domain erscheinen bei Google. */
export const MARKEN_LIVE = MARKEN.filter(m => m.domains.some(d => GEKAUFT.includes(d)));

export function titel(m: Marke, a?: Artikel): string {
  return a ? `${a.titel} | ${m.name.join('')}` : `${m.name.join('')} – ${m.titel}`;
}
export function beschreibung(m: Marke, a?: Artikel): string {
  const s = a ? a.lead : `${m.satz} Kostenlos und in einer Minute.`;
  return s.length > 158 ? `${s.slice(0, 155).replace(/\s+\S*$/, '')} …` : s;
}

const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
/** "7. November 2026" -> "2026-11-07"; unbekannt -> undefined. */
export function isoDatum(text: string): string | undefined {
  const t = /^(\d{1,2})\. (\S+) (\d{4})$/.exec(text.trim());
  const m = t ? MONATE.indexOf(t[2]) + 1 : 0;
  return t && m ? `${t[3]}-${String(m).padStart(2, '0')}-${t[1].padStart(2, '0')}` : undefined;
}

// Strukturierte Angaben (schema.org) für Suchmaschinen und KI-Leser. "<" wird
// maskiert, damit kein Text das Skript-Element schliessen kann.
const ldSkript = (o: object) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`;
export function strukturiert(m: Marke, url: string, a?: Artikel, ausfuehrlich = false): object {
  const herausgeber = { '@type': 'Organization', name: BETREIBER };
  if (a) return { '@context': 'https://schema.org', '@type': 'Article', headline: a.titel, description: a.lead, inLanguage: 'de-CH',
    url, mainEntityOfPage: url, author: herausgeber, publisher: herausgeber, ...(isoDatum(a.stand) ? { datePublished: isoDatum(a.stand), dateModified: isoDatum(a.stand) } : {}) };
  // Ein eigenes Foto der Bühne mit Urheber, Rechten und Ort (check-fotos.ts).
  const foto = fotoNachId(m.design.foto);
  const bild = foto ? bildObjekt(foto, hauptadresse(m), `${hauptadresse(m)}/#impressum`) : null;
  const seite = { '@type': 'WebPage', '@id': url, url, name: titel(m), description: beschreibung(m), inLanguage: 'de-CH',
    isPartOf: { '@type': 'WebSite', name: m.name.join(''), url: `${hauptadresse(m)}/`, publisher: herausgeber },
    ...(bild ? { primaryImageOfPage: { '@id': bild['@id'] } } : {}) };
  const graph: object[] = [seite, ...(bild ? [bild] : [])];
  return { '@context': 'https://schema.org', '@graph': ausfuehrlich
    ? [...graph, { '@type': 'FAQPage', '@id': `${url}#fragen`, mainEntity: FRAGEN.map(([f, x]) => ({ '@type': 'Question', name: f, acceptedAnswer: { '@type': 'Answer', text: x } })) }]
    : graph };
}

/**
 * Ersetzt den Kopf von index.html und legt einen lesbaren Grundtext in
 * #root, den React beim Start ersetzt. Ohne JavaScript sieht Google so
 * Titel, Satz und Vorteile der Marke statt einer leeren Seite.
 */
export function markenSeite(indexHtml: string, m: Marke, a?: Artikel, pfad?: string, opt: { basis?: string; links?: { href: string; text: string }[]; ausfuehrlich?: boolean } = {}): string {
  // Ratgeber und Heizungs-Check sind auf allen Domains gleich: eine Hauptfassung für Google.
  const url = a ? `${RATGEBER_HEIMAT}/ratgeber/${a.slug}` : pfad ? `${opt.basis ?? RATGEBER_HEIMAT}${pfad}` : `${hauptadresse(m)}/`;
  const t = esc(titel(m, a)), d = esc(beschreibung(m, a));
  const foto = a ? null : fotoNachId(m.design.foto);
  const kopf = [
    `<title>${t}</title>`,
    `<meta name="description" content="${d}" />`,
    `<link rel="canonical" href="${url}" />`,
    `<meta property="og:type" content="${a ? 'article' : 'website'}" />`,
    `<meta property="og:site_name" content="${esc(m.name.join(''))}" />`,
    `<meta property="og:title" content="${t}" />`,
    `<meta property="og:description" content="${d}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:locale" content="de_CH" />`,
    `<meta name="twitter:title" content="${t}" />`,
    `<meta name="twitter:description" content="${d}" />`,
    // Vorschaubild beim Teilen: nur ein eigenes Foto, 1200 x 630 als JPEG (das lesen alle Dienste);
    // twitter:card summary_large_image steht schon in index.html.
    ...(foto ? [
      `<meta property="og:image" content="${hauptadresse(m)}${fotoTeilen(foto)}" />`,
      `<meta property="og:image:width" content="${TEILEN_BREITE}" />`,
      `<meta property="og:image:height" content="${TEILEN_HOEHE}" />`,
      `<meta property="og:image:alt" content="${esc(foto.alt)}" />`,
    ] : []),
    ldSkript(strukturiert(m, url, a, opt.ausfuehrlich)),
    // Tempo (Lighthouse Handy, 15. November): Schrift der Marke ohne Warten auf JavaScript und
    // ohne das Zeichnen aufzuhalten; das Bühnenbild als grösstes Element mit Vorrang.
    `<link rel="stylesheet" href="${esc(schriftAdresse(m))}" media="print" onload="this.media='all'" />`,
    ...(!a && foto ? [
      `<link rel="preload" as="image" href="${fotoDatei(foto, 800, 'webp')}" type="image/webp" media="(max-width: 999px)" fetchpriority="high" />`,
      `<link rel="preload" as="image" href="${fotoDatei(foto, 1600, 'webp')}" type="image/webp" media="(min-width: 1000px)" fetchpriority="high" />`,
    ] : []),
    ...(!a && buehnenBild(m) ? [
      `<link rel="preload" as="image" href="${buehnenBild(m, 800)}" type="image/webp" media="(max-width: 999px)" fetchpriority="high" />`,
      `<link rel="preload" as="image" href="${buehnenBild(m)}" type="image/webp" media="(min-width: 1000px)" fetchpriority="high" />`,
    ] : []),
  ].join('\n    ');
  // Schlicht gesetzt, damit der Text beim Laden nicht roh aufblitzt; React ersetzt ihn.
  const stil = 'style="font-family:system-ui,sans-serif;max-width:40rem;margin:3rem auto;padding:0 1rem;line-height:1.5;color:#222"';
  const grund = a
    ? `<main ${stil}><p>${esc(a.rubrik)}</p><h1>${esc(a.titel)}</h1><p>${esc(a.lead)}</p>${a.abschnitte.map(x => `<h2>${esc(x.titel)}</h2>${x.absaetze.map(p => `<p>${esc(p)}</p>`).join('')}`).join('')}</main>`
    : `<main ${stil}><p>${esc(m.etikett)}</p><h1>${esc(m.titel)}</h1><p>${esc(m.satz)}</p><ul>${m.vorteile.map(v => `<li>${esc(v)}</li>`).join('')}</ul>${opt.links ? `<ul>${opt.links.map(l => `<li><a href="${esc(l.href)}">${esc(l.text)}</a></li>`).join('')}</ul>` : ''}<p>${esc(m.aufruf)}</p>${opt.ausfuehrlich ? ausfuehrlicherText(m) : ''}<h2>Ratgeber</h2><ul>${ARTIKEL.map(x => `<li><a href="/ratgeber/${x.slug}">${esc(x.titel)}</a></li>`).join('')}</ul></main>`;
  return indexHtml
    // Alles, was index.html über die interne App sagt, fällt weg.
    .replace(/<title>[\s\S]*?<\/title>/, '')
    .replace(/\s*<link id="pc-grundschrift"[^>]*>/, m.design.schrift === 'Urbanist' || m.design.titelSchrift === 'Urbanist' ? '$&' : '')
    .replace(/\s*<meta name="robots"[^>]*>/, '')
    .replace(/\s*<meta name="description"[^>]*>/, '')
    .replace(/\s*<meta (property|name)="(og|twitter):(title|description|type|site_name|url|locale)"[^>]*>/g, '')
    .replace(/\s*<meta name="apple-mobile-web-app-title"[^>]*>/, `\n    <meta name="apple-mobile-web-app-title" content="${esc(m.name.join(''))}" />`)
    .replace('<head>', `<head>\n    ${kopf}`)
    .replace(/<div id="root"><\/div>/, `<div id="root">${grund}</div>`);
}

/** Ablauf, Datenquellen und Fragen der Startseite, wie sie React später zeigt. */
function ausfuehrlicherText(m: Marke): string {
  return `<h2>So funktioniert's</h2><ol>${SCHRITTE.map(([t, p]) => `<li><strong>${esc(t)}</strong>: ${esc(p)}</li>`).join('')}</ol>`
    + `<h2>Daten aus</h2><ul>${DATENQUELLEN.map(q => `<li>${esc(q)}</li>`).join('')}</ul>`
    // Die Tipps, die überall gelten; die kantonalen zeigt die Seite erst zur Parzelle.
    + `<h2>${esc(TIPP_TITEL)}</h2>${tippsFuer(m.schwerpunkt).map(t => `<h3>${esc(t.titel)}</h3><p>${esc(t.text)}</p>${t.quellen.map(q => `<p><a href="${esc(q.url)}">${esc(q.name)}</a></p>`).join('')}`).join('')}`
    + `<h2>Wo der Check hingehört</h2><table><thead><tr><th></th>${VERGLEICH.spalten.map(s => `<th>${esc(s)}</th>`).join('')}</tr></thead><tbody>${VERGLEICH.zeilen.map(([w, ...x]) => `<tr><th>${esc(w)}</th>${x.map(v => `<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>`
    + `<h2>Was Eigentümer uns fragen</h2>${FRAGEN.map(([f, x]) => `<h3>${esc(f)}</h3><p>${esc(x)}</p>`).join('')}`;
}

/**
 * /llms.txt (llmstxt.org): eine kurze Übersicht in Markdown für KI-Leser,
 * mit den Seiten, die sich lohnen. Links zeigen auf die Hauptfassungen.
 */
export function llms(m: Marke, gemeinden: Gemeinde[] = []): string {
  const z = [`# ${m.name.join('')}`, '', `> ${m.satz} Kostenlos und unverbindlich.`, '',
    `${m.name.join('')} ist ein Angebot von ${BETREIBER}. ${m.titel}`, '', '## Seiten', '',
    `- [${m.titel}](${hauptadresse(m)}/): Adresse eingeben, Parzelle, Bauzone, Gebäude und Ausnützung sehen; auf Wunsch persönliche Analyse.`,
    `- [Heizungs-Check](${RATGEBER_HEIMAT}/heizung): Heizung, Baujahr, Fernwärme und Solardach eines Hauses aus Gebäuderegister und Bundesdaten.`,
    ...ARTIKEL.map(a => `- [Ratgeber: ${a.titel}](${RATGEBER_HEIMAT}/ratgeber/${a.slug}): ${a.lead}`),
    ...(gemeinden.length ? [`- [Bauen in Ihrer Gemeinde](${GEMEINDE_HEIMAT}/gemeinden): Baugesuche und Gebäude je Gemeinde der Deutschschweiz (${gemeinden.length} Gemeinden).`] : []),
    '', '## So funktioniert es', '', ...SCHRITTE.map(([t, p], i) => `${i + 1}. ${t}: ${p}`),
    '', '## Datenquellen', '', ...DATENQUELLEN.map(q => `- ${q}`),
    '', '## Häufige Fragen', '', ...FRAGEN.flatMap(([f, x]) => [`### ${f}`, '', x, ''])];
  return z.join('\n').replace(/\n+$/, '\n');
}

export function sitemap(m: Marke, stand: string, gemeinden: Gemeinde[] = []): string {
  // Artikel, Heizungs-Check und Gemeinden nur in der Sitemap ihrer Hauptfassung.
  const urls = [`${hauptadresse(m)}/`, ...(hauptadresse(m) === RATGEBER_HEIMAT ? [`${RATGEBER_HEIMAT}/heizung`, ...ARTIKEL.map(a => `${RATGEBER_HEIMAT}/ratgeber/${a.slug}`)] : []),
    ...(hauptadresse(m) === GEMEINDE_HEIMAT && gemeinden.length ? [`${GEMEINDE_HEIMAT}/gemeinden`, ...gemeinden.map(g => `${GEMEINDE_HEIMAT}/gemeinde/${g.slug}`)] : [])];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `  <url><loc>${u}</loc><lastmod>${stand}</lastmod></url>`).join('\n')}\n</urlset>\n`;
}
export function robots(m: Marke): string {
  return `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${hauptadresse(m)}/sitemap.xml\n`;
}

/** Eine Gemeinde-Seite: Gestaltung der Marke, Titel, Satz und Zahlen der Gemeinde. */
export function gemeindeSeite(indexHtml: string, m: Marke, g: Gemeinde): string {
  const gm: Marke = { ...m, etikett: `${g.ort} · Kanton ${g.kanton}`, titel: gemeindeTitel(g), satz: gemeindeSatz(g),
    vorteile: kennzahlen(g).map(k => `${k.titel}: ${k.wert} (${k.zusatz})`) };
  return markenSeite(indexHtml, gm, undefined, `/gemeinde/${g.slug}`, { basis: GEMEINDE_HEIMAT });
}
export function gemeindenSeite(indexHtml: string, m: Marke, liste: Gemeinde[]): string {
  const gm: Marke = { ...m, etikett: 'Gemeinden', titel: 'Bauen in Ihrer Gemeinde',
    satz: 'Baugesuche und Gebäude je Gemeinde, aus den amtlichen Daten.', vorteile: [] };
  return markenSeite(indexHtml, gm, undefined, '/gemeinden', { basis: GEMEINDE_HEIMAT, links: liste.map(g => ({ href: `/gemeinde/${g.slug}`, text: `${g.ort} (${g.kanton})` })) });
}

/** Der Heizungs-Check einer Marke: ihre Gestaltung, die Texte des Heizungs-Checks. */
export const heizungsMarke = (m: Marke): Marke => ({ ...m, ...HEIZUNG_TEXT });

/** Ablage der erzeugten Dateien im Bau (dist/). */
export const datei = {
  seite: (m: Marke) => `marken/${m.id}/index.html`,
  heizung: (m: Marke) => `marken/${m.id}/heizung.html`,
  gemeinde: (m: Marke, g: Gemeinde) => `marken/${m.id}/gemeinde/${g.slug}.html`,
  gemeinden: (m: Marke) => `marken/${m.id}/gemeinden.html`,
  artikel: (m: Marke, a: Artikel) => `marken/${m.id}/ratgeber/${a.slug}.html`,
  sitemap: (m: Marke) => `marken/${m.id}/sitemap.xml`,
  robots: (m: Marke) => `marken/${m.id}/robots.txt`,
  llms: (m: Marke) => `marken/${m.id}/llms.txt`,
};

/** Die Umleitungen für vercel.json, je Marke nach Hostname; vor der allgemeinen Regel. */
export function vercelUmleitungen() {
  return MARKEN_LIVE.flatMap(m => {
    const host = [{ type: 'host', value: `(www\\.)?(${m.domains.filter(d => GEKAUFT.includes(d)).map(d => d.replace(/\./g, '\\.')).join('|')})` }];
    return [
      { source: '/robots.txt', has: host, destination: `/${datei.robots(m)}` },
      { source: '/sitemap.xml', has: host, destination: `/${datei.sitemap(m)}` },
      { source: '/llms.txt', has: host, destination: `/${datei.llms(m)}` },
      ...ARTIKEL.map(a => ({ source: `/ratgeber/${a.slug}`, has: host, destination: `/${datei.artikel(m, a)}` })),
      { source: '/heizung', has: host, destination: `/${datei.heizung(m)}` },
      // Gemeinde-Seiten nur auf ihrer Domain; anderswo zeigt die App sie ohne eigenen Kopf.
      ...(m.domains.includes(GEMEINDE_DOMAIN) ? [
        { source: '/gemeinden', has: host, destination: `/marken/${m.id}/gemeinden.html` },
        { source: '/gemeinde/:ort', has: host, destination: `/marken/${m.id}/gemeinde/:ort.html` },
      ] : []),
      { source: '/((?!assets/|api/|marken/).*)', has: host, destination: `/${datei.seite(m)}` },
    ];
  });
}

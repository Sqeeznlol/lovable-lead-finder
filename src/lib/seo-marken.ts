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
import { GEKAUFT, MARKEN, type Marke } from './check-marken';
import { ARTIKEL, type Artikel } from './ratgeber';

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

/**
 * Ersetzt den Kopf von index.html und legt einen lesbaren Grundtext in
 * #root, den React beim Start ersetzt. Ohne JavaScript sieht Google so
 * Titel, Satz und Vorteile der Marke statt einer leeren Seite.
 */
export function markenSeite(indexHtml: string, m: Marke, a?: Artikel): string {
  const url = a ? `${RATGEBER_HEIMAT}/ratgeber/${a.slug}` : `${hauptadresse(m)}/`;
  const t = esc(titel(m, a)), d = esc(beschreibung(m, a));
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
  ].join('\n    ');
  // Schlicht gesetzt, damit der Text beim Laden nicht roh aufblitzt; React ersetzt ihn.
  const stil = 'style="font-family:system-ui,sans-serif;max-width:40rem;margin:3rem auto;padding:0 1rem;line-height:1.5;color:#222"';
  const grund = a
    ? `<main ${stil}><p>${esc(a.rubrik)}</p><h1>${esc(a.titel)}</h1><p>${esc(a.lead)}</p>${a.abschnitte.map(x => `<h2>${esc(x.titel)}</h2>${x.absaetze.map(p => `<p>${esc(p)}</p>`).join('')}`).join('')}</main>`
    : `<main ${stil}><p>${esc(m.etikett)}</p><h1>${esc(m.titel)}</h1><p>${esc(m.satz)}</p><ul>${m.vorteile.map(v => `<li>${esc(v)}</li>`).join('')}</ul><p>${esc(m.aufruf)}</p><p><a href="/ratgeber/${ARTIKEL[0].slug}">Ratgeber: ${esc(ARTIKEL[0].titel)}</a></p></main>`;
  return indexHtml
    // Alles, was index.html über die interne App sagt, fällt weg.
    .replace(/<title>[\s\S]*?<\/title>/, '')
    .replace(/\s*<meta name="robots"[^>]*>/, '')
    .replace(/\s*<meta name="description"[^>]*>/, '')
    .replace(/\s*<meta (property|name)="(og|twitter):(title|description|type|site_name|url|locale)"[^>]*>/g, '')
    .replace(/\s*<meta name="apple-mobile-web-app-title"[^>]*>/, `\n    <meta name="apple-mobile-web-app-title" content="${esc(m.name.join(''))}" />`)
    .replace('<head>', `<head>\n    ${kopf}`)
    .replace(/<div id="root"><\/div>/, `<div id="root">${grund}</div>`);
}

export function sitemap(m: Marke, stand: string): string {
  // Artikel nur in der Sitemap ihrer Hauptfassung.
  const urls = [`${hauptadresse(m)}/`, ...(hauptadresse(m) === RATGEBER_HEIMAT ? ARTIKEL.map(a => `${RATGEBER_HEIMAT}/ratgeber/${a.slug}`) : [])];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `  <url><loc>${u}</loc><lastmod>${stand}</lastmod></url>`).join('\n')}\n</urlset>\n`;
}
export function robots(m: Marke): string {
  return `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${hauptadresse(m)}/sitemap.xml\n`;
}

/** Ablage der erzeugten Dateien im Bau (dist/). */
export const datei = {
  seite: (m: Marke) => `marken/${m.id}/index.html`,
  artikel: (m: Marke, a: Artikel) => `marken/${m.id}/ratgeber/${a.slug}.html`,
  sitemap: (m: Marke) => `marken/${m.id}/sitemap.xml`,
  robots: (m: Marke) => `marken/${m.id}/robots.txt`,
};

/** Die Umleitungen für vercel.json, je Marke nach Hostname; vor der allgemeinen Regel. */
export function vercelUmleitungen() {
  return MARKEN_LIVE.flatMap(m => {
    const host = [{ type: 'host', value: `(www\\.)?(${m.domains.filter(d => GEKAUFT.includes(d)).map(d => d.replace(/\./g, '\\.')).join('|')})` }];
    return [
      { source: '/robots.txt', has: host, destination: `/${datei.robots(m)}` },
      { source: '/sitemap.xml', has: host, destination: `/${datei.sitemap(m)}` },
      ...ARTIKEL.map(a => ({ source: `/ratgeber/${a.slug}`, has: host, destination: `/${datei.artikel(m, a)}` })),
      { source: '/((?!assets/|api/|marken/).*)', has: host, destination: `/${datei.seite(m)}` },
    ];
  });
}

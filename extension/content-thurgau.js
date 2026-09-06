// Content script für map.geo.tg.ch — die Eigentumsauskunft des Thurgaus
//
// Der Thurgau hat kein eigenes Portal wie Zürich, sondern hängt die
// Auskunft an den Kartendienst: Parzelle suchen, Mobilnummer angeben,
// SMS-Code eintippen, dann öffnet sich ein Fenster mit den
// Eigentümern. Rund zwanzig Auskünfte am Tag statt fünf.
//
// Was die Karte im Einzelnen für Knöpfe und Felder hat, ist von hier
// aus nicht zu sehen -- und geraten wird nicht mehr. Deshalb macht
// dieses Skript nichts von selbst: es legt einen Balken über die
// Seite, und ein Klick darauf übernimmt, was im Fenster steht. Findet
// es das Fenster nicht, nimmt es die Textauswahl. Damit funktioniert
// es auch dann, wenn die Karte morgen anders gebaut ist.

(function () {
  const MARKE = 'akquise-tg-balken';

  function log(m) { console.log('[Akquise TG]', m); }

  /** Wortlaut einer Eigentümerzeile in Felder zerlegen. */
  function zerlegen(roh) {
    const teile = (roh || '').split(',').map(s => s.trim()).filter(Boolean);
    const arten = ['alleineigentum', 'miteigentum', 'stockwerkeigentum',
                   'gesamteigentum'];
    const fueller = ['schweiz', 'mit sitz in', 'aktiengesellschaft',
                     'gesellschaft mit', 'genossenschaft'];
    let name = teile[0] || '';
    let strasse = '', plzOrt = '', art = '';
    for (let i = 1; i < teile.length; i++) {
      const t = teile[i], klein = t.toLowerCase();
      if (arten.some(a => klein.includes(a))) { art = t; continue; }
      if (fueller.some(f => klein.startsWith(f) || klein === f)) continue;
      const plz = t.match(/^(\d{4})\s+(.+)$/);
      if (plz) { plzOrt = t; continue; }
      if (/\d/.test(t) && !strasse) { strasse = t; continue; }
    }
    const m = plzOrt.match(/^(\d{4})\s+(.+)$/);
    return {
      name, address: strasse,
      plz: m ? m[1] : '', ort: m ? m[2] : '',
      ownershipType: art,
    };
  }

  /**
   * Der Text mit den Eigentümern.
   *
   * Zuerst das Auskunftsfenster, erkannt am Wort "Eigentümer" -- der
   * kleinste Kasten, der es enthält, ist das Fenster und nicht die
   * halbe Seite. Gibt es das nicht, gilt, was von Hand markiert wurde.
   */
  function auskunftstext() {
    const auswahl = String(window.getSelection() || '').trim();
    if (auswahl.length > 20) return auswahl;

    let kleinster = null;
    for (const el of document.querySelectorAll('div, section, table, article')) {
      const t = el.innerText || '';
      if (!/Eigent(ü|ue)mer|Grundeigent/i.test(t)) continue;
      if (t.length < 30 || t.length > 4000) continue;
      if (!kleinster || t.length < (kleinster.innerText || '').length) {
        kleinster = el;
      }
    }
    return kleinster ? (kleinster.innerText || '').trim() : '';
  }

  /** Aus dem Textblock die Zeilen herauslesen, die Eigentümer sind. */
  function eigentuemer(text) {
    return text.split('\n')
      .map(z => z.trim())
      .filter(z => z.length > 8)
      // Überschriften und Beschriftungen sind keine Eigentümer.
      .filter(z => !/^(Eigent(ü|ue)mer|Grundeigent|Parzelle|Grundst(ü|ue)ck|BFSNr|Gemeinde|Nummer|Grundbuch|Fl(ä|ae)che)\b/i.test(z))
      // Ein Eigentümer trägt eine Adresse: irgendwo eine Postleitzahl.
      .filter(z => /\d{4}\s+\S/.test(z))
      .map(zerlegen)
      .filter(o => o.name);
  }

  function balken() {
    if (document.getElementById(MARKE)) return;
    const b = document.createElement('div');
    b.id = MARKE;
    b.style.cssText = [
      'position:fixed', 'z-index:2147483647', 'top:0', 'left:0', 'right:0',
      'display:flex', 'gap:12px', 'align-items:center',
      'padding:8px 14px', 'background:#111', 'color:#fff',
      'font:14px/1.4 system-ui,sans-serif', 'box-shadow:0 2px 8px #0004',
    ].join(';');

    const text = document.createElement('span');
    text.textContent = 'Bauraum — Eigentümer übernehmen, sobald die Auskunft offen ist.';
    text.style.flex = '1';

    const knopf = document.createElement('button');
    knopf.textContent = 'Übernehmen';
    knopf.style.cssText = [
      'padding:6px 14px', 'border:0', 'border-radius:999px',
      'background:#fff', 'color:#111', 'font-weight:600', 'cursor:pointer',
    ].join(';');

    knopf.addEventListener('click', () => {
      const roh = auskunftstext();
      const owners = eigentuemer(roh);
      if (owners.length === 0) {
        text.textContent = 'Nichts gefunden — Eigentümer im Fenster markieren, '
          + 'dann nochmals auf Übernehmen.';
        text.style.color = '#ffb4b4';
        return;
      }
      chrome.runtime.sendMessage({ type: 'OWNER_DATA', owners, roh });
      text.textContent = `${owners.length} Eigentümer übernommen — zurück zur Liste.`;
      text.style.color = '#b7f7c0';
      log(owners);
    });

    b.appendChild(text);
    b.appendChild(knopf);
    document.body.appendChild(b);
    document.body.style.paddingTop = '40px';
  }

  // Die Karte baut sich nach und nach auf; der Balken kommt, sobald es
  // einen Körper gibt, an den er sich hängen kann.
  if (document.body) balken();
  else document.addEventListener('DOMContentLoaded', balken);

  chrome.runtime.sendMessage({ type: 'PORTAL_OPENED' });
})();

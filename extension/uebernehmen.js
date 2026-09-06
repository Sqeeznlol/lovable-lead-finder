// Der Balken, mit dem ein Mensch übernimmt, was auf dem Schirm steht.
//
// Warum nicht automatisch: die bisherige Fassung riet dreimal, wie das
// Portal gebaut ist -- erst eine Textsuche nach "Eigentümerinnen und
// Eigentümer", dann Klassennamen, die "owner" enthalten, dann Absätze
// mit dem Wort "eigentum". Drei Vermutungen hintereinander sind keine
// Lösung, sondern drei Arten, still das Falsche zu tun. Und geprüft
// hat es nie jemand, weil die Extension nie geladen wurde.
//
// Also der andere Weg: das Portal öffnet sich, der Mensch sieht die
// Auskunft, ein Klick übernimmt sie. Was übernommen wurde, geht im
// Wortlaut mit -- daraus lässt sich, wenn es einmal an echten Fällen
// gesehen wurde, ein Ausleser bauen, der wirklich passt.

(function () {
  const MARKE = 'akquise-balken';

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
      if (/^\d{4}\s+\S/.test(t)) { plzOrt = t; continue; }
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
   * Der Textblock mit der Auskunft.
   *
   * Zuerst, was von Hand markiert wurde -- das ist die verlässlichste
   * Angabe, die es gibt. Sonst der kleinste Kasten der Seite, in dem
   * das Wort "Eigentümer" vorkommt: der grosse enthält die halbe
   * Seite, der kleinste die Auskunft.
   */
  function auskunftstext() {
    const auswahl = String(window.getSelection() || '').trim();
    if (auswahl.length > 20) return auswahl;

    let kleinster = null;
    for (const el of document.querySelectorAll('div, section, table, article, dl')) {
      const t = el.innerText || '';
      if (!/Eigent(ü|ue)mer|Grundeigent/i.test(t)) continue;
      if (t.length < 30 || t.length > 4000) continue;
      if (!kleinster || t.length < (kleinster.innerText || '').length) kleinster = el;
    }
    return kleinster ? (kleinster.innerText || '').trim() : '';
  }

  /** Aus dem Textblock die Zeilen herauslesen, die Eigentümer sind. */
  function eigentuemer(text) {
    return text.split('\n')
      .map(z => z.trim())
      .filter(z => z.length > 8)
      .filter(z => !/^(Eigent(ü|ue)mer|Grundeigent|Parzelle|Grundst(ü|ue)ck|BFS|Gemeinde|Nummer|Grundbuch|E-?GRID|Fl(ä|ae)che|Notariat|Verwaltungseinheit)\b/i.test(z))
      // Ein Eigentümer trägt eine Adresse: irgendwo eine Postleitzahl.
      .filter(z => /\d{4}\s+\S/.test(z))
      .map(zerlegen)
      .filter(o => o.name);
  }

  function balken(beschriftung) {
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
    text.textContent = beschriftung;
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
        text.textContent = 'Nichts erkannt — Eigentümer im Fenster markieren, '
          + 'dann nochmals auf Übernehmen.';
        text.style.color = '#ffb4b4';
        return;
      }
      // EGRID und Parzellennummer stehen im Auszug selbst. Sie gehen
      // mit, damit die Anwendung das Objekt findet -- auch wenn niemand
      // vorher auf "Abfragen" geklickt hat.
      const egrid = (roh.match(/\bCH\d{12}\b/) || [])[0] || null;
      const parzelle = (roh.match(/Liegenschaft\s+Nr\.\s*(\S+)/i) || [])[1]
        || (roh.match(/Grundst(?:ü|ue)ck\D{0,12}(\d+)/i) || [])[1] || null;
      chrome.runtime.sendMessage({ type: 'OWNER_DATA', owners, roh, egrid, parzelle });
      text.textContent = `${owners.length} Eigentümer übernommen`
        + (egrid ? ` · ${egrid}` : '')
        + ' — wird auf wohntraums.life eingetragen.';
      text.style.color = '#b7f7c0';
    });

    b.appendChild(text);
    b.appendChild(knopf);
    document.body.appendChild(b);
    document.body.style.paddingTop = '40px';
  }

  window.akquiseBalken = balken;
})();

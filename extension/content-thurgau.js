// map.geo.tg.ch — die Eigentumsauskunft des Thurgaus
//
// Gebaut gegen den wirklichen Aufbau, nicht gegen eine Vermutung. So
// sieht die Auskunft aus (Liegenschaft 447, Diessenhofen):
//
//   <div class="gb-auszug">
//     <h3 class="eigentuemer">Eigentümerinformationen</h3>
//     <div class="eigentum">
//       <p><strong>Rudolf Gubler, </strong> Grabenstrasse 12,
//          8253 Diessenhofen, 1/1</p>
//     </div>
//     <div><strong>Grundstück:</strong> Liegenschaft Nr. 447
//          ( CH627728290920 )</div>
//     …
//
// Der Ablauf, ebenfalls beobachtet: der Link mit swisssearch zoomt
// nicht selbst, er öffnet ein Vorschlagsfeld -- der erste Vorschlag
// muss angeklickt werden. Danach ein Klick auf die Parzelle, und das
// Fenster "Objekt-Information" fragt nach der Mobilnummer (Feld
// #gb_sms, Knopf "Code anfordern"). Den Code tippt ein Mensch.

(function () {
  const log = m => console.log('[Akquise TG]', m);
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  /** Der Kasten mit dem Auszug, sobald er da ist. */
  const auszug = () => document.querySelector('.gb-auszug');

  /**
   * Die Eigentümer aus dem Auszug.
   *
   * Sie stehen in "div.eigentum" als Fliesstext: der Name fett, danach
   * Adresse und Anteil. Fehlt die Klasse einmal, tut es der Absatz
   * unter der Überschrift "Eigentümerinformationen" auch.
   */
  function eigentuemer() {
    const kasten = auszug();
    if (!kasten) return [];
    let absaetze = [...kasten.querySelectorAll('.eigentum p')];
    if (absaetze.length === 0) {
      absaetze = [...kasten.querySelectorAll('p')].filter(
        p => /\d{4}\s+\S/.test(p.innerText || ''));
    }
    return absaetze.map(p => {
      const roh = (p.innerText || '').replace(/\s+/g, ' ').trim();
      const teile = roh.split(',').map(t => t.trim()).filter(Boolean);
      // Der Anteil ("1/1") gehoert nicht in den Namen, mit dem
      // telefoniert wird.
      const name = (teile[0] || '').replace(/\s+\d+\/\d+\s*$/, '').trim();
      const plzOrt = teile.find(t => /^\d{4}\s+\S/.test(t)) || '';
      const strasse = teile.slice(1).find(
        t => /\d/.test(t) && !/^\d{4}\s/.test(t) && !/^\d+\/\d+$/.test(t)) || '';
      const m = plzOrt.match(/^(\d{4})\s+(.+)$/);
      return {
        name,
        address: strasse,
        plz: m ? m[1] : '',
        ort: m ? m[2] : '',
        ownershipType: teile.find(t => /^\d+\/\d+$/.test(t)) || '',
      };
    }).filter(o => o.name);
  }

  /**
   * Die EGRID, die der Auszug selbst nennt.
   *
   * Sie muss geprüft werden: gesucht wurde CH770977292983, die
   * Auskunft nannte CH627728290920 -- ein anderes Grundstück. Wer das
   * nicht prüft, speichert den Eigentümer des Nachbarn.
   */
  function egridImAuszug() {
    const kasten = auszug();
    const text = kasten ? (kasten.innerText || '') : '';
    const m = text.match(/\bCH\d{12}\b/);
    return m ? m[0] : '';
  }

  async function job() {
    return new Promise(r => chrome.runtime.sendMessage({ type: 'GET_JOB' }, r));
  }

  async function ablauf() {
    chrome.runtime.sendMessage({ type: 'PORTAL_OPENED' });
    const auftrag = await job();

    // Der Balken ist immer da: er ist der Weg, wenn die Automatik an
    // einer geänderten Seite scheitert.
    const melde = window.akquiseBalken?.(
      'Bauraum — Parzelle anklicken, Nummer bestätigen. Übernahme läuft '
      + 'dann von selbst.');

    if (!auftrag) { log('kein Auftrag'); return; }

    // Mobilnummer eintragen, sobald das Feld da ist. Angeklickt wird
    // die Parzelle von Hand -- welcher Punkt der Karte gemeint ist,
    // weiss nur, wer sie sieht.
    for (let i = 0; i < 240 && !auszug(); i++) {
      const feld = document.querySelector('#gb_sms');
      if (feld && !feld.value && auftrag.phoneNumber) {
        feld.value = auftrag.phoneNumber;
        feld.dispatchEvent(new Event('input', { bubbles: true }));
        feld.dispatchEvent(new Event('change', { bubbles: true }));
        log('Nummer eingetragen');
        const knopf = [...document.querySelectorAll('button, a, input[type="submit"]')]
          .find(b => /code\s*anfordern/i.test(b.textContent || b.value || ''));
        if (knopf) { knopf.click(); log('Code angefordert'); }
      }
      await sleep(1000);
    }

    if (!auszug()) {
      log('kein Auszug erschienen');
      return;
    }

    await sleep(500);
    const owners = eigentuemer();
    const gefunden = egridImAuszug();

    // Eine Auskunft zum falschen Grundstück ist schlimmer als keine:
    // sie sieht richtig aus. Dann lieber der Mensch.
    if (auftrag.egrid && gefunden && gefunden !== auftrag.egrid) {
      log(`EGRID weicht ab: erwartet ${auftrag.egrid}, gefunden ${gefunden}`);
      melde?.();
      chrome.runtime.sendMessage({
        type: 'OWNER_DATA',
        owners: [],
        error: `Der Auszug gehört zu ${gefunden}, gesucht war `
          + `${auftrag.egrid}. Bitte im Fenster prüfen und von Hand übernehmen.`,
      });
      return;
    }

    if (owners.length === 0) {
      log('keine Eigentümer erkannt');
      return;   // der Balken bleibt -- ein Klick übernimmt von Hand
    }

    chrome.runtime.sendMessage({
      type: 'OWNER_DATA',
      owners,
      roh: (auszug().innerText || ''),
    });
    log(owners);
  }

  if (document.body) ablauf();
  else document.addEventListener('DOMContentLoaded', ablauf);
})();
